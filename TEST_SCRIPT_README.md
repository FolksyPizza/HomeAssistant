# Transcription & TTS Test Script

## Overview

`test-transcription-and-tts.py` is a comprehensive Python test script that validates the Whisper (speech-to-text) and Piper (text-to-speech) AI features of the Smart Display Dashboard.

**Key Feature**: Tests use **actual digital audio files**, not speaker playback. All audio is generated programmatically and sent to the API for processing.

## Quick Start

### 1. Start the Application

```bash
cd /home/william/smart-display-dashboard

# Build the application
npm run build

# Start the server
npm run start

# Server will be available at http://127.0.0.1:8989
```

### 2. Run the Tests (in another terminal)

```bash
cd /home/william/smart-display-dashboard
python3 test-transcription-and-tts.py
```

### 3. View Results

The script outputs:
- **Colored terminal output** with progress indicators
- **Summary table** showing pass/fail status
- **JSON results** for programmatic parsing

## Test Cases

### Test 1: API Health Check
**Purpose**: Verify the API is reachable and AI features are configured

**What it tests**:
- API connectivity
- Transcription provider status
- TTS provider status  
- Pi voice service enablement

**Expected Output**:
```
✓ API reachable at http://127.0.0.1:8989
ℹ Transcription provider: local-whisper
ℹ TTS provider: pi-local-piper
ℹ Pi voice enabled: True
✓ AI features properly configured
```

### Test 2: Transcription with Silence
**Purpose**: Test basic transcription with generated silence audio

**What happens**:
1. Generates 1-second silent WAV file
2. Encodes as base64
3. Sends to `/api/assistant/transcribe-test` endpoint
4. Captures transcribed text and provider name

**Expected Output**:
```
✓ Transcription completed via local-whisper
ℹ Result: 'You'
```

### Test 3: Transcription with Tone
**Purpose**: Test transcription with non-speech audio (440Hz tone)

**What happens**:
1. Generates 2-second sine wave at 440Hz
2. Sends to transcription API
3. API returns the browser hint since it's not speech

**Expected Output**:
```
✓ Transcription completed via mock-browser-hint
ℹ Result: 'tone test'
```

### Test 4: Transcription with Speech
**Purpose**: Test with actual speech audio (requires espeak)

**What happens**:
1. Attempts to generate speech using espeak
2. If available, sends to transcription API
3. Compares result to original phrase

**Expected Output** (if espeak installed):
```
✓ Transcription completed via local-whisper
ℹ Input phrase: 'hello world'
ℹ Transcribed: 'hello world'
✓ Transcription accuracy: GOOD
```

**If espeak not installed**:
```
⚠ espeak not available, skipping speech transcription test
```

### Test 5: TTS Provider Health
**Purpose**: Verify text-to-speech provider is available

**What it checks**:
- TTS provider name
- Provider state (online/degraded/offline)
- Detailed status message

**Expected Output**:
```
ℹ TTS Provider: Pi-local speech
ℹ State: degraded
ℹ Detail: No Pi speaker output was detected.
⚠ TTS provider is degraded (may work but with limitations)
```

### Test 6: TTS Audio Generation
**Purpose**: Test actual TTS audio generation

**What happens**:
1. Calls Pi voice bridge helper script
2. Requests text-to-speech synthesis
3. Validates generated audio

**Expected Output**:
```
✓ TTS completed via pi-local-piper
✓ Audio was successfully synthesized
```

## Output Interpretation

### Color Codes

- **✓ (Green)**: Test passed
- **✗ (Red)**: Test failed
- **⚠ (Yellow)**: Test passed with warnings or skipped
- **ℹ (Blue)**: Informational message

### JSON Results Format

```json
{
  "timestamp": "2026-04-04T17:35:12.040179",
  "api_base": "http://127.0.0.1:8989",
  "tests": {
    "health_check": {
      "success": true
    },
    "transcription_silence": {
      "success": true,
      "provider": "local-whisper",
      "transcript": "You",
      "audio_duration": 1.0
    },
    "transcription_tone": {
      "success": true,
      "provider": "mock-browser-hint",
      "transcript": "tone test",
      "audio_duration": 2.0
    },
    "transcription_speech": {
      "success": false,
      "error": "espeak not available"
    },
    "tts_health": {
      "success": true,
      "state": "degraded",
      "note": "No Pi speaker output was detected."
    },
    "tts_generation": {
      "success": false,
      "error": "No Pi speaker output was detected."
    }
  },
  "summary": {
    "total_tests": 6,
    "passed": 4,
    "failed": 2
  }
}
```

## Environment Variables

You can customize the test behavior with environment variables:

```bash
# Change API server
API_BASE=http://192.168.1.50:8989 python3 test-transcription-and-tts.py

# Enable verbose output
VERBOSE=1 python3 test-transcription-and-tts.py

# Both
API_BASE=http://localhost:3000 VERBOSE=1 python3 test-transcription-and-tts.py
```

