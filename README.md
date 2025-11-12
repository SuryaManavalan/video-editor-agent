# Mantir Video Editor

A simple Node.js workflow for extracting audio from videos, performing speaker diarization, and generating speaker-attributed transcriptions.

## Features

- 🎬 Extract audio from video files using ffmpeg
- 🗣️ Speaker diarization using pyannoteAI
- 📝 Audio transcription using OpenAI Whisper
- 🔀 Automatic merging of diarization and transcription results
- ⚡ Skip already processed files automatically

## File Structure

```
FILES/
├── RAW_VIDEO/              # Input: Place your video files here
├── AUDIO_EXTRACTED/        # Output: Extracted audio files (.mp3)
└── DIARIZED_TRANSCRIBED/   # Output: Final JSON with speaker + transcript
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
PYANNOTE_API_KEY=your_pyannote_key
OPENAI_API_KEY=your_openai_key
```

3. Place video files in `FILES/RAW_VIDEO/`

## Usage

Run the complete workflow:
```bash
node index.js
```

This will:
1. Extract audio from all videos in `RAW_VIDEO/`
2. Upload audio to pyannoteAI for diarization
3. Transcribe audio using OpenAI Whisper
4. Merge results and save to `DIARIZED_TRANSCRIBED/`

## Output Format

Each processed video generates a JSON file with the following structure:

```json
[
  {
    "start": 0.0,
    "end": 5.2,
    "text": "Hello, this is a test.",
    "speaker": "SPEAKER_00"
  },
  {
    "start": 5.2,
    "end": 10.5,
    "text": "This is another speaker.",
    "speaker": "SPEAKER_01"
  }
]
```

## Requirements

- Node.js v18+
- ffmpeg installed on system
- pyannoteAI API key
- OpenAI API key