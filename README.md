# Rajify - Spotify-like Music Player

A desktop music player application built with React, Electron, and YouTube API. Features a Spotify-like interface with playlists, shuffle, repeat, queue management, and more.

## Features

- 🎵 **Playlist Management**: Browse and play YouTube playlists
- 🔀 **Shuffle**: Randomize track playback
- 🔁 **Repeat**: Repeat off, all, or single track
- ❤️ **Favorites**: Save your favorite tracks
- 📋 **Queue**: Add tracks to queue for later playback
- 💾 **Cookie Storage**: All playlists, favorites, and settings saved in cookies
- 🎨 **Spotify-like UI**: Modern, dark-themed interface
- 🖥️ **Desktop App**: Built as Windows EXE using Electron

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- YouTube API Key ([Get one here](https://console.cloud.google.com/))

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd RajAudios
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```
   VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
   ```

## Development

### Run as Web App
```bash
npm run dev
```

### Run as Electron App (Development)
```bash
npm run electron:dev
```

This will start the Vite dev server and launch the Electron app.

## Building for Production

### Build Web Version
```bash
npm run build
```

### Build Windows EXE
```bash
npm run electron:build:win
```

The EXE installer will be created in the `release` folder.

## Usage

1. **Search Playlists**: Use the search bar to find playlists by language and genre
2. **Select Language**: Choose between Tamil or English music
3. **Play Playlist**: Click on any playlist to view tracks, then click "Play All" or individual tracks
4. **Control Playback**: 
   - Use shuffle to randomize tracks
   - Use repeat for off/all/one modes
   - Add tracks to queue for later
   - Save playlists for quick access
5. **Manage Library**: 
   - Save playlists to your library
   - View recently played playlists
   - Mark tracks as favorites

## Data Storage

All data is stored in browser cookies:
- Playlists and tracks
- Favorites
- Playback settings (shuffle, repeat, volume)
- Queue
- Recent playlists

## Technologies Used

- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **Electron**: Desktop app framework
- **Tailwind CSS**: Styling
- **YouTube API**: Music source
- **js-cookie**: Cookie management
- **Axios**: HTTP client

## Project Structure

```
RajAudios/
├── electron/          # Electron main process files
│   ├── main.js       # Main Electron process
│   └── preload.js    # Preload script
├── src/
│   ├── App.jsx       # Main application component
│   ├── utils/
│   │   └── cookieManager.js  # Cookie management utilities
│   └── ...
├── public/           # Static assets
└── dist/             # Build output
```

## License

MIT
