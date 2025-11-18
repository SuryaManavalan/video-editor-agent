import { readFile, writeFile, readdir } from 'fs/promises';
import { join, parse } from 'path';
import { runWithTools } from './openai-tool-caller.js';
import { TOOLS } from './tools-registry.js';
import { cutVideoBySegments } from '../ffmpeg-utils/cut-video-by-segments.js';

const DIARIZED_DIR = './FILES/DIARIZED_TRANSCRIBED';

/**
 * Creates a detailed prompt for the AI to analyze and clean transcription segments
 * @param {Array} segments - Array of transcription segments to analyze
 * @param {string} fileName - Name of the file being processed
 * @param {number} batchNumber - Current batch number
 * @param {number} totalBatches - Total number of batches
 * @returns {string} Formatted prompt for the AI
 */
const createCleaningPrompt = (segments, fileName, batchNumber, totalBatches) => {
  return `You are analyzing a video transcription to identify and remove redundant or poorly executed speech segments where the speaker repeated themselves to get a better take.

FILE: ${fileName}
BATCH: ${batchNumber} of ${totalBatches}

SEGMENTS TO ANALYZE:
${JSON.stringify(segments, null, 2)}

YOUR TASK:
Identify segments that should be DELETED because they are:
1. Repetitive attempts at saying the same thing (where the speaker is trying to get a better take)
2. False starts or incomplete thoughts that were immediately re-recorded
3. Verbal mistakes followed by corrections (e.g., "and, sorry, let me say that again")
4. Segments that repeat similar content already covered in previous segments

CRITICAL RULES:
1. **BE AGGRESSIVE WITH REDUNDANCY**: If the same idea or phrase appears in multiple segments, DELETE all but the best version
2. **PRESERVE MAXIMUM INFORMATION**: When multiple takes exist, DELETE the inferior versions and KEEP ONLY the one with the most complete information
3. **LOOK FOR REPEATED PHRASES**: If segments contain the same or very similar phrases (e.g., "I'm going to continue to talk"), DELETE the redundant ones
4. **DELETE EXPLICIT RETAKES**: If speaker says "sorry, let me say that again" or similar, DELETE that segment AND any redundant attempts
5. **FLOW PRESERVATION**: Ensure the remaining segments flow naturally in chronological order without repetition
6. **DELETE INCOMPLETE THOUGHTS**: If a segment trails off incompletely and is then re-stated, DELETE the incomplete version

EXAMPLES:
- If segment 3 says: "I just did a pause, and I'm going to continue to talk, and yep, I'm"
- And segment 4 says: "I'm going to continue to talk, sorry let me say that again"  
- And segment 5 says: "I'm going to continue to talk, and that's it"
→ DELETE segments 4 and 5 (segment 3 already says "I'm going to continue to talk" even if incomplete, segments 4 and 5 are redundant attempts)

- If segment 3 says: "Okay, I just did a 10-second pause, and now I'm going to continue to talk, and yep, I'm"
- And segment 5 says: "Okay, I'm going to continue to talk, and that's it"
→ DELETE segment 5 (it repeats "I'm going to continue to talk" which was already mentioned in segment 3)

RESPONSE FORMAT:
Use the identify_redundant_segments tool to specify which IDs should be removed and why. If no deletions are needed, call the tool with an empty array and explain why all segments should be kept.

Analyze carefully and identify which segment IDs should be deleted from "${fileName}".`;
};

/**
 * Process a transcription file in batches to identify and remove redundant segments
 * @param {string} fileName - Name of the JSON file to process
 * @param {number} batchSize - Number of segments to process at a time (default: 50)
 * @returns {Promise<Object>} Summary of the cleaning process
 */
