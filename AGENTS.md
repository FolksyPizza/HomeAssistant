# AGENTS.md

## Repo purpose

This repository is a Raspberry Pi 5 kiosk smart-display prototype. The product is intentionally focused on:

- ambient time display
- premium photography background
- ZIP-based weather
- Home Assistant integration
- voice assistant controls and status

Do not drift it back toward a generic dashboard full of unrelated status modules.

## Stack

- SvelteKit
- TypeScript
- Node.js 22+

## Core runtime expectations

- Bind the web UI to `0.0.0.0:8989`
- Keep the app lightweight enough for Raspberry Pi kiosk use
- Preserve the ambient, productized feel across pages
- Treat `http://llm-server:11434` as the default Ollama backend
- Treat the Pi as the eventual audio capture / transcription device

## Product priorities

Highest priority surfaces:

- `/`
- `/weather`
- `/home-assistant`
- `/assistant`
- `/settings`

Calendar is not a main product surface right now. It can remain feature-flagged or low-priority.

## Voice architecture guidance

Keep the architecture modular around these provider boundaries:

- audio capture provider
- transcription provider
- LLM provider
- future TTS provider

The target split is:

- Pi-local:
  - wake-word or push-to-talk orchestration
  - recording
  - Whisper transcription
- Remote:
  - Ollama inference

The browser mic path is for development only and should stay available over HTTPS.

## Home Assistant guidance

Home Assistant is the main smart-home integration surface.

- Prefer expanding the Home Assistant page and summary surfaces over reintroducing PC / 3D printer style cards
- Live authenticated Home Assistant access should use env-backed server configuration
- UI-level Home Assistant settings may store planning values, but avoid pretending unauthenticated local-only values are live backend auth

## Settings guidance

Settings should remain genuinely useful, not decorative.

Important controls that should keep working:

- weather ZIP
- Ollama URL
- Ollama model
- microphone enabled state
- sleep/privacy mode
- ambient photo timing
- Home Assistant base URL planning field
- feature toggles for unfinished modules

## Ambient design guidance

- Keep real high-resolution photography only
- Maintain slow transitions and subtle motion
- Use readability overlays carefully without flattening the photo
- Avoid admin-panel visual language

## Useful commands

```bash
npm run dev
npm run dev:https
npm run build
npm run check
npm run cert:dev
```

## Files to know

- `src/lib/services/preferences.ts`
  - persisted display settings and sleep/privacy state
- `src/lib/server/runtime.ts`
  - env-backed runtime configuration
- `src/lib/server/assistant.ts`
  - assistant health, transcription, and Ollama request boundary
- `src/lib/server/home-assistant.ts`
  - Home Assistant summary boundary
- `src/routes/home-assistant/+page.svelte`
  - main Home Assistant surface
- `src/routes/assistant/+page.svelte`
  - assistant control/status surface
- `src/routes/settings/+page.svelte`
  - product-facing settings UI

## Contributor rule of thumb

If a change makes the app feel more like a calm smart display in a home, it is probably aligned.
If a change makes it feel more like an internal tool or monitoring console, it is probably wrong.
