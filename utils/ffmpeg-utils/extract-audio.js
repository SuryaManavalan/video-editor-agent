

import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, access } from 'fs/promises';
import { join, parse } from 'path';
import { constants } from 'fs';

const execAsync = promisify(exec);

const RAW_VIDEO_DIR = './FILES/RAW_VIDEO';
const AUDIO_OUTPUT_DIR = './FILES/AUDIO_EXTRACTED';

export const extractAudio = async () => {
  const files = await readdir(RAW_VIDEO_DIR);
  const videoFiles = files.filter(file => 
    /\.(mp4|mov|avi|mkv|flv|wmv|webm)$/i.test(file)
  );

  console.log(`Found ${videoFiles.length} video(s) to process...\n`);

  for (const video of videoFiles) {
    const inputPath = join(RAW_VIDEO_DIR, video);
    const outputName = parse(video).name + '.mp3';
    const outputPath = join(AUDIO_OUTPUT_DIR, outputName);
    
    // Check if output already exists
    try {
      await access(outputPath, constants.F_OK);
      console.log(`⊘ Skipping ${video} (already extracted)`);
      continue;
    } catch {
      // File doesn't exist, proceed with extraction
    }
    
    const command = `ffmpeg -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`;
    
    try {
      await execAsync(command);
      console.log(`✓ Extracted audio: ${outputName}`);
    } catch (error) {
      console.error(`✗ Failed to extract audio from ${video}:`, error.message);
      throw error;
    }
  }

  console.log('\n✓ All audio extractions complete!');
};