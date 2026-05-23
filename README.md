# Smart Display Dashboard

Ambient Raspberry Pi 5 smart-display prototype focused on a calmer home-assistant-style experience:

- fullscreen time and date
- premium ambient photography
- ZIP-based weather
- Home Assistant surface
- voice assistant status and controls

The app is designed to run as a kiosk display on a Raspberry Pi while staying reachable from another machine on the LAN during development.

## Current product focus

Implemented now:

- Ambient home screen with large clock and slow high-resolution photo rotation
- Weather page with fixed ZIP save flow and polished loading/error/empty states
- Home Assistant page with real connection surface and live/stubbed entity summary
- Assistant page with browser mic testing, transcript preview, sleep/privacy mode, Ollama connectivity, and Pi-local voice controls
- Expanded settings page for appearance, ambient photos, weather, Home Assistant, assistant, microphone, backend, kiosk, and debug controls
- Runtime config and local preference persistence
- HTTPS dev option for browser microphone testing

Stubbed / future:

- On-device Whisper service integration outside the bundled Pi voice bridge
- Home Assistant entity controls and service calls
- Calendar module, hidden from the main product by default
- richer TTS provider options beyond Piper-on-Pi

## Stack

- SvelteKit
- TypeScript
- Node.js 22+

## Run locally

```bash
npm install
npm run dev
```

The dev server binds to:

```text
http://0.0.0.0:8989
```

Production-style local run:

```bash
npm install
npm run build
npm run start
```

## HTTPS for browser mic testing

If you open the Pi from another machine and want browser microphone access, HTTPS is usually required.

Create a self-signed dev cert:

```bash
npm run cert:dev
```

You can override the hostnames/IPs included in the certificate:

```bash
DEV_CERT_HOSTS=localhost,127.0.0.1,192.168.1.50,raspberrypi.local npm run cert:dev
```

Then run the app over HTTPS:

```bash
DEV_HTTPS=true npm run dev
```

Default certificate paths:

```text
.cert/dev-cert.pem
.cert/dev-key.pem
```

If needed, override them with:

```text
DEV_HTTPS_CERT_FILE
DEV_HTTPS_KEY_FILE
```

Trust the generated certificate in your browser or operating system for smoother local testing.

## Configuration

Copy the example env file if you want to override server defaults:

```bash
cp .env.example .env
```

Key values:

```text
OLLAMA_BASE_URL=http://llm-server:11434
OLLAMA_MODEL=llama3.2:3b
HOME_ASSISTANT_BASE_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=...
```

Notes:

- The UI settings page can store a preferred Ollama URL and model for the assistant surface.
- The server-side default still comes from env.
- Home Assistant live authenticated access currently uses env for the token.
- Weather location is stored locally in the browser/device settings using a 5-digit ZIP code.

## Sleep / privacy mode

Sleep mode is a real user-facing state in this prototype.

When sleep mode is on:

- passive listening is treated as disabled
- wake-word behavior is disabled
- the UI shows that the assistant is asleep
- push-to-talk can remain available only if `allow push-to-talk while asleep` is enabled in Settings

You can toggle sleep mode from:

- Home
- Assistant
- Settings

## Voice architecture

The intended split stays consistent with the Pi kiosk direction:

- On the Pi:
  - audio capture
  - wake-word / push-to-talk orchestration
  - Whisper transcription service
  - UI rendering
- On the backend:
  - Ollama inference at `http://llm-server:11434`

The current implementation already has modular boundaries for:

- audio capture provider
- transcription provider
- LLM provider
- Pi-local speech provider

Browser mic mode exists for development from another machine. Pi-local mode remains the target production path.

The structure is inspired by the Pi-side capture / transcription split used in:

- https://github.com/brenpoly/be-more-agent

When `PI_VOICE_SERVICE_ENABLED=true`, the app can use a local bridge adapted from that project for:

- wake-word wait on the Pi microphone
- adaptive Pi-local recording
- `whisper.cpp` transcription
- Piper speech playback on the Pi speaker

## Home Assistant status

The Home Assistant page is now a first-class surface instead of a placeholder.

Current behavior:

- If `HOME_ASSISTANT_BASE_URL` and `HOME_ASSISTANT_TOKEN` are configured, the app attempts a live Home Assistant API summary.
- If not configured, the UI shows a clean stubbed connection model and future-ready entity cards.

This keeps the product centered on Home Assistant without pretending unfinished live controls already exist.

## Ambient photos

Bundled high-resolution photos live in:

```text
static/photos/curated
```

The manifest lives in:

```text
src/lib/data/ambient-photos.ts
```

Recommended sizes:

- preferred: `3840x2160` or larger
- minimum accepted by the app: `2560x1440`
- preferred aspect ratios: `16:9`, `3:2`, or similarly wide landscape framing

Images below the fullscreen threshold, below roughly 3.6 megapixels, or too square for clean landscape cover-cropping are skipped automatically.

Default ambient behavior:

- photo duration: 4 minutes
- fade duration: 3.6 seconds
- very subtle Ken Burns-style motion at roughly `1.03x` over the full display duration
- next image preload before each transition
- double-buffered crossfade between current and next photo

## Main routes

- `/` home ambient display
- `/weather`
- `/home-assistant`
- `/assistant`
- `/settings`

API routes:

- `GET /api/runtime`
- `GET /api/weather`
- `GET /api/home-assistant`
- `GET /api/status`
- `GET /api/assistant/health`
- `POST /api/assistant/session`
- `POST /api/assistant/transcribe`

## Project structure

```text
src/
  lib/
    components/   reusable UI surfaces
    config/       shared runtime defaults
    services/     client-side fetchers, preferences, browser voice helpers
    server/       provider adapters and integration boundaries
    utils/        formatting and helper utilities
  routes/
    api/          local API and integration routes
    assistant/    assistant control surface
    home-assistant/
    settings/
    weather/
static/
  photos/
    curated/      bundled ambient photography
scripts/
  generate-dev-cert.sh
```

## Design direction

This app should feel like a premium smart-home display, not an admin panel:

- ambient and photographic first
- readable from across a room
- touch-friendly
- calm and understated
- practical settings
- clear integration boundaries for Pi-local services and remote inference

See [AGENTS.md](./AGENTS.md) for repo-specific contributor guidance.
