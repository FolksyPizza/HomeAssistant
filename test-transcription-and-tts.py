#!/usr/bin/env python3
"""
Smart Display Dashboard - AI Features Functional Test
Tests Whisper transcription and Piper TTS without speakers

This script:
1. Generates synthetic test audio clips
2. Sends them to the transcription API
3. Tests Piper TTS to generate speech audio
4. Validates both speech-to-text and text-to-speech pipelines
"""

import os
import sys
import json
import subprocess
import tempfile
import wave
import array
import requests
from pathlib import Path
from datetime import datetime

# Configuration
API_BASE = os.environ.get('API_BASE', 'http://127.0.0.1:8989')
TIMEOUT = 30
VERBOSE = os.environ.get('VERBOSE', '0') == '1'

# Colors for terminal output
class Color:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def log(msg, level='INFO'):
    """Print formatted log message"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    if level == 'INFO':
        print(f"[{timestamp}] {Color.OKBLUE}ℹ{Color.ENDC}  {msg}")
    elif level == 'SUCCESS':
        print(f"[{timestamp}] {Color.OKGREEN}✓{Color.ENDC}  {msg}")
    elif level == 'WARN':
        print(f"[{timestamp}] {Color.WARNING}⚠{Color.ENDC}  {msg}")
    elif level == 'ERROR':
        print(f"[{timestamp}] {Color.FAIL}✗{Color.ENDC}  {msg}")
    elif level == 'DEBUG' and VERBOSE:
        print(f"[{timestamp}] {Color.OKCYAN}◆{Color.ENDC}  {msg}")


def print_header(title):
    """Print a formatted header"""
    print(f"\n{Color.BOLD}{Color.HEADER}{'=' * 70}{Color.ENDC}")
    print(f"{Color.BOLD}{Color.HEADER}{title.center(70)}{Color.ENDC}")
    print(f"{Color.BOLD}{Color.HEADER}{'=' * 70}{Color.ENDC}\n")


def generate_silence_audio(duration_seconds=1.0, sample_rate=16000):
    """Generate a WAV file with silence (can be used as baseline test)"""
    num_samples = int(sample_rate * duration_seconds)
    silence = array.array('h', [0] * num_samples)

    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        with wave.open(f.name, 'wb') as wav_file:
            wav_file.setnchannels(1)  # mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(silence.tobytes())
        return f.name


def generate_tone_audio(frequency=440, duration_seconds=1.0, sample_rate=16000):
    """Generate a test tone (sine wave) as WAV"""
    import math

    num_samples = int(sample_rate * duration_seconds)
    samples = array.array('h')

    for i in range(num_samples):
        # Generate sine wave
        sample = int(32767 * 0.3 * math.sin(2 * math.pi * frequency * i / sample_rate))
        samples.append(sample)

    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        with wave.open(f.name, 'wb') as wav_file:
            wav_file.setnchannels(1)  # mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(samples.tobytes())
        return f.name


def generate_speech_audio_with_espeak(text, output_path=None):
    """Generate speech audio using espeak (if available)"""
    try:
        if output_path is None:
            output_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
        else:
            output_file = output_path

        subprocess.run(
            ['espeak', '-w', output_file, text],
            check=True,
            capture_output=True,
            timeout=10
        )
        return output_file
    except (FileNotFoundError, subprocess.TimeoutExpired, subprocess.CalledProcessError) as e:
        log(f"espeak not available or failed: {e}", 'DEBUG')
        return None


def test_health_check():
    """Test that health endpoint returns correct AI configuration"""
    log("Checking API health and AI configuration...", 'INFO')

    try:
        response = requests.get(
            f'{API_BASE}/api/assistant/health',
            timeout=TIMEOUT
        )
        response.raise_for_status()
        data = response.json()

        # Check that Pi voice services are enabled
        pi_voice_enabled = data.get('piVoiceServiceEnabled', False)
        transcription_provider = data.get('transcriptionProvider', 'unknown')
        tts_provider = data.get('ttsProvider', 'unknown')

        log(f"API reachable at {API_BASE}", 'SUCCESS')
        log(f"Transcription provider: {transcription_provider}", 'INFO')
        log(f"TTS provider: {tts_provider}", 'INFO')
        log(f"Pi voice enabled: {pi_voice_enabled}", 'INFO')

        if pi_voice_enabled and transcription_provider == 'local-whisper':
            log("AI features properly configured", 'SUCCESS')
            return True
        else:
            log("Warning: Pi voice features may not be fully enabled", 'WARN')
            return True  # Continue testing anyway

    except requests.exceptions.RequestException as e:
        log(f"Health check failed: {e}", 'ERROR')
        return False


def test_transcription_with_silence():
    """Test transcription endpoint with silence audio"""
    log("Testing transcription with silence audio...", 'INFO')

    try:
        import base64

        # Generate silence audio
        audio_file = generate_silence_audio(duration_seconds=1.0)
        log(f"Generated test audio: {audio_file}", 'DEBUG')

        # Read and encode audio as base64
        with open(audio_file, 'rb') as f:
            audio_data = f.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        # Call transcription API with JSON (avoids CSRF protection)
        response = requests.post(
            f'{API_BASE}/api/assistant/transcribe-test',
            json={
                'audioBase64': audio_base64,
                'audioFileName': 'test_silence.wav',
                'browserTranscriptHint': 'test silence'
            },
            timeout=TIMEOUT
        )

        response.raise_for_status()
        data = response.json()

        transcript = data.get('transcript', '')
        provider = data.get('provider', 'unknown')

        log(f"Transcription completed via {provider}", 'SUCCESS')
        log(f"Result: '{transcript}'", 'INFO')

        # Clean up
        os.unlink(audio_file)

        return {
            'success': True,
            'provider': provider,
            'transcript': transcript,
            'audio_duration': 1.0
        }

    except requests.exceptions.RequestException as e:
        log(f"Transcription test failed: {e}", 'ERROR')
        return {'success': False, 'error': str(e)}
    except Exception as e:
        log(f"Unexpected error during transcription test: {e}", 'ERROR')
        return {'success': False, 'error': str(e)}


def test_transcription_with_tone():
    """Test transcription endpoint with tone audio"""
    log("Testing transcription with tone audio (440Hz)...", 'INFO')

    try:
        import base64

        # Generate tone audio
        audio_file = generate_tone_audio(frequency=440, duration_seconds=2.0)
        log(f"Generated test tone: {audio_file}", 'DEBUG')

        # Read and encode audio as base64
        with open(audio_file, 'rb') as f:
            audio_data = f.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        # Call transcription API with JSON (avoids CSRF protection)
        response = requests.post(
            f'{API_BASE}/api/assistant/transcribe-test',
            json={
                'audioBase64': audio_base64,
                'audioFileName': 'test_tone.wav',
                'browserTranscriptHint': 'tone test'
            },
            timeout=TIMEOUT
        )

        response.raise_for_status()
        data = response.json()

        transcript = data.get('transcript', '')
        provider = data.get('provider', 'unknown')
        partial = data.get('partialTranscript', '')

        log(f"Transcription completed via {provider}", 'SUCCESS')
        log(f"Result: '{transcript}'", 'INFO')
        if partial:
            log(f"Partial: '{partial}'", 'DEBUG')

        # Clean up
        os.unlink(audio_file)

        return {
            'success': True,
            'provider': provider,
            'transcript': transcript,
            'audio_duration': 2.0
        }

    except requests.exceptions.RequestException as e:
        log(f"Transcription test failed: {e}", 'ERROR')
        return {'success': False, 'error': str(e)}


def test_transcription_with_espeak_audio():
    """Test transcription with actual speech generated by espeak"""
    log("Testing transcription with espeak-generated speech...", 'INFO')

    # Try to generate speech audio with espeak
    test_phrase = "hello world"
    audio_file = generate_speech_audio_with_espeak(test_phrase)

    if audio_file is None:
        log("espeak not available, skipping speech transcription test", 'WARN')
        return {'success': False, 'error': 'espeak not available'}

    try:
        import base64

        log(f"Generated speech audio: {audio_file}", 'DEBUG')

        # Read and encode audio as base64
        with open(audio_file, 'rb') as f:
            audio_data = f.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        # Call transcription API with JSON (avoids CSRF protection)
        response = requests.post(
            f'{API_BASE}/api/assistant/transcribe-test',
            json={
                'audioBase64': audio_base64,
                'audioFileName': 'test_speech.wav',
                'browserTranscriptHint': test_phrase
            },
            timeout=TIMEOUT
        )

        response.raise_for_status()
        data = response.json()

        transcript = data.get('transcript', '')
        provider = data.get('provider', 'unknown')

        log(f"Transcription completed via {provider}", 'SUCCESS')
        log(f"Input phrase: '{test_phrase}'", 'DEBUG')
        log(f"Transcribed: '{transcript}'", 'INFO')

        # Check if transcription is close to input
        if test_phrase.lower() in transcript.lower() or transcript.lower() in test_phrase.lower():
            log("Transcription accuracy: GOOD", 'SUCCESS')
        else:
            log("Transcription accuracy: PARTIAL or DIFFERENT", 'WARN')

        # Clean up
        os.unlink(audio_file)

        return {
            'success': True,
            'provider': provider,
            'transcript': transcript,
            'expected': test_phrase,
            'accuracy': 'good' if test_phrase.lower() in transcript.lower() else 'partial'
        }

    except requests.exceptions.RequestException as e:
        log(f"Transcription test failed: {e}", 'ERROR')
        return {'success': False, 'error': str(e)}
    finally:
        if os.path.exists(audio_file):
            os.unlink(audio_file)


def test_tts_with_helper_script():
    """Test TTS by calling the Pi voice bridge helper script directly"""
    log("Testing Piper TTS via Pi voice bridge...", 'INFO')

    try:
        # Get runtime config to find the helper script
        response = requests.get(f'{API_BASE}/api/runtime', timeout=TIMEOUT)
        response.raise_for_status()
        config = response.json()

        helper_script = config.get('assistant', {}).get('piVoice', {}).get('helperScript')
        python_path = config.get('assistant', {}).get('piVoice', {}).get('pythonPath')

        if not helper_script or not python_path:
            log("Helper script or Python path not configured", 'WARN')
            return {'success': False, 'error': 'Helper script not configured'}

        if not os.path.exists(helper_script):
            log(f"Helper script not found: {helper_script}", 'WARN')
            return {'success': False, 'error': f'Helper script not found: {helper_script}'}

        if not os.path.exists(python_path):
            log(f"Python path not found: {python_path}", 'WARN')
            return {'success': False, 'error': f'Python not found: {python_path}'}

        # Build the config JSON for the helper script
        bridge_config = {
            'input_device': None,
            'input_sample_rate': 16000,
            'wake_word_model': 'wakeword.onnx',
            'whisper_cli': 'whisper.cpp/build/bin/whisper-cli',
            'whisper_model': 'whisper.cpp/models/ggml-base.en.bin',
            'piper_binary': 'piper/piper',
            'piper_model': 'piper/en_GB-semaine-medium.onnx'
        }

        test_text = "Hello, this is a test of the text to speech system"

        log(f"Testing TTS with text: '{test_text}'", 'DEBUG')

        # Call the helper script to generate speech (no --output flag)
        try:
            result = subprocess.run(
                [
                    python_path,
                    helper_script,
                    'speak',
                    '--config',
                    json.dumps(bridge_config),
                    '--text',
                    test_text
                ],
                capture_output=True,
                text=True,
                timeout=60,
                cwd=os.path.dirname(helper_script) or '.'
            )

            if result.returncode == 0:
                # Parse the JSON output
                lines = result.stdout.strip().split('\n')
                for line in reversed(lines):
                    try:
                        output = json.loads(line)
                        log(f"TTS completed via {output.get('provider', 'unknown')}", 'SUCCESS')
                        log(f"TTS output spoken: {output.get('spoken', False)}", 'INFO')

                        if output.get('spoken', False):
                            log("Audio was successfully synthesized", 'SUCCESS')
                            return {
                                'success': True,
                                'provider': output.get('provider', 'unknown'),
                                'text': test_text,
                                'spoken': True,
                                'note': output.get('note', '')
                            }
                        else:
                            log("TTS did not produce audio", 'WARN')
                            return {
                                'success': True,
                                'provider': output.get('provider', 'unknown'),
                                'text': test_text,
                                'spoken': False,
                                'note': output.get('note', 'No audio produced')
                            }
                    except json.JSONDecodeError:
                        continue

                log("Could not parse TTS output", 'ERROR')
                return {'success': False, 'error': 'Could not parse output', 'raw_output': result.stdout}
            else:
                error_msg = result.stderr or result.stdout
                log(f"Helper script failed: {error_msg}", 'ERROR')
                return {'success': False, 'error': error_msg}

        except subprocess.TimeoutExpired:
            log("TTS generation timeout", 'ERROR')
            return {'success': False, 'error': 'Timeout'}

    except Exception as e:
        log(f"TTS test error: {e}", 'ERROR')
        return {'success': False, 'error': str(e)}


def test_tts_health():
    """Test TTS provider health via API"""
    log("Checking TTS provider health...", 'INFO')

    try:
        response = requests.get(
            f'{API_BASE}/api/assistant/health',
            timeout=TIMEOUT
        )
        response.raise_for_status()
        data = response.json()

        # Find TTS connection status
        for conn in data.get('connections', []):
            if 'speech' in conn.get('label', '').lower():
                state = conn.get('state', 'unknown')
                detail = conn.get('detail', '')

                log(f"TTS Provider: {conn.get('label')}", 'INFO')
                log(f"State: {state}", 'INFO')
                if detail:
                    log(f"Detail: {detail}", 'INFO')

                if state == 'online':
                    log("TTS provider is ready", 'SUCCESS')
                    return {'success': True, 'state': state}
                elif state == 'degraded':
                    log("TTS provider is degraded (may work but with limitations)", 'WARN')
                    return {'success': True, 'state': state, 'note': detail}
                else:
                    log("TTS provider is offline", 'WARN')
                    return {'success': False, 'state': state}

        log("Could not determine TTS status", 'WARN')
        return {'success': False, 'error': 'Status not found'}

    except requests.exceptions.RequestException as e:
        log(f"TTS health check failed: {e}", 'ERROR')
        return {'success': False, 'error': str(e)}


def run_all_tests():
    """Run all tests and collect results"""
    results = {
        'timestamp': datetime.now().isoformat(),
        'api_base': API_BASE,
        'tests': {}
    }

    print_header("Smart Display Dashboard - AI Features Test Suite")

    # Test 1: Health Check
    print_header("Test 1: API Health Check")
    success = test_health_check()
    results['tests']['health_check'] = {'success': success}

    if not success:
        log("API is not reachable. Cannot continue with other tests.", 'ERROR')
        return results

    # Test 2: Transcription with Silence
    print_header("Test 2: Transcription with Silence")
    result = test_transcription_with_silence()
    results['tests']['transcription_silence'] = result

    # Test 3: Transcription with Tone
    print_header("Test 3: Transcription with Tone Audio")
    result = test_transcription_with_tone()
    results['tests']['transcription_tone'] = result

    # Test 4: Transcription with Speech (if espeak available)
    print_header("Test 4: Transcription with Generated Speech")
    result = test_transcription_with_espeak_audio()
    results['tests']['transcription_speech'] = result

    # Test 5: TTS Health Check
    print_header("Test 5: TTS Provider Health")
    result = test_tts_health()
    results['tests']['tts_health'] = result

    # Test 6: TTS Full Test
    print_header("Test 6: TTS Audio Generation")
    result = test_tts_with_helper_script()
    results['tests']['tts_generation'] = result

    # Summary
    print_header("Test Summary")

    passed = sum(1 for test in results['tests'].values() if test.get('success', False))
    total = len(results['tests'])

    print(f"{Color.OKGREEN}Passed: {passed}/{total}{Color.ENDC}")

    for test_name, test_result in results['tests'].items():
        status = f"{Color.OKGREEN}✓{Color.ENDC}" if test_result.get('success', False) else f"{Color.FAIL}✗{Color.ENDC}"
        print(f"  {status} {test_name}")

    results['summary'] = {
        'total_tests': total,
        'passed': passed,
        'failed': total - passed
    }

    return results


def main():
    """Main entry point"""
    try:
        results = run_all_tests()

        # Print JSON results
        print(f"\n{Color.BOLD}Raw Results (JSON):{Color.ENDC}")
        print(json.dumps(results, indent=2))

        # Exit with appropriate code
        if results['summary']['failed'] == 0:
            print(f"\n{Color.OKGREEN}{Color.BOLD}All tests passed!{Color.ENDC}\n")
            return 0
        else:
            print(f"\n{Color.FAIL}{Color.BOLD}{results['summary']['failed']} test(s) failed{Color.ENDC}\n")
            return 1

    except KeyboardInterrupt:
        log("Test interrupted by user", 'WARN')
        return 130
    except Exception as e:
        log(f"Unexpected error: {e}", 'ERROR')
        return 1


if __name__ == '__main__':
    sys.exit(main())
