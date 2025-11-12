import { createReadStream } from 'fs';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const transcribe = async (audioPath) => {
  const transcription = await openai.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment']
  });

  return transcription;
};
