import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import { join, parse } from 'path';
import { constants } from 'fs';

const execAsync = promisify(exec);

const DIARIZED_DIR = './FILES/DIARIZED_TRANSCRIBED';
const OUTPUT_DIR = './FILES/VIDEO_PROCESSING';

const CUSHION = 0.5; // seconds - same cushion as pause trimming

/**
 * Cut video based on cleaned transcription segments
 * @param {string} baseName - Base name of the video file (without extension)
 * @param {Array} segments - Array of segment objects with id, start, end, text, speaker
 * @returns {Promise<string>} Path to the output video file
 */
export const cutVideoBySegments = async (baseName, segments) => {
  // Find the pause-trimmed video file (input should be *_trimmed.mp4)
  const extensions = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm'];
  let videoPath = null;
  let videoExt = null;
  
  for (const ext of extensions) {
    const testPath = join(OUTPUT_DIR, `${baseName}_trimmed${ext}`);
    try {
      await access(testPath, constants.F_OK);
      videoPath = testPath;
      videoExt = ext;
      break;
    } catch {
      // Try next extension
    }
  }
  
  if (!videoPath) {
    throw new Error(`Could not find trimmed video file for ${baseName}. Make sure pause trimming has been completed first.`);
  }
  
  const outputPath = join(OUTPUT_DIR, `${baseName}_cleaned${videoExt}`);
  
  // Check if output already exists
  try {
    await access(outputPath, constants.F_OK);
    console.log(`⊘ Video already cleaned: ${baseName}_cleaned${videoExt}`);
    return outputPath;
  } catch {
    // File doesn't exist, proceed with cutting
  }
  
  console.log(`\n🎬 Cutting video based on cleaned segments...`);
  console.log(`Input: ${baseName}_trimmed${videoExt}`);
  console.log(`Segments to keep: ${segments.length}`);
  
  // Merge consecutive segments into continuous ranges
  // This is much more efficient than extracting each segment individually
  const continuousRanges = [];
  
  for (let i = 0; i < segments.length; i++) {
    const currentSeg = segments[i];
    const currentStart = Math.max(0, currentSeg.start - CUSHION);
    const currentEnd = currentSeg.end + CUSHION;
    
    if (continuousRanges.length === 0) {
      // First segment
      continuousRanges.push({ start: currentStart, end: currentEnd });
    } else {
      const lastRange = continuousRanges[continuousRanges.length - 1];
      
      // Check if this segment is continuous with the last range (overlapping or touching)
      if (currentStart <= lastRange.end) {
        // Extend the last range
        lastRange.end = Math.max(lastRange.end, currentEnd);
      } else {
        // Start a new range
        continuousRanges.push({ start: currentStart, end: currentEnd });
      }
    }
  }
  
  console.log(`Optimized to ${continuousRanges.length} continuous range(s)`);
  const videoSegments = continuousRanges;
  
  // If only one segment, just trim it
  if (videoSegments.length === 1) {
    const seg = videoSegments[0];
    const duration = seg.end - seg.start;
    const command = `ffmpeg -i "${videoPath}" -ss ${seg.start} -t ${duration} -c:v libx264 -c:a aac "${outputPath}"`;
    
    try {
      await execAsync(command);
      console.log(`✓ Created cleaned video → ${baseName}_cleaned${videoExt}`);
      return outputPath;
    } catch (error) {
      console.error(`✗ Failed to cut video:`, error.message);
      throw error;
    }
  }
  
  // Multiple segments - extract each, then concatenate
  const segmentFiles = [];
  
  for (let i = 0; i < videoSegments.length; i++) {
    const seg = videoSegments[i];
    const duration = seg.end - seg.start;
    const segmentPath = join(OUTPUT_DIR, `${baseName}_cleaned_segment_${i}${videoExt}`);
    const command = `ffmpeg -i "${videoPath}" -ss ${seg.start} -t ${duration} -c:v libx264 -c:a aac "${segmentPath}"`;
    
    try {
      await execAsync(command);
      segmentFiles.push(segmentPath);
      console.log(`  ✓ Extracted segment ${i + 1}/${videoSegments.length}`);
    } catch (error) {
      console.error(`✗ Failed to extract segment ${i}:`, error.message);
      throw error;
    }
  }
  
  // Create concat file list
  const concatListPath = join(OUTPUT_DIR, `${baseName}_cleaned_concat.txt`);
  const concatList = segmentFiles.map(f => `file '${parse(f).base}'`).join('\n');
  await execAsync(`echo "${concatList}" > "${concatListPath}"`);
  
  // Concatenate segments with re-encoding to ensure smooth transitions
  const concatCommand = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -c:a aac "${outputPath}"`;
  
  try {
    await execAsync(concatCommand);
    console.log(`✓ Created cleaned video → ${baseName}_cleaned${videoExt}`);
    
    // Clean up temporary files
    for (const segFile of segmentFiles) {
      await execAsync(`rm "${segFile}"`);
    }
    await execAsync(`rm "${concatListPath}"`);
    
    return outputPath;
  } catch (error) {
    console.error(`✗ Failed to concatenate segments:`, error.message);
    throw error;
  }
};