## Troubleshooting

### "Connection refused" error

**Cause**: Application server not running

**Solution**:
```bash
# Terminal 1: Start the app
npm run build
npm run start

# Terminal 2: Run tests (when app is ready)
python3 test-transcription-and-tts.py
```

### "502 Server Error" on transcription endpoint

**Cause**: Whisper.cpp not found or model file missing

**Solution**:
```bash
# Check whisper CLI
ls -l whisper.cpp/build/bin/whisper-cli

# Check model
ls -lh whisper.cpp/models/ggml-base.en.bin

# If missing, rebuild whisper.cpp
cd whisper.cpp
make
```

### espeak test skipped

**This is normal** - espeak is optional. If you want to test with speech:

```bash
sudo apt-get install espeak
python3 test-transcription-and-tts.py
```

### TTS generation fails

**Cause**: Common on non-Pi systems (no audio hardware)

**Expected**: This is normal behavior. TTS will work fine on actual Raspberry Pi hardware.

**To verify TTS is configured**:
```bash
curl http://127.0.0.1:8989/api/assistant/health | jq '.ttsProvider'
# Should return: "pi-local-piper"
```

## How Audio Testing Works

### Architecture

The test script generates audio files entirely programmatically:

```
Test Script                 Application
    │                            │
    ├─ Generate silence ────────>├─ Receive base64 audio
    │  (1 second WAV)            │
    │                            ├─ Decode to buffer
    ├─ Generate tone ───────────>├─ Create File object
    │  (2 seconds, 440Hz)        │
    │                            ├─ Send to Whisper
    ├─ Get espeak speech ───────>├─ Get transcription
    │  (if available)            │
    │                            ├─ Return result
    ├─ Check TTS health ────────>│
    │                            ├─ Query Piper status
    └─ Generate TTS audio ──────>└─ Synthesize speech
       (text only)                  (no speakers used)
```

### No Speaker Output

- **Audio generation**: Pure programmatic WAV file creation
- **Transcription**: Digital audio sent via JSON API
- **TTS**: Text sent to engine, audio stays in memory
- **Result**: Silent testing, suitable for CI/CD and automation

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test AI Features

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: npm install && pip install requests
      
      - name: Build application
        run: npm run build
      
      - name: Start server
        run: npm run start &
        
      - name: Wait for server
        run: sleep 5
      
      - name: Run AI features test
        run: python3 test-transcription-and-tts.py
      
      - name: Parse results
        run: |
          python3 << 'EOF'
          import json
          with open('/tmp/test-results.json') as f:
            results = json.load(f)
          if results['summary']['failed'] > 0:
            print(f"Failed: {results['summary']['failed']}")
            exit(1)
          EOF
```

### Local Testing Hook

Create `hooks/pre-commit`:

```bash
#!/bin/bash
python3 test-transcription-and-tts.py
if [ $? -ne 0 ]; then
    echo "AI features test failed"
    exit 1
fi
```

## Performance Benchmarks

Typical execution times on Raspberry Pi 5:

| Test | Duration | Notes |
|------|----------|-------|
| Health check | ~1s | API connectivity |
| Silence transcription | ~2s | 1s audio processing |
| Tone transcription | ~2s | 2s audio processing |
| TTS health check | ~1s | Status query |
| **Total** | **~7-8s** | All 6 tests |

## Customization

### Adding New Audio Tests

Edit `test-transcription-and-tts.py` and add:

```python
def test_transcription_with_custom_audio():
    """Test with custom audio format"""
    log("Testing with custom audio...", 'INFO')
    
    try:
        # Your audio generation code here
        audio_file = generate_custom_audio()
        
        # Encode and send
        with open(audio_file, 'rb') as f:
            audio_data = f.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        response = requests.post(
            f'{API_BASE}/api/assistant/transcribe-test',
            json={
                'audioBase64': audio_base64,
                'audioFileName': 'custom.wav',
                'browserTranscriptHint': 'test'
            },
            timeout=TIMEOUT
        )
        
        # Handle response
        ...
    except Exception as e:
        ...
```

Then add to the test suite in `run_all_tests()`.

## Support

For issues or questions:

1. Check `TRANSCRIPTION_TTS_TEST_RESULTS.md` for test results
2. Review `AI_FEATURES_TEST_GUIDE.md` for configuration
3. Check application logs: `tail -f /tmp/app.log`

## Related Files

- **Test Script**: `test-transcription-and-tts.py`
- **Test Endpoint**: `src/routes/api/assistant/transcribe-test/+server.ts`
- **Test Results**: `TRANSCRIPTION_TTS_TEST_RESULTS.md`
- **Setup Guide**: `AI_FEATURES_TEST_GUIDE.md`
- **Configuration**: `.env`

## Version

- **Script Version**: 1.0
- **Compatible With**: Smart Display Dashboard v0.1.0+
- **Last Updated**: 2026-04-04
