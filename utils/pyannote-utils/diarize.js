import { readdir, writeFile, access } from 'fs/promises';
import { readFileSync } from 'fs';
import { join, parse } from 'path';
import { constants } from 'fs';
import { transcribe } from '../openai-utils/transcribe.js';
import { mergeDiarizationWithTranscript } from '../merge-utils/merge.js';

const AUDIO_DIR = './FILES/AUDIO_EXTRACTED';
const DIARIZED_DIR = './FILES/DIARIZED_TRANSCRIBED';
const API_KEY = process.env.PYANNOTE_API_KEY;
const BASE_URL = 'https://api.pyannote.ai/v1';

const uploadAudio = async (filePath, objectKey) => {
  const response = await fetch(`${BASE_URL}/media/input`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: `media://${objectKey}` })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create upload URL: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const presignedUrl = data.url || data.uploadUrl || data.presignedUrl;

  if (!presignedUrl) {
    throw new Error(`No upload URL in response: ${JSON.stringify(data)}`);
  }

  const fileData = readFileSync(filePath);

  await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: fileData
  });

  return `media://${objectKey}`;
};

const createDiarizeJob = async (mediaUrl) => {
  const response = await fetch(`${BASE_URL}/diarize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: mediaUrl })
  });

  return await response.json();
};

const pollJob = async (jobId) => {
  while (true) {
    const response = await fetch(`${BASE_URL}/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });

    const data = await response.json();
    const { status } = data;

    if (status === 'succeeded') return data.output;
    if (status === 'failed' || status === 'canceled') {
      throw new Error(`Job ${status}`);
    }

    await new Promise(resolve => setTimeout(resolve, 10000));
  }
};

export const diarize = async () => {
  const files = await readdir(AUDIO_DIR);
  const audioFiles = files.filter(file => /\.(mp3|wav|m4a)$/i.test(file));

  console.log(`Found ${audioFiles.length} audio file(s) to diarize...\n`);

  for (const audio of audioFiles) {
    const audioPath = join(AUDIO_DIR, audio);
    const objectKey = parse(audio).name;
    const outputPath = join(DIARIZED_DIR, `${objectKey}.json`);

    // Check if output already exists
    try {
      await access(outputPath, constants.F_OK);
      console.log(`⊘ Skipping ${audio} (already diarized)`);
      continue;
    } catch {
      // File doesn't exist, proceed with diarization
    }

    console.log(`Uploading ${audio}...`);
    const mediaUrl = await uploadAudio(audioPath, objectKey);

    console.log(`Creating diarization job for ${audio}...`);
    const { jobId } = await createDiarizeJob(mediaUrl);

    console.log(`Polling job ${jobId}...`);
    const diarizationResult = await pollJob(jobId);
    const diarizationSegments = diarizationResult.diarization || [];

    console.log(`Transcribing ${audio}...`);
    const transcription = await transcribe(audioPath);

    console.log(`Merging diarization and transcription...`);
    const merged = mergeDiarizationWithTranscript(diarizationSegments, transcription.segments);

    await writeFile(outputPath, JSON.stringify(merged, null, 2));
    console.log(`✓ Diarization + Transcription complete for ${audio} → ${objectKey}.json`);
    console.log();
  }

  console.log('✓ All diarizations complete!');
};
