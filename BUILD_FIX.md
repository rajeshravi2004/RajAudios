# Fix for Black Screen Issue

## Problem
After building the EXE, the app shows only a black screen.

## Solution

The issue has been fixed in the code. Please follow these steps:

1. **Clean previous builds:**
   ```bash
   rm -rf dist
   rm -rf release
   ```

2. **Rebuild the application:**
   ```bash
   npm run electron:build:win
   ```

## What was fixed:

1. **Path Resolution**: Updated `electron/main.js` to properly find the `index.html` file in production builds
2. **Base Path**: Changed Vite config to use `./` as base path for Electron builds
3. **Error Handling**: Added better error handling and logging to help debug issues
4. **File Loading**: Added multiple path fallbacks to find the dist folder

## If the issue persists:

1. Open the built EXE
2. Press `Ctrl+Shift+I` to open DevTools
3. Check the Console tab for error messages
4. The console will show which paths were tried and any errors

## Common Issues:

- **Missing dist folder**: Make sure `npm run build` completes successfully before running electron-builder
- **Path issues**: The app now tries multiple paths automatically
- **CORS errors**: Web security has been disabled for Electron builds

