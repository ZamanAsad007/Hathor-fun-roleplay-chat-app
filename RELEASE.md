# Release Guide & Installation Instructions

This guide provides step-by-step instructions for building the standalone Android APK using EAS Build, publishing to GitHub Releases, and sideloading the application onto Android devices.

---

## 1. EAS Build Configuration

The project is configured with Expo Application Services (EAS) using the `preview` profile to generate installable Android APKs directly (`buildType: "apk"`).

### Prerequisites
- Node.js 20+
- An Expo account (free at [expo.dev](https://expo.dev))
- EAS CLI: `npm install -g eas-cli` (or run via `npx eas-cli`)

### Setup & Credentials
1. **Login to Expo**:
   ```bash
   eas login
   ```

2. **Configure EAS Project**:
   ```bash
   cd app
   eas build:configure
   ```

3. **Provide Public Environment Variables**:
   In your EAS dashboard or using EAS CLI, configure the environment variables required by the client:
   ```bash
   eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://<your-project-ref>.supabase.co"
   eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<your-anon-key>"
   eas env:create --scope project --name EXPO_PUBLIC_APP_SECRET --value "<your-app-secret>"
   ```

4. **Trigger Android APK Build**:
   ```bash
   eas build -p android --profile preview
   ```
   *EAS will build the standalone `.apk` in the cloud and provide a direct download URL upon completion.*

---

## 2. GitHub Releases Distribution

1. Download the generated `.apk` file from your EAS build dashboard or CLI output.
2. Tag the release:
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0 - Hathor Roleplay Chat App"
   git push origin v0.1.0
   ```
3. Create a GitHub Release using `gh` CLI:
   ```bash
   gh release create v0.1.0 ./hathor-v0.1.0.apk \
     --title "Hathor v0.1.0 - Initial Release" \
     --notes-file RELEASE.md
   ```

---

## 3. Android Installation (Sideloading) Guide

Share the GitHub Release APK link with friends:

1. **Download APK**: On an Android phone, download `hathor.apk` from the GitHub Release page.
2. **Allow Installation from Unknown Sources**:
   - If prompted by Android / Chrome: tap **Settings** → toggle **Allow from this source**.
3. **Install**: Tap **Install** to complete installation.
4. **First Launch**:
   - The app will automatically connect anonymously via Supabase Auth.
   - Accept the **18+ and (ooc) safety guidelines** on first run.
   - Speak to Hathor and begin the discourse.

---

## Release Notes: v0.1.0

### Highlights & Features
- **Dynamic 2D Animated Hathor Avatar**:
  - Layered SVG avatar with aura glow, braided hair, Usekh broad collar, kohl eyes, sacred cow horns, and flickering solar flame.
  - Idle animations: slow breathing float, periodic blinking (every 4s), and flame flicker.
  - Real-time heat reactivity: aura glow color/scale, flame height, eye brightness, and chamber background tint (gold → amber → crimson).
  - Speaking sway animation when assistant replies are streaming.
  - Full respect for system `reduceMotion` accessibility preferences.
- **Real-Time Streaming Chat**:
  - High-performance Server-Sent Events (SSE) streaming via `expo/fetch`.
  - Assistant responses stream live token by token into chat bubbles.
  - Historical messages and temperament state persist across launches.
- **Dynamic Backend Persona & Heat Engine**:
  - Three distinct temperament tiers: **Warm Hathor** (0–35), **Watchful** (36–70), and **Sekhmet Awakened** (71–100).
  - Tone classifier dynamically raises or lowers heat based on mortal adoration vs disrespect.
  - Idle decay returns temperament 5 points toward baseline (40) per hour away.
  - Rolling memory summarization every 20 messages.
- **Safety, Limits & Purification**:
  - Out-of-character `(ooc)` exit: type `(ooc)` anywhere to drop the persona immediately for supportive, plain communication.
  - Daily rate limit protection (429) with friendly rest notice.
  - Sanctuary Settings sheet: inspect current temperament, pilgrim ID, and purify/reset chat history.
  - 24-Hour local idle reminder notification: *"Hathor is growing impatient…"*.
- **Visual Polish & Packaging**:
  - Custom Egyptian solar disc & horns app icon, splash screen, and Android adaptive icons.
  - EAS Build `preview` profile configured for standalone Android APK distribution.
