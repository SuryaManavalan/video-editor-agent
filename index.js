import 'dotenv/config';
import { extractAudio } from "./utils/ffmpeg-utils/extract-audio.js";
import { diarize } from "./utils/pyannote-utils/diarize.js";
import { trimPauses } from "./utils/ffmpeg-utils/trim-pauses.js";
import { cleanAllTranscriptions } from "./utils/openai-utils/clean-transcription.js";

const run = async () => {
  await extractAudio();
  await diarize();
  await trimPauses();
  await cleanAllTranscriptions();
};

run().catch(console.error);
