# Rajify

A focused music discovery experience available as a **React web app**, an **Electron Windows app (.exe)**, and a **native Flutter Android app (.apk)**, powered by YouTube and Supabase.

## Live app

### [Open Rajify](https://rajaudios.vercel.app)

## Windows EXE download

### [Download Rajify for Windows](https://github.com/rajeshravi2004/RajAudios/releases/download/flutter-v1.1.0-preview.2/rajify-windows-setup.exe)

Windows x64 installer, version 1.1.0. Build it locally with `npm run electron:build:win`; the installer is written to `release/`. Installed copies use the hosted music API, with no developer API-key file required.

## Flutter Android app & APK download

### [Download Rajify Android APK](https://github.com/rajeshravi2004/RajAudios/releases/download/flutter-v1.1.0-preview.2/rajify-android.apk)

Direct download, no GitHub sign-in required. Android 7.0+; approximately 59 MB.
This preview uses test signing. [Release notes and checksum](https://github.com/rajeshravi2004/RajAudios/releases/tag/flutter-v1.1.0-preview.2).

Rajify also has a **Flutter version** in [`flutter/`](flutter/). Discovery, search,
trending, playlists, likes, listening history, queue controls, settings, and account
administration are built with native Flutter widgets. The app uses the existing
Rajify API; only YouTube playback uses an embedded YouTube player.

The mobile player starts in **Song mode** with a compact bottom bar. Tap it for
artwork, seeking, shuffle, repeat, volume, and queue controls. Choose **Video**
to watch. Android media controls support background and lock-screen listening.

- **Development builds:** open [Flutter Android APK builds](https://github.com/rajeshravi2004/RajAudios/actions/workflows/flutter-apk.yml), select a successful run, and download **rajify-android-apk** under **Artifacts**. GitHub sign-in is required for these temporary build artifacts; use the direct APK link above for the published preview.
- **Versioned downloads:** signed Android releases appear under [GitHub Releases](https://github.com/rajeshravi2004/RajAudios/releases) when an `android-v*` tag is published with release signing configured.
- **Build locally:** `cd flutter`, then `flutter pub get` and `flutter build apk --release --dart-define-from-file=config/production.json`. The APK is at `flutter/build/app/outputs/flutter-apk/app-release.apk`.
- **Setup and platform details:** see the [Flutter README](flutter/README.md), including Google OAuth callback setup, signing, and Android audio limitations.

Likes, playlists, and history stay on each device, matching the web app's local
library model. Signed-in preferences sync between the web, desktop, and Flutter
apps. Android uses the phone's Bluetooth/media output settings; the Windows
multi-output audio router is a desktop feature.

## Editing playlists

On web, Windows, and Android, open one of your playlists and choose **Add songs** to search and add music. Use the visible **Remove from playlist** action beside a song to remove it. You can also use **Add to playlist** on a song or in the player, choose an existing playlist, or create one. Duplicate songs are prevented and edits are saved locally. YouTube-curated playlists can be saved into your own library before editing.

## Highlights

- Google OAuth with Supabase Auth
- Cross-device preference sync for signed-in listeners
- Owner-only user administration with server-side authorization
- Multilingual music discovery, search, playlists, likes, history, and queue management
- Audio and video playback modes powered by the YouTube player
- Session-only personal YouTube API key fallback
- Installable Electron desktop build
- Native Flutter Android version with downloadable APK builds
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
| Android | Flutter + Dart | Native mobile discovery, library, player controls, and APK distribution |

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

Open **Settings → Bluetooth & shared listening** on the website or Windows app.
Use **Connect Bluetooth**, follow the device-settings pairing steps, then **Find
audio devices** and select the first output. Use **Connect next Bluetooth** for
another pair, refresh and select its output, choose a song, then **Sync & play**.
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
On supported desktop Chrome/Edge browsers in a regular (non-incognito) window,
**Sync & play** is a normal link that opens an audio tab. Click **Share Rajify audio**,
select the original Rajify music tab, and enable **Share tab audio**.
Keep the audio tab open while listening. No pop-up permission prompt is needed.
The tabs communicate over a same-origin BroadcastChannel with a unique session
token; setup does not depend on `window.open()` or `window.opener`. Capture Handle
verifies the original tab, and local-playback suppression prevents duplicate
audio. Screen/system capture, the output window, and unrelated tabs are rejected.
The video track is never displayed, recorded, or uploaded. Closing either window,
source navigation, revoked capture, and detected output disconnects stop sharing.
The browser requests a small (at most 320×180, 1 fps) video track to reduce unused
capture work. Audio outputs request 120 ms of render buffering for scheduling
headroom, and temporary audio-context interruptions attempt to resume the existing
stream. The browser chooses the actual buffer size; Bluetooth and internet stalls
can still occur. A YouTube buffering message identifies source playback pauses,
which output buffering cannot repair. Extra delay controls only align outputs.

The browser's Find audio devices button requests output access. On browsers that
require microphone permission to reveal outputs, the microphone is immediately
stopped; it is never recorded, uploaded, or used as the playback source. The UI
explains this before requesting permission. Device settings handle Bluetooth
pairing; Web Bluetooth does not pair audio headsets. Unsupported/mobile browsers
show pairing instructions and explain why Sync & play is unavailable.

Browser tests cover the real adapter, audio tab and Web Audio graph with simulated
device permissions and capture-picker results, plus a native Chromium tab-capture
check. They cover distinct outputs, timing updates, wrong-tab/no-audio rejection,
permission denial, blocked script pop-ups, opener isolation, cancellation and tab-close cleanup.

`npm run test:desktop` checks the actual Electron bridge and audio graph using a
generated stereo signal, with output gains at zero. It verifies mono/stereo mixing,
pause, per-output configuration, failed starts, disconnect cleanup, source reload,
and IPC origin checks. It uses up to two available physical outputs and skips the
hardware test if none are available; it does not establish two-headset Bluetooth
reliability or measured acoustic synchronization.

## License

MIT
