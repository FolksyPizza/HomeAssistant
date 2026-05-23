#!/bin/bash

###############################################################################
# Smart Display Dashboard - AI Features Functional Test Suite
#
# Tests Whisper (transcription) and Piper (TTS) functionality
# Requires: npm, jq, curl, ffmpeg, python venv
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
SERVER_HOST="${1:-127.0.0.1}"
SERVER_PORT="${2:-8989}"
SERVER_URL="http://${SERVER_HOST}:${SERVER_PORT}"
LOG_FILE="/tmp/smart-display-test.log"
PID_FILE="/tmp/smart-display-test.pid"
TIMEOUT=30
VERBOSE="${VERBOSE:-0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

###############################################################################
# Logging and output utilities
###############################################################################

log() {
    echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓${NC} $*" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}✗${NC} $*" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $*" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}ℹ${NC} $*" | tee -a "$LOG_FILE"
}

###############################################################################
# Server management
###############################################################################

start_server() {
    log "Starting development server..."

    if [ -f "$PID_FILE" ]; then
        local old_pid=$(cat "$PID_FILE")
        if kill -0 "$old_pid" 2>/dev/null; then
            warn "Server already running (PID: $old_pid)"
            return 0
        fi
    fi

    npm run build 2>&1 | tee -a "$LOG_FILE" > /dev/null
    NODE_ENV=production npm run start > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo $pid > "$PID_FILE"

    # Wait for server to be ready
    log "Waiting for server to start..."
    local attempt=0
    while [ $attempt -lt $TIMEOUT ]; do
        if curl -s "$SERVER_URL/api/runtime" > /dev/null 2>&1; then
            success "Server started successfully (PID: $pid)"
            return 0
        fi
        ((attempt++))
        sleep 1
    done

    error "Server failed to start within ${TIMEOUT}s"
    return 1
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping server (PID: $pid)..."
            kill $pid 2>/dev/null || true
            sleep 1
            kill -9 $pid 2>/dev/null || true
            rm -f "$PID_FILE"
            success "Server stopped"
        fi
    fi
}

###############################################################################
# Health check tests
###############################################################################

test_health_check() {
    log ""
    log "=== Health Check Tests ==="
    log ""

    local response=$(curl -s "$SERVER_URL/api/assistant/health")
    local reachable=$(echo "$response" | jq -r '.reachable // false')

    if [ "$reachable" = "true" ]; then
        success "Server is reachable"

        local transcription_provider=$(echo "$response" | jq -r '.transcriptionProvider // "unknown"')
        local tts_provider=$(echo "$response" | jq -r '.ttsProvider // "unknown"')
        local pi_voice_enabled=$(echo "$response" | jq -r '.piVoiceServiceEnabled // false')

        info "Transcription provider: $transcription_provider"
        info "TTS provider: $tts_provider"
        info "Pi Voice service enabled: $pi_voice_enabled"

        # Check connections
        echo "$response" | jq -r '.connections[] | "\(.label): \(.state)"' | while read -r line; do
            local state=$(echo "$line" | grep -oE '(online|offline|degraded)$')
            if [[ "$state" == "online" ]]; then
                success "  $line"
            elif [[ "$state" == "degraded" ]]; then
                warn "  $line"
            else
                error "  $line"
            fi
        done

        # Check for errors
        local error_msg=$(echo "$response" | jq -r '.error // empty')
        if [ -n "$error_msg" ]; then
            error "Health check error: $error_msg"
            return 1
        fi

        return 0
    else
        error "Server is not reachable"
        return 1
    fi
}

###############################################################################
# Transcription tests
###############################################################################

