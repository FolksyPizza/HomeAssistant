# AI Features Testing Guide

This guide explains how to ensure the Whisper (speech-to-text) and Piper (text-to-speech) AI features are functioning correctly in the Smart Display Dashboard.

## Overview

The application has two main AI features:

1. **Whisper (Speech-to-Text)**: Transcribes audio input to text
   - Remote service option (external Whisper API)
   - Local whisper.cpp option (recommended for Pi)
   - Browser fallback with browser-based speech recognition

2. **Piper (Text-to-Speech)**: Converts text responses to spoken audio
   - Pi-local Piper option (recommended for production)
   - Browser speech synthesis fallback

## Environment Configuration

The AI features are configured via environment variables in `.env`. Here are the key settings:

```bash
# Speech-to-Text provider
PI_VOICE_SERVICE_ENABLED=true          # Enable Pi-local transcription
WHISPER_TRANSCRIBE_URL=                # Optional: Remote Whisper service URL

# Text-to-Speech provider
# (TTS provider is determined by PI_VOICE_SERVICE_ENABLED)

# Pi-local voice bridge paths
PI_VOICE_PYTHON=/path/to/venv/bin/python
PI_VOICE_HELPER_SCRIPT=scripts/pi_voice_bridge.py
PI_VOICE_WAKE_WORD_MODEL=wakeword.onnx
PI_VOICE_WHISPER_CLI=whisper.cpp/build/bin/whisper-cli
PI_VOICE_WHISPER_MODEL=whisper.cpp/models/ggml-base.en.bin
PI_VOICE_PIPER_BINARY=piper/piper
PI_VOICE_PIPER_MODEL=piper/en_GB-semaine-medium.onnx

# Optional audio input device configuration
PI_VOICE_INPUT_DEVICE=default
PI_VOICE_INPUT_SAMPLE_RATE=16000

# Preferred interaction mode
ASSISTANT_MODE=pi-local    # or 'browser-mic' for development
```

## Important: .env Loading Fix

**Note**: The application requires a fix to properly load `.env` files in production. The fix has been applied to `package.json`:

```json
"start": "HOST=0.0.0.0 PORT=8989 node --require dotenv/config build"
```

This ensures environment variables are loaded from `.env` when the server starts.

## Testing AI Features

### 1. Quick Health Check

The easiest way to verify AI features are configured correctly:

```bash
curl http://localhost:8989/api/assistant/health | jq '{
  piVoiceServiceEnabled,
  transcriptionProvider,
  ttsProvider,
  connections: [.connections[] | select(.label | test("speech|capture|Whisper")) | {label, state}]
}'
```

Expected output when configured correctly:
```json
{
  "piVoiceServiceEnabled": true,
  "transcriptionProvider": "local-whisper",
  "ttsProvider": "pi-local-piper",
  "connections": [
    { "label": "Pi-local capture", "state": "online" or "degraded" },
    { "label": "Pi-local speech", "state": "online" or "degraded" }
  ]
}
```

**State Meanings**:
- `online`: All dependencies available and audio hardware detected
- `degraded`: Dependencies available but audio hardware not detected (normal in headless environments)
- `offline`: Missing dependencies or service unavailable

### 2. Check Installed Dependencies

Run the automated check script:

```bash
bash check-ai-features.sh
```

This verifies:
- Python venv with required packages (numpy, sounddevice, onnxruntime, scipy)
- Whisper.cpp CLI and model file
- Piper binary and model file
- FFmpeg for audio conversion
- Wake word model file

All dependencies should show "✓" to indicate they're present.

### 3. Test Whisper Transcription

To test the transcription endpoint directly:

```bash
# Create test audio
python3 << 'EOF'
import wave, array

sample_rate = 16000
duration = 1
silence = array.array('h', [0] * (sample_rate * duration))

with wave.open('test-audio.wav', 'wb') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(sample_rate)
    f.writeframes(silence.tobytes())
EOF

# Send to transcription endpoint
curl -X POST \
  -F "audio=@test-audio.wav" \
  -F "browserTranscriptHint=test audio" \
  http://localhost:8989/api/assistant/transcribe | jq '.'
```

Expected output:
```json
{
  "transcript": "text transcribed from audio",
  "provider": "local-whisper",
  "note": "Transcribed locally with whisper.cpp on the Pi."
}
```

### 4. Test TTS Capability

The TTS capability is checked via the health endpoint. To test actual speech output, use the voice turn endpoint (requires full setup):

