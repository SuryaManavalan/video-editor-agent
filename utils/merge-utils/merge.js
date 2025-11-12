export const mergeDiarizationWithTranscript = (diarizationSegments, transcriptSegments) => {
  // Group diarization segments by their best matching transcript
  const transcriptGroups = new Map();

  for (const dia of diarizationSegments) {
    let bestTranscript = null;
    let maxOverlap = 0;
    let bestIndex = -1;

    for (let j = 0; j < transcriptSegments.length; j++) {
      const transcript = transcriptSegments[j];
      const overlapStart = Math.max(dia.start, transcript.start);
      const overlapEnd = Math.min(dia.end, transcript.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestTranscript = transcript;
        bestIndex = j;
      }
    }

    if (bestTranscript) {
      if (!transcriptGroups.has(bestIndex)) {
        transcriptGroups.set(bestIndex, []);
      }
      transcriptGroups.get(bestIndex).push(dia);
    }
  }

  // Create merged segments - one per transcript, using earliest start and latest end from diarization
  const merged = [];
  
  for (let i = 0; i < transcriptSegments.length; i++) {
    const transcript = transcriptSegments[i];
    const diaGroup = transcriptGroups.get(i);

    if (diaGroup && diaGroup.length > 0) {
      // Use earliest start and latest end from all matching diarization segments
      const start = Math.min(...diaGroup.map(d => d.start));
      const end = Math.max(...diaGroup.map(d => d.end));
      const speaker = diaGroup[0].speaker;
      
      merged.push({
        start,
        end,
        text: transcript.text.trim(),
        speaker
      });
    } else {
      // No diarization for this transcript - use transcript timing with default speaker
      merged.push({
        start: transcript.start,
        end: transcript.end,
        text: transcript.text.trim(),
        speaker: 'SPEAKER_00'
      });
    }
  }

  // Sort by start time
  merged.sort((a, b) => a.start - b.start);

  // Fix overlaps
  for (let i = 1; i < merged.length; i++) {
    const prev = merged[i - 1];
    const current = merged[i];
    
    if (current.start < prev.end) {
      prev.end = current.start;
    }
  }

  return merged;
};