export const cleanTranscriptionFile = async (fileName, batchSize = 50) => {
  const filePath = join(DIARIZED_DIR, fileName);
  
  // Check if cleaned version already exists
  const parsedPath = parse(fileName);
  const baseName = parsedPath.name.replace(/_pauses_trimmed$/, '');
  const cleanedFileName = `${baseName}_cleaned.json`;
  const cleanedFilePath = join(DIARIZED_DIR, cleanedFileName);
  
  try {
    await readFile(cleanedFilePath, 'utf-8');
    console.log(`\n⚠️  SKIPPING: ${fileName}`);
    console.log(`Cleaned version already exists: ${cleanedFileName}`);
    return {
      fileName,
      cleanedFileName,
      skipped: true,
      reason: 'Cleaned version already exists',
    };
  } catch (error) {
    // File doesn't exist, proceed with cleaning
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PROCESSING: ${fileName}`);
  console.log('='.repeat(60));
  
  // Read the original file
  const fileContent = await readFile(filePath, 'utf-8');
  const segments = JSON.parse(fileContent);
  
  console.log(`Total segments: ${segments.length}`);
  
  // Split into batches
  const batches = [];
  for (let i = 0; i < segments.length; i += batchSize) {
    batches.push(segments.slice(i, i + batchSize));
  }
  
  console.log(`Processing in ${batches.length} batch(es) of up to ${batchSize} segments`);
  
  let allIdsToDelete = [];
  
  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNumber = i + 1;
    
    console.log(`\n--- Batch ${batchNumber}/${batches.length} ---`);
    console.log(`Analyzing segments ${batch[0].id} to ${batch[batch.length - 1].id}`);
    
    const prompt = createCleaningPrompt(batch, fileName, batchNumber, batches.length);
    
    const input = [
      {
        role: "user",
        content: prompt,
      },
    ];
    
    try {
      const response = await runWithTools({
        model: "gpt-4",
        tools: [TOOLS.IDENTIFY_REDUNDANT_SEGMENTS],
        input,
        instructions: "You are an expert at analyzing speech patterns and identifying redundant takes in video transcriptions. Be thorough but conservative in your deletions.",
        maxIterations: 1,
      });
      
      // Extract any deletions that were identified
      const textOutput = response.output
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
      
      console.log(`AI Analysis:\n${textOutput}`);
      
      // Check for identified IDs in the function call outputs
      for (const item of response.input) {
        if (item.type === 'function_call_output') {
          try {
            const result = JSON.parse(item.output);
            if (result.idsToDelete && result.idsToDelete.length > 0) {
              console.log(`  → Identified ${result.idsToDelete.length} segment(s) to delete: ${result.idsToDelete.join(', ')}`);
              console.log(`  → Reason: ${result.reason}`);
              allIdsToDelete.push(...result.idsToDelete);
            } else if (result.idsToDelete && result.idsToDelete.length === 0) {
              console.log(`  → No redundant segments found in this batch`);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
      
    } catch (error) {
      console.error(`Error processing batch ${batchNumber}:`, error.message);
    }
  }
  
  // Remove duplicates from IDs to delete
  const uniqueIdsToDelete = [...new Set(allIdsToDelete)];
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY FOR ${fileName}`);
  console.log('='.repeat(60));
  console.log(`Total segments analyzed: ${segments.length}`);
  console.log(`Segments to delete: ${uniqueIdsToDelete.length}`);
  console.log(`IDs to delete: ${uniqueIdsToDelete.sort((a, b) => a - b).join(', ') || 'None'}`);
  console.log(`Segments remaining: ${segments.length - uniqueIdsToDelete.length}`);
  
  // Create cleaned version
  const cleanedSegments = segments.filter(seg => !uniqueIdsToDelete.includes(seg.id));
  
  // Save cleaned file (cleanedFileName and cleanedFilePath were defined at the start)
  await writeFile(cleanedFilePath, JSON.stringify(cleanedSegments, null, 2));
  console.log(`\n✓ Saved cleaned transcription → ${cleanedFileName}`);
  
  // Cut the video based on cleaned segments
  try {
    await cutVideoBySegments(baseName, cleanedSegments);
  } catch (error) {
    console.error(`⚠️  Failed to cut video: ${error.message}`);
    console.error(`   Transcription was saved, but video processing failed.`);
  }
  
  return {
    fileName,
    cleanedFileName,
    originalCount: segments.length,
    deletedCount: uniqueIdsToDelete.length,
    remainingCount: cleanedSegments.length,
    deletedIds: uniqueIdsToDelete.sort((a, b) => a - b),
  };
};

/**
 * Process all *_pauses_trimmed.json files in the diarized directory
 * @param {number} batchSize - Number of segments to process at a time (default: 50)
 * @returns {Promise<Array>} Array of summaries for each processed file
 */
export const cleanAllTranscriptions = async (batchSize = 50) => {
  console.log('\n' + '='.repeat(60));
  console.log('STARTING TRANSCRIPTION CLEANING PROCESS');
  console.log('='.repeat(60));
  
  // Find all files ending with _pauses_trimmed.json
  const files = await readdir(DIARIZED_DIR);
  const trimmedFiles = files.filter(f => f.endsWith('_pauses_trimmed.json'));
  
  console.log(`\nFound ${trimmedFiles.length} file(s) to process:`);
  trimmedFiles.forEach(f => console.log(`  - ${f}`));
  
  const results = [];
  
  // Process each file
  for (const file of trimmedFiles) {
    try {
      const result = await cleanTranscriptionFile(file, batchSize);
      results.push(result);
    } catch (error) {
      console.error(`\n✗ Error processing ${file}:`, error.message);
      results.push({
        fileName: file,
        error: error.message,
      });
    }
  }
  
  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY - ALL FILES');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    if (result.error) {
      console.log(`\n✗ ${result.fileName}: ERROR - ${result.error}`);
    } else {
      console.log(`\n✓ ${result.fileName} → ${result.cleanedFileName}`);
      console.log(`  Original: ${result.originalCount} segments`);
      console.log(`  Deleted: ${result.deletedCount} segments`);
      console.log(`  Remaining: ${result.remainingCount} segments`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('CLEANING COMPLETE');
  console.log('='.repeat(60) + '\n');
  
  return results;
};
