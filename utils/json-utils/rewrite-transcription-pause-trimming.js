import { writeFile } from 'fs/promises';
import { join } from 'path';

const DIARIZED_DIR = './FILES/DIARIZED_TRANSCRIBED';

export const rewriteTranscriptionAfterTrimming = async (diarizedData, segments, baseName) => {
  const rewrittenTranscription = [];
  let cumulativeTime = 0;

  for (const segment of segments) {
    // Find all diarization entries that fall within this segment
    const entriesInSegment = diarizedData.filter(entry => 
      entry.start >= segment.start && entry.end <= segment.end
    );

    for (const entry of entriesInSegment) {
      // Calculate new times relative to the trimmed video
      const newStart = cumulativeTime + (entry.start - segment.start);
      const newEnd = cumulativeTime + (entry.end - segment.start);

      rewrittenTranscription.push({
        start: newStart,
        end: newEnd,
        text: entry.text,
        speaker: entry.speaker
      });
    }

    // Add the duration of this segment to cumulative time
    cumulativeTime += (segment.end - segment.start);
  }

  // Save rewritten transcription
  const rewrittenPath = join(DIARIZED_DIR, `${baseName}_pauses_trimmed.json`);
  await writeFile(rewrittenPath, JSON.stringify(rewrittenTranscription, null, 2));
  console.log(`Saved updated transcription → ${baseName}_pauses_trimmed.json`);
};
