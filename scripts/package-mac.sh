#!/usr/bin/env bash
# Build a self-contained, double-clickable macOS app (UI + backend + Java runtime).
# Output: dist-app/Atlas-<version>.dmg — share the DMG; recipients need nothing installed.
#
# Works even where Maven can't reach a repository (e.g. enterprise machines locked to
# an unreachable Artifactory): it falls back to the committed prebuilt/atlas-dashboard.jar,
# which already has the UI embedded.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="1.0.0"
STAGE="dist-app/stage"
JAR="atlas-dashboard.jar"

build_jar() (
  # subshell + set -e so any failing step aborts the whole build attempt
  set -e
  echo "▸ 1/4 building frontend"
  cd frontend && { npm ci --silent 2>/dev/null || npm install --silent; } && npx vite build && cd ..

  echo "▸ 2/4 embedding UI into the backend"
  rm -rf backend/src/main/resources/static
  mkdir -p backend/src/main/resources/static
  cp -R frontend/dist/* backend/src/main/resources/static/

  echo "▸ 3/4 building fat jar"
  # -s settings-public.xml goes straight to Maven Central, bypassing any corporate
  # Artifactory mirror configured in ~/.m2/settings.xml. NOTE: if the network blocks
  # Maven Central entirely (mvnw can't even download Maven), this fails and the
  # prebuilt jar below is used instead.
  cd backend && ./mvnw -q -s .mvn/settings-public.xml package -DskipTests
)

rm -rf dist-app
mkdir -p "$STAGE"

# SKIP_BUILD=1 ./scripts/package-mac.sh → go straight to the committed prebuilt jar
if [ "${SKIP_BUILD:-0}" != "1" ] && build_jar; then
  cp backend/target/atlas-dashboard-*.jar "$STAGE/$JAR"
  # keep the committed fallback fresh for machines that can't build
  cp "$STAGE/$JAR" prebuilt/atlas-dashboard.jar
else
  echo
  echo "⚠ build failed — falling back to the committed prebuilt jar (UI already embedded)"
  [ -f prebuilt/atlas-dashboard.jar ] || { echo "✗ prebuilt/atlas-dashboard.jar missing"; exit 1; }
  cp prebuilt/atlas-dashboard.jar "$STAGE/$JAR"
fi

echo "▸ 4/4 packaging Atlas.app + DMG (bundles a Java runtime — nothing to install)"
jpackage \
  --type dmg \
  --name Atlas \
  --app-version "$VERSION" \
  --input "$STAGE" \
  --main-jar "$JAR" \
  --java-options "-Dspring.profiles.active=desktop" \
  --dest dist-app
rm -rf "$STAGE"

echo
echo "✓ dist-app/Atlas-$VERSION.dmg"
echo "  Share the DMG. Recipient: open it, put Atlas anywhere (~/Applications, Desktop…),"
echo "  approve the unsigned app once (Privacy & Security → Open Anyway), and the"
echo "  dashboard opens itself."
