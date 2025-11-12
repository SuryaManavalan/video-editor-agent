export const mergeDiarizationWithTranscript = (diarizationSegments, transcriptSegments) => {
  const merged = [];

  // Use diarization timing with transcript text
  for (const dia of diarizationSegments) {
    // Find transcripts that overlap with this diarization segment
    const overlappingTranscripts = transcriptSegments.filter(seg => 
      seg.start < dia.end && seg.end > dia.start
    );

    // Combine text from overlapping transcripts
    const text = overlappingTranscripts
      .map(seg => seg.text.trim())
      .join(' ');

    merged.push({
      start: dia.start,
      end: dia.end,
      text: text || '',
      speaker: dia.speaker
    });
  }

  return merged;
};
