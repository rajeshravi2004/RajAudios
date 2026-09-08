# Rajify

A focused music discovery experience built with React, Electron, YouTube Data API, and Supabase.

## Live app

### [Open Rajify](https://rajaudios.vercel.app)

## Highlights

- Google OAuth with Supabase Auth
- Cross-device preference sync for signed-in listeners
- Owner-only user administration with server-side authorization
- Multilingual music discovery, search, playlists, likes, history, and queue management
- Audio and video playback modes powered by the YouTube player
- Session-only personal YouTube API key fallback
- Installable Electron desktop build
- Shared listening on Windows: select multiple audio outputs, with mono audio, per-output volume, and timing adjustment

## Security model

- Shared YouTube credentials stay in Vercel server environment variables.
- Personal YouTube API keys are validated and kept only in JavaScript memory. They are never written to localStorage, sessionStorage, cookies, IndexedDB, Supabase, or Git.
- Admin endpoints verify the current Supabase access token on every request.
- Only the configured owner email can list or delete users.
- The owner account cannot delete itself and is protected during bulk deletion.
- Supabase Row Level Security limits profile and preference rows to their owner.

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Web UI | React 19 + Vite | Discovery, library, playback, settings |
| Authentication | Supabase Auth + Google OAuth | Sessions and account identity |
| Database | Supabase Postgres | Profiles and synced preferences |
| Server API | Vercel Functions | Protected YouTube proxy and owner administration |
| Desktop | Electron | Native Windows application |

## Local development

```bash
npm install
```

Copy `.env.example` to `.env` and configure the required values. Use the Supabase project URL and publishable key in the browser; never expose the Supabase secret key with a `VITE_` prefix.

For the complete web stack, including Vercel API functions:

```bash
vercel dev
```

For the Electron development build:

```bash
npm run electron:dev
```

## Supabase setup

Apply the included schema migration:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Enable Google in Supabase Authentication providers, add the production site URL to the redirect allow list, and configure the Google OAuth client ID and secret in the Supabase dashboard.

## Available scripts

```bash
npm run dev                 # Vite frontend
npm run build               # Production web build
npm run lint                # ESLint checks
npm run test:e2e            # Playwright browser smoke tests
npm run electron:dev        # Electron development
npm run electron:build:win  # Windows installer
npm run test:desktop        # Real Electron audio-routing integration (Windows)
```

## Bluetooth & shared listening

In the Windows desktop app, open **Settings → Bluetooth & shared listening**.
Use **Connect Bluetooth** to pair and connect each pair of earbuds in Windows,
then **Refresh devices**, select the outputs, choose a song, and **Start sharing**.
With two pairs and **One earbud each (mono audio)** enabled, four people can each
use one earbud and hear both channels of the song. One to eight distinct outputs
can be selected; the Bluetooth adapter and drivers determine how many work at once.

Volume and extra delay can be adjusted while sharing. The router compensates for
reported output latency; if one pair still sounds ahead, add delay to that pair.
Independent Bluetooth hardware adds latency and may drift, so this is best-effort
shared listening, not guaranteed sample-accurate synchronization. Two real pairs
must be tested together before relying on a particular laptop/headset combination.

The existing YouTube player remains the single playback source, so play, pause,
seek, volume, and track changes apply to every output. Electron captures only the
Rajify window and suppresses its original local playback. A separate sandboxed,
hidden window sends that stream to the chosen outputs; keeping capture and output
in different windows prevents feedback. No microphone or system-audio loopback is
used. The required capture video track is not displayed, recorded, or transmitted.

Stopping sharing, leaving the app, reloading, or a detected output disconnect
releases capture and restores normal system-selected playback. Device choices and
sharing state are session-only and are never cloud-synced or automatically restarted.
The browser/PWA explains the desktop requirement and continues normal system audio
playback. Pairing is managed by Windows, rather than Web Bluetooth.

`npm run test:desktop` checks the actual Electron bridge and audio graph using a
generated stereo signal, with output gains at zero. It verifies mono/stereo mixing,
pause, per-output configuration, failed starts, disconnect cleanup, source reload,
and IPC origin checks. It uses up to two available physical outputs and skips the
hardware test if none are available; it does not establish two-headset Bluetooth
reliability or measured acoustic synchronization.

## License

MIT
