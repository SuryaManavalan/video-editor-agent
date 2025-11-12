import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile, access } from 'fs/promises';
import { join, parse } from 'path';
import { constants } from 'fs';

const execAsync = promisify(exec);

const RAW_VIDEO_DIR = './FILES/RAW_VIDEO';
const DIARIZED_DIR = './FILES/DIARIZED_TRANSCRIBED';
const OUTPUT_DIR = './FILES/VIDEO_PROCESSING';

const PAUSE_THRESHOLD = 5.0; // seconds
const CUSHION = 0.5; // seconds

export const trimPauses = async () => {
  const files = await readdir(RAW_VIDEO_DIR);
  const videoFiles = files.filter(file => 
    /\.(mp4|mov|avi|mkv|flv|wmv|webm)$/i.test(file)
  );

  console.log(`Found ${videoFiles.length} video(s) to trim pauses...\n`);

  for (const video of videoFiles) {
    const videoPath = join(RAW_VIDEO_DIR, video);
    const baseName = parse(video).name;
    const videoExt = parse(video).ext;
    const diarizedPath = join(DIARIZED_DIR, `${baseName}.json`);
    const outputPath = join(OUTPUT_DIR, `${baseName}_trimmed${videoExt}`);

    // Check if output already exists
    try {
      await access(outputPath, constants.F_OK);
      console.log(`⊘ Skipping ${video} (already trimmed)`);
      continue;
    } catch {
      // File doesn't exist, proceed with trimming
    }

    // Check if diarization JSON exists
    try {
      await access(diarizedPath, constants.F_OK);
    } catch {
      console.log(`⊘ Skipping ${video} (no diarization data found)`);
      continue;
    }

    console.log(`Processing ${video}...`);

    // Read diarization data
    const diarizedData = JSON.parse(await readFile(diarizedPath, 'utf-8'));

    // Build continuous segments (group speech with short pauses, split on long pauses)
    const segments = [];
    let currentStart = Math.max(0, diarizedData[0].start - CUSHION);
    let currentEnd = diarizedData[0].end + CUSHION;

    for (let i = 0; i < diarizedData.length; i++) {
      const current = diarizedData[i];
      const next = diarizedData[i + 1];

      if (next) {
        const pauseDuration = next.start - current.end;
        
        if (pauseDuration > PAUSE_THRESHOLD) {
          // Long pause - end current segment and start new one
          currentEnd = current.end + CUSHION;
          segments.push({ start: currentStart, end: currentEnd });
          currentStart = Math.max(0, next.start - CUSHION);
        } else {
          // Short pause - extend current segment
          currentEnd = current.end + CUSHION;
        }
      } else {
        // Last segment
        currentEnd = current.end + CUSHION;
        segments.push({ start: currentStart, end: currentEnd });
      }
    }

    console.log(`Found ${segments.length} segment(s) to keep (removing ${PAUSE_THRESHOLD}s+ pauses)`);

    const mergedSegments = segments;

    // If only one segment, just trim it
    if (mergedSegments.length === 1) {
      const seg = mergedSegments[0];
      const duration = seg.end - seg.start;
      const command = `ffmpeg -i "${videoPath}" -ss ${seg.start} -t ${duration} -c:v libx264 -c:a aac "${outputPath}"`;
      
      try {
        await execAsync(command);
        console.log(`✓ Trimmed ${video} → ${baseName}_trimmed${videoExt}`);
      } catch (error) {
        console.error(`✗ Failed to trim ${video}:`, error.message);
        throw error;
      }
    } else {
      // Multiple segments - extract each, then concatenate
      const segmentFiles = [];
      
      for (let i = 0; i < mergedSegments.length; i++) {
        const seg = mergedSegments[i];
        const duration = seg.end - seg.start;
        const segmentPath = join(OUTPUT_DIR, `${baseName}_segment_${i}${videoExt}`);
        const command = `ffmpeg -i "${videoPath}" -ss ${seg.start} -t ${duration} -c:v libx264 -c:a aac "${segmentPath}"`;
        
        try {
          await execAsync(command);
          segmentFiles.push(segmentPath);
        } catch (error) {
          console.error(`✗ Failed to extract segment ${i} from ${video}:`, error.message);
          throw error;
        }
      }

      // Create concat file list
      const concatListPath = join(OUTPUT_DIR, `${baseName}_concat.txt`);
      const concatList = segmentFiles.map(f => `file '${parse(f).base}'`).join('\n');
      await execAsync(`echo "${concatList}" > "${concatListPath}"`);

      // Concatenate segments with re-encoding to ensure smooth transitions
      const concatCommand = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -c:a aac "${outputPath}"`;
      
      try {
        await execAsync(concatCommand);
        console.log(`✓ Trimmed ${video} → ${baseName}_trimmed${videoExt}`);
        
        // Clean up temporary files
        for (const segFile of segmentFiles) {
          await execAsync(`rm "${segFile}"`);
        }
        await execAsync(`rm "${concatListPath}"`);
      } catch (error) {
        console.error(`✗ Failed to concatenate segments for ${video}:`, error.message);
        throw error;
      }
    }

    console.log();
  }

  console.log('✓ All pause trimming complete!');
};