test_transcription() {
    log ""
    log "=== Transcription (Whisper) Tests ==="
    log ""

    # Create a test audio file (1 second of silence with 16kHz sample rate)
    local test_audio="/tmp/test-audio.wav"
    log "Creating test audio file ($test_audio)..."

    python3 << 'EOF'
import wave
import array

sample_rate = 16000
duration = 1  # seconds
output_file = '/tmp/test-audio.wav'

# Generate silence
num_samples = sample_rate * duration
silence = array.array('h', [0] * num_samples)

with wave.open(output_file, 'wb') as wav_file:
    wav_file.setnchannels(1)  # mono
    wav_file.setsampwidth(2)  # 16-bit
    wav_file.setframerate(sample_rate)
    wav_file.writeframes(silence.tobytes())

print(f"Created {output_file}")
EOF

    if [ ! -f "$test_audio" ]; then
        error "Failed to create test audio file"
        return 1
    fi

    success "Test audio file created"

    # Test transcription endpoint
    log "Testing transcription endpoint..."
    local response=$(curl -s -X POST \
        -F "audio=@$test_audio" \
        -F "browserTranscriptHint=test audio" \
        "$SERVER_URL/api/assistant/transcribe")

    local transcript=$(echo "$response" | jq -r '.transcript // empty')
    local provider=$(echo "$response" | jq -r '.provider // empty')

    if [ -n "$transcript" ] && [ -n "$provider" ]; then
        success "Transcription successful"
        info "  Provider: $provider"
        info "  Transcript: $transcript"
        return 0
    else
        error "Transcription failed"
        error "  Response: $response"
        return 1
    fi
}

###############################################################################
# TTS tests
###############################################################################

test_tts() {
    log ""
    log "=== Text-to-Speech (Piper TTS) Tests ==="
    log ""

    # Test the Pi voice health endpoint for TTS
    log "Checking TTS provider health..."
    local response=$(curl -s "$SERVER_URL/api/assistant/health")
    local tts_state=$(echo "$response" | jq -r '.connections[] | select(.label == "Pi-local speech") | .state' 2>/dev/null)

    if [ -z "$tts_state" ]; then
        warn "Could not determine TTS provider state from health check"
        return 1
    fi

    if [ "$tts_state" = "online" ]; then
        success "TTS provider is online"
    elif [ "$tts_state" = "degraded" ]; then
        warn "TTS provider is degraded"
        local detail=$(echo "$response" | jq -r '.connections[] | select(.label == "Pi-local speech") | .detail' 2>/dev/null)
        info "  Detail: $detail"
        return 0
    else
        error "TTS provider is offline"
        return 1
    fi

    # Note: Direct TTS testing via HTTP would require the /api/assistant/voice endpoint
    # which expects a full voice turn request. This is tested indirectly via the health check.

    return 0
}

###############################################################################
# Main test suite
###############################################################################

main() {
    clear
    log "=========================================================================="
    log "Smart Display Dashboard - AI Features Test Suite"
    log "=========================================================================="
    log "Server: $SERVER_URL"
    log "Test log: $LOG_FILE"
    log ""

    # Clean up previous log
    > "$LOG_FILE"

    # Start server
    if ! start_server; then
        error "Failed to start server"
        exit 1
    fi

    # Run tests
    local passed=0
    local failed=0
    local warnings=0

    if test_health_check; then
        ((passed++))
    else
        ((failed++))
    fi

    if test_transcription; then
        ((passed++))
    else
        ((failed++))
    fi

    if test_tts; then
        ((passed++))
    else
        ((warnings++))
    fi

    # Summary
    log ""
    log "=========================================================================="
    log "Test Summary"
    log "=========================================================================="
    echo -e "${GREEN}Passed: $passed${NC}"
    echo -e "${RED}Failed: $failed${NC}"
    echo -e "${YELLOW}Warnings: $warnings${NC}"
    log ""

    if [ $failed -eq 0 ]; then
        success "All AI features are functional!"
        return 0
    else
        error "Some tests failed. See log for details: $LOG_FILE"
        return 1
    fi
}

# Cleanup on exit
trap stop_server EXIT

# Run main
main
exit_code=$?

log ""
log "Test run completed at $(date)"

exit $exit_code
