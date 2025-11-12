export const mergeDiarizationWithTranscript = (diarizationSegments, transcriptSegments) => {
  const merged = [];

  for (const seg of transcriptSegments) {
    // Calculate intersection for each diarization segment
    const intersections = diarizationSegments.map(dia => ({
      speaker: dia.speaker,
      intersection: Math.min(dia.end, seg.end) - Math.max(dia.start, seg.start)
    }));

    // Group by speaker and sum intersections
    const speakerScores = {};
    for (const { speaker, intersection } of intersections) {
      if (!speakerScores[speaker]) speakerScores[speaker] = 0;
      speakerScores[speaker] += intersection;
    }

    // Find speaker with maximum intersection
    let maxSpeaker = null;
    let maxScore = -Infinity;
    for (const [speaker, score] of Object.entries(speakerScores)) {
      if (score > maxScore) {
        maxScore = score;
        maxSpeaker = speaker;
      }
    }

    merged.push({
      start: seg.start,
      end: seg.end,
      text: seg.text,
      speaker: maxSpeaker || 'UNKNOWN'
    });
  }

  return merged;
};
