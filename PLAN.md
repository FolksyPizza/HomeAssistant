# Smart Display — Feature Plan

## Vision
A Google Nest Hub–style ambient smart display running on Raspberry Pi.
Full-screen ambient photo background at all times; content panels slide in as overlays.

---

## Phase 1 — Foundation (Critical UX)

### 1.1 Persistent Ambient Photo
- [ ] Move `AmbientBackdrop` to `+layout.svelte` so it never unmounts on route change
- [ ] Remove `AmbientBackdrop` from individual page files
- [ ] Body/page backgrounds become transparent overlays over the photo

### 1.2 Google Home Show–Style Overlay UI
- [ ] All pages render as dark semi-transparent overlay panels over the persistent photo
- [ ] Swipe left/right cycles pages (already done via layout)
- [ ] Content panels anchor to bottom of screen, photo always visible above
- [ ] Smooth slide-in animation when navigating between pages
- [ ] Edge arrows for prev/next navigation (already done)

### 1.3 Setup Wizard (First-Run Experience)
- [ ] Route: `/setup` — full-screen wizard on first boot
- [ ] Step 1: Welcome + user's display name
- [ ] Step 2: Location (ZIP code for weather)
- [ ] Step 3: Google Calendar OAuth
- [ ] Step 4: Optional — Home Assistant URL + token
- [ ] Step 5: Done / launch dashboard
- [ ] Detectable by `preferences.user.setupComplete` flag
- [ ] Accessible again from Settings → "Re-run Setup Wizard"

### 1.4 User Profile in Preferences
- [ ] Add `user: { name: string; setupComplete: boolean }` to `DisplayPreferences`
- [ ] Show name in greeting on home screen ("Good morning, William")
- [ ] Editable from Settings

---

## Phase 2 — Google Calendar Integration

### 2.1 Google OAuth2 Flow
- [ ] Server route: `GET /api/calendar/oauth/start` — redirects to Google consent page
- [ ] Server route: `GET /api/calendar/oauth/callback` — exchanges code for tokens
- [ ] Token storage: `data/google-tokens.json` on Pi (gitignored)
- [ ] Token refresh: auto-refresh access token when expired using refresh token
- [ ] Settings → Calendar → "Connect Google Calendar" button

### 2.2 Calendar Data
- [ ] Server route: `GET /api/calendar/google` — fetches events from Google Calendar API
- [ ] Fetch events from primary calendar + all subscribed calendars
- [ ] Map Google events to existing `CalendarEvent` type
- [ ] Cache responses for 5 minutes (reduce API calls)
- [ ] Update `calendar/+page.svelte` to use real Google events
- [ ] Fall back to local/mock events if Google not connected

### 2.3 Calendar Display
- [ ] Today's events highlighted on home screen overlay
- [ ] Next event shown in bottom-left with clock on home screen
- [ ] Full agenda view on Calendar page
- [ ] Color-coded by calendar

---

## Phase 3 — Home Screen Widgets / Favorites

### 3.1 Widget System
- [ ] Widget types: Clock+Date, Weather, Next Event, Voice Command, Timers, Home Assistant device
- [ ] Settings → Favorites → drag-to-reorder widget list
- [ ] Widgets render as cards in a configurable grid on home screen
- [ ] Store widget config in `preferences.widgets[]`

### 3.2 Built-in Widgets
- [ ] **Weather Summary**: current temp, icon, high/low
- [ ] **Next Event**: next calendar event with countdown
- [ ] **Quick Actions**: timers, alarms, reminders shortcuts
- [ ] **Home Assistant**: entity state tiles (lights, switches, sensors)
- [ ] **News Ticker**: RSS feed headlines
- [ ] **Spotify Now Playing**: current track (requires Spotify OAuth)

---

## Phase 4 — Voice Control

### 4.1 Wake Word Detection (already partially implemented)
- [ ] Verify `pi_voice_bridge.py` wake-word loop works end-to-end
- [ ] Display visual indicator when listening
- [ ] "Hey Display" or custom wake word

### 4.2 Voice Commands
- [ ] "What's the weather?" → speak + show weather overlay
- [ ] "Show my calendar" → navigate to calendar
- [ ] "Set a timer for X minutes" → launch timer widget
- [ ] "Turn on/off [device]" → Home Assistant command
- [ ] "Add to my calendar: [event]" → create calendar event
- [ ] "What's next on my calendar?" → read next event

### 4.3 TTS Responses
- [ ] Piper TTS already wired in
- [ ] Response spoken + shown as text overlay
- [ ] Visual mouth/wave animation while speaking

---

## Phase 5 — Smart Home Integration

### 5.1 Home Assistant
- [ ] Already has HA config in preferences
- [ ] Show entity states on home screen widget
- [ ] Toggle lights/switches from display
- [ ] Temperature sensors on home screen

### 5.2 Timers & Alarms
- [ ] Client-side timer widget
- [ ] Visual + audio alarm (TTS "your timer is done")
- [ ] Manage multiple timers

### 5.3 System Info Widget
- [ ] Pi CPU temp, memory usage
- [ ] Network status
- [ ] Last assistant interaction

---

## Phase 6 — Polish & Settings

### 6.1 Settings Redesign
- [ ] Organized into sections: Profile, Appearance, Location, Calendar, Voice, Smart Home, Developer
- [ ] All setup wizard fields editable here
- [ ] Google Calendar: show connected account, disconnect button
- [ ] Widget favorites configuration

### 6.2 Appearance
- [ ] Light/dark theme (already done)
- [ ] Ambient photo categories (already done)
- [ ] Photo transition speed
- [ ] Clock size/position

### 6.3 Accessibility
- [ ] High contrast mode
- [ ] Large text mode
- [ ] Reduce motion

---

## Implementation Order

| Priority | Item | Status |
|----------|------|--------|
| 1 | Persistent ambient photo (layout-level backdrop) | ⬜ |
| 2 | Add user name + setupComplete to preferences | ⬜ |
| 3 | Setup wizard `/setup` route | ⬜ |
| 4 | Overlay-style page UI (Google Home Show) | ⬜ |
| 5 | Google Calendar OAuth server routes | ⬜ |
| 6 | Google Calendar event fetching + display | ⬜ |
| 7 | Home screen: greeting + next event widget | ⬜ |
| 8 | Widgets/Favorites system in settings | ⬜ |
| 9 | Voice command routing | ⬜ |
| 10 | Home Assistant entity tiles | ⬜ |

---

## Environment & Config

- Pi runs SvelteKit via `npm run start` on port 8989
- `.env` loaded via `--require dotenv/config`
- Google OAuth: needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `.env`
- Token storage: `data/google-tokens.json` (gitignored, never committed)
- Push after each phase: `git@pi-server:william/HomeAssistant.git` origin main