```bash
curl -X POST http://localhost:8989/api/assistant/voice \
  -H "Content-Type: application/json" \
  -d '{
    "entryMode": "push-to-talk",
    "speakResponse": true,
    "silenceTimeoutSeconds": 2,
    "maxListenSeconds": 10,
    "model": "llama3.2:3b"
  }' | jq '.'
```

This endpoint:
1. Captures audio from the microphone
2. Transcribes it with Whisper
3. Sends to Ollama for inference
4. Speaks the response with Piper

## Troubleshooting

### Issue: `piVoiceServiceEnabled` shows `false`

**Cause**: Environment variables not loading properly

**Solution**:
1. Ensure `.env` file exists with `PI_VOICE_SERVICE_ENABLED=true`
2. Verify the `start` script in `package.json` includes `--require dotenv/config`
3. Rebuild: `npm run build`
4. Start with: `npm run start`

### Issue: Pi-local capture/speech show "degraded"

**Cause**: Audio hardware not detected (expected in headless environments)

**Solution**:
- This is normal if not running on actual Raspberry Pi hardware
- Check actual audio devices with: `.venv-pi-voice/bin/python scripts/pi_voice_bridge.py health --config '{...}'`
- On Pi with audio hardware, state should show as `online`

### Issue: Transcription returns 500 error

**Possible Causes**:
1. whisper.cpp CLI not found
2. Model file missing
3. FFmpeg not installed
4. Audio processing error

**Solutions**:
1. Verify paths in `.env` match actual file locations
2. Check whisper.cpp is compiled: `./whisper.cpp/build/bin/whisper-cli --help`
3. Install FFmpeg: `sudo apt-get install ffmpeg`
4. Check server logs for detailed error messages

### Issue: "No Whisper service configured" message

**Cause**: Both `WHISPER_TRANSCRIBE_URL` and `PI_VOICE_SERVICE_ENABLED` are disabled

**Solution**:
- Set at least one transcription provider:
  - For Pi-local: `PI_VOICE_SERVICE_ENABLED=true`
  - For remote service: `WHISPER_TRANSCRIBE_URL=http://whisper-service:port`
  - For browser fallback: Leave both empty (degraded mode)

## Automated Test Script

Run the full test suite:

```bash
./test-ai-features.sh [host] [port]
```

Default values: `127.0.0.1` and `8989`

This script:
1. Builds the application
2. Starts the server
3. Runs health checks
4. Tests transcription API
5. Checks TTS provider status
6. Generates a summary report

## Continuous Testing

To monitor AI features in development:

```bash
# Watch for changes and re-run tests
while inotifywait -e modify .env src/lib/server/runtime.ts; do
  ./test-ai-features.sh
done
```

## File Locations Reference

- **Whisper.cpp CLI**: `whisper.cpp/build/bin/whisper-cli`
- **Whisper.cpp Model**: `whisper.cpp/models/ggml-base.en.bin` (142MB)
- **Piper Binary**: `piper/piper`
- **Piper Model**: `piper/en_GB-semaine-medium.onnx` (74MB)
- **Wake Word Model**: `wakeword.onnx` (297KB)
- **Pi Voice Bridge**: `scripts/pi_voice_bridge.py`
- **Python Environment**: `.venv-pi-voice/bin/python`

## Performance Considerations

### Whisper Transcription
- Local whisper.cpp: ~1-2 seconds for 1 second of audio (depends on Pi model)
- Browser hint fallback: Immediate
- Remote service: Depends on network latency

### Piper TTS
- Local Piper: ~1-3 seconds for short responses
- Browser speech synthesis: Immediate but lower quality

## API Endpoints Reference

- `GET /api/assistant/health` - Check service status and provider configuration
- `POST /api/assistant/transcribe` - Transcribe audio file
  - Form fields: `audio` (file), `browserTranscriptHint` (string, optional)
  - Returns: `{transcript, provider, note, audioSeconds}`

- `POST /api/assistant/voice` - Full voice turn (capture + transcribe + respond + speak)
  - Body: `{entryMode, speakResponse, model, baseUrl, ...}`
  - Returns: `{capture, turn, speech}`

- `GET /api/runtime` - Get current runtime configuration
  - Shows: `assistant.transcriptionProvider`, `assistant.ttsProvider`, etc.

## Related Documentation

- See `README.md` for overall project setup
- See `AGENTS.md` for development guidelines
- See `.env.example` for all available configuration options
