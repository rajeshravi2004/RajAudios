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
```

## License

MIT
