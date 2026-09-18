# Smart Display Dashboard

An ambient Raspberry Pi 5 smart-display prototype focused on a calm, home-assistant-style experience rather than a dense admin panel.

Core surfaces:

- Fullscreen time and date
- Premium ambient photography with slow rotation
- ZIP-based weather
- Home Assistant integration
- Voice assistant status and controls

The app runs as a kiosk display on a Raspberry Pi while remaining reachable from another machine on the LAN during development.

## Stack

- SvelteKit
- TypeScript
- Node.js 22+

## Getting started

```bash
npm install
npm run dev
```

The dev server binds to `http://0.0.0.0:8989`.

Production-style local run:

```bash
npm run build
npm run start
```

Useful checks:

```bash
npm run check
```

## Configuration

Copy the example env file to override server defaults:

```bash
cp .env.example .env
```

Key values:

```text
OLLAMA_BASE_URL=http://llm-server:11434
OLLAMA_MODEL=llama3.2:3b
HOME_ASSISTANT_BASE_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=your-long-lived-access-token
```

Notes:

- The settings page can store a preferred Ollama URL and model; the server-side default comes from env.
- Live Home Assistant access uses the env-provided base URL and token.
- Weather location is stored on-device as a 5-digit ZIP code.

## HTTPS for browser mic testing

Browser microphone access from another machine generally requires HTTPS. Generate a self-signed dev certificate, optionally overriding the hostnames/IPs it covers:

```bash
DEV_CERT_HOSTS=localhost,127.0.0.1,raspberrypi.local npm run cert:dev
DEV_HTTPS=true npm run dev
```

Certificates default to `.cert/dev-cert.pem` and `.cert/dev-key.pem`, overridable via `DEV_HTTPS_CERT_FILE` and `DEV_HTTPS_KEY_FILE`.

## Voice architecture

The design keeps clear provider boundaries and splits work between the Pi and a remote backend:

- **On the Pi:** audio capture, wake-word / push-to-talk orchestration, Whisper transcription, and UI rendering
- **On the backend:** Ollama inference

Browser mic mode exists for development; Pi-local mode is the production target. When `PI_VOICE_SERVICE_ENABLED=true`, the app uses a local bridge for wake-word waiting, adaptive recording, `whisper.cpp` transcription, and Piper speech playback.

## Sleep / privacy mode

Sleep mode is a real user-facing state, toggleable from the Home, Assistant, and Settings surfaces. While asleep, passive listening and wake-word behavior are disabled and the UI reflects the sleeping state. Push-to-talk remains available only if explicitly allowed in Settings.

## Ambient photos

Bundled photography lives in `static/photos/curated`, with the manifest in `src/lib/data/ambient-photos.ts`.

Recommended source images:

- Preferred: `3840x2160` or larger; minimum `2560x1440`
- Wide landscape framing (`16:9`, `3:2`, or similar)

Images below the fullscreen threshold (~3.6 MP) or too square for clean cover-cropping are skipped. Default behavior uses a 4-minute duration per photo, a 3.6-second crossfade, and subtle Ken Burns-style motion with next-image preloading.

## Routes

Product surfaces:

- `/` — home ambient display
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
    assistant/
    home-assistant/
    settings/
    weather/
static/
  photos/curated/ bundled ambient photography
scripts/
  generate-dev-cert.sh
```

## License

See [LICENSE](./LICENSE).
