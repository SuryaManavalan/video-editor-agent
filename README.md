# Mantir Video Editor

A simple Node.js workflow for extracting audio from videos, performing speaker diarization, generating speaker-attributed transcriptions, and automatically trimming long pauses.

## Features

- 🎬 Extract audio from video files using ffmpeg
- 🗣️ Speaker diarization using pyannoteAI
- 📝 Audio transcription using OpenAI Whisper
- 🔀 Automatic merging of diarization and transcription results
- ✂️ Trim pauses longer than 5 seconds from videos
- 🤖 AI-powered removal of redundant takes and speech mistakes
- 🎥 Automatic video cutting based on cleaned transcription
- ⚡ Skip already processed files automatically

## File Structure

```
FILES/
├── RAW_VIDEO/              # Input: Place your video files here
├── AUDIO_EXTRACTED/        # Output: Extracted audio files (.mp3)
├── DIARIZED_TRANSCRIBED/   # Output: Speaker-attributed transcriptions (JSON)
│   ├── {video}_pauses_trimmed.json  # Updated timestamps after trimming
│   └── {video}.json                  # Original timestamps
└── VIDEO_PROCESSING/       # Output: Trimmed videos with pauses removed
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
5. Trim pauses longer than 5 seconds from videos
6. Generate updated transcription with adjusted timestamps
7. Use AI to identify and remove redundant takes/mistakes
8. Cut videos to match cleaned transcriptions

## Output Format

### Transcription Files

Each processed video generates JSON files with speaker-attributed transcriptions:

**`{video}.json`** - Original timestamps:
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

**`{video}_pauses_trimmed.json`** - Updated timestamps after removing pauses:
- Timestamps adjusted to match the trimmed video
- Reflects removed pauses (>5 seconds)
- Use this for syncing with the processed video in `VIDEO_PROCESSING/`

**`{video}_cleaned.json`** - AI-cleaned transcription with redundant segments removed:
- Removes repetitive takes and speech mistakes
- Preserves segments with maximum information
- Use this for the final cleaned video

### Video Files

**`VIDEO_PROCESSING/{video}_trimmed.{ext}`** - Video with long pauses removed:
- Automatically removes pauses longer than 5 seconds
- Maintains 0.5-second cushion before/after speech segments
- Smooth transitions between clips

**`VIDEO_PROCESSING/{video}_cleaned.{ext}`** - Final video with redundant segments removed:
- AI-identified redundant takes and mistakes are cut out
- Only the best takes are kept
- Maintains 0.5-second cushion for smooth flow
- Ready for publishing or further editing

## Requirements

- Node.js v18+
- ffmpeg installed on system
- pyannoteAI API key
- OpenAI API key