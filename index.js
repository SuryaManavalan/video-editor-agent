import 'dotenv/config';
import { extractAudio } from "./utils/ffmpeg-utils/extract-audio.js";
import { diarize } from "./utils/pyannote-utils/diarize.js";

const run = async () => {
  await extractAudio();
  await diarize();
};

run().catch(console.error);
