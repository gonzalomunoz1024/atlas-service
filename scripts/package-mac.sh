#!/usr/bin/env bash
# Build a self-contained, double-clickable macOS app (UI + backend + Java runtime).
# Output: dist-app/Atlas-<version>.dmg — share the DMG; recipients need nothing installed.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="1.0.0"
JAR="atlas-dashboard-0.0.1-SNAPSHOT.jar"

echo "▸ 1/4 building frontend"
(cd frontend && npm ci --silent 2>/dev/null || npm install --silent; npx vite build)

echo "▸ 2/4 embedding UI into the backend"
rm -rf backend/src/main/resources/static
mkdir -p backend/src/main/resources/static
cp -R frontend/dist/* backend/src/main/resources/static/

echo "▸ 3/4 building fat jar"
(cd backend && ./mvnw -q package -DskipTests)

echo "▸ 4/4 packaging Atlas.app + DMG (bundles a Java runtime — nothing to install)"
rm -rf dist-app
mkdir -p dist-app
jpackage \
  --type dmg \
  --name Atlas \
  --app-version "$VERSION" \
  --input backend/target \
  --main-jar "$JAR" \
  --java-options "-Dspring.profiles.active=desktop" \
  --dest dist-app

echo
echo "✓ dist-app/Atlas-$VERSION.dmg"
echo "  Share the DMG. Recipient: open it, drag Atlas to Applications (or run in place),"
echo "  then RIGHT-CLICK → Open on first launch (unsigned app). The dashboard opens itself."
