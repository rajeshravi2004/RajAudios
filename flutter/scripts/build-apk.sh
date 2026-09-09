#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
config="${1:-config/production.json}"
flutter pub get
flutter analyze
flutter test
flutter build apk --release --dart-define-from-file="$config"
mkdir -p ../downloads
cp build/app/outputs/flutter-apk/app-release.apk ../downloads/rajify-android-release.apk
if command -v sha256sum >/dev/null; then
  (cd ../downloads && sha256sum rajify-android-release.apk > rajify-android-release.apk.sha256)
else
  (cd ../downloads && shasum -a 256 rajify-android-release.apk > rajify-android-release.apk.sha256)
fi
echo "APK ready: $(cd ../downloads && pwd)/rajify-android-release.apk"
if [[ ! -f android/key.properties ]]; then
  echo 'This APK uses debug signing for testing. Configure android/key.properties for stable release signing.'
fi
