# ☥ Hathor: Sacred Roleplay & Dynamic Temperament AI

[![Release](https://img.shields.io/github/v/release/ZamanAsad007/Hathor-fun-roleplay-chat-app?color=D4AF37&label=Release)](https://github.com/ZamanAsad007/Hathor-fun-roleplay-chat-app/releases/latest)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-58.0-black?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react)](https://reactnative.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Edge_Functions-3ECF8E?logo=supabase)](https://supabase.com)
[![Groq](https://img.shields.io/badge/LLM-Groq_%7C_Gemini-F55036)](https://groq.com)
[![Platform](https://img.shields.io/badge/Platform-Android_%7C_Web-orange)](#installation)

An immersive mythological chat application featuring **Hathor**, the ancient Egyptian deity of sky, joy, love, beauty, music, and the Eye of Ra. Her temperament and visual manifestation dynamically evolve based on mortal speech—ranging from benevolent indulgence to the scorching wrath of the slaughtering lioness **Sekhmet**.

---

## ✨ Key Features

### 🎭 Living 2D Animated Avatar
- **Layered SVG Architecture**: Custom Egyptian cow horns, blazing solar disc, Usekh broad collar, braided headdress, and kohl-lined eyes.
- **Natural Idle Loops**: Gentle breathing float, natural eye-blinking cycles (every 4s), and organic solar flame flickering.
- **Reactive Mood Transitions**: Real-time morphing between three expressive states:
  - **Warm**: Indulgent smile and radiant golden aura (`#F59E0B`).
  - **Watchful**: Arched brow smirk and intense amber glare (`#EA580C`).
  - **Sekhmet Wrath**: Scorching crimson aura (`#DC2626`), predatory slit pupils, and sharp snarling fangs.
- **Speaking Sway**: Subtle rhythmic body sway while streaming dialogue.
- **Accessibility**: Full adherence to system `reduceMotion` preferences.

### ⚡ Real-Time Streaming & AI Intelligence
- **Token-by-Token Streaming**: Server-Sent Events (SSE) via `expo/fetch` for instant, typewriter-style responses.
- **Multi-Provider AI Core**: Seamless backend support for **Groq** (`qwen/qwen3.8-27b`, Llama 3), **Google Gemini** (`gemini-2.0-flash`), **Anthropic Claude**, and **OpenAI**.
- **Contextual Persona Engine**: Built-in fallback engine that analyzes user tone, intent, and heat state to prevent canned or repetitive dialogue even during offline/limited mode.

### 🔥 Dynamic Temperament Engine
- **Tone Classification**: Disrespect, mockery, or insults push the heat meter toward wrath (+5 to +10 per turn); adoration, humility, and offerings soothe her temper (-3 to -10).
- **Idle Heat Decay**: When mortals leave the sanctuary, Hathor's temperament gradually cools back toward baseline (40) at a rate of 5 points per hour.
- **Rolling Memory Summarization**: Automatically condenses conversation history every 20 messages into persistent narrative memory.

### 📜 Immersive Dialogue Formatting
- **Atmospheric Stage Directions**: Hathor's physical gestures, gaze shifts, and sacred temple ambiance are formatted in **shimmering gold italics** prefixed with the sacred ankh (`☥`).
- **Spoken Words**: Spoken dialogue renders in crisp white text for effortless reading.
- **Adaptive Layout**: Header collapses into a compact row while typing so the input bar always remains visible above the keyboard.

### 🔊 Voice Narration (TTS)
- **Audio Playback**: Tap the speaker icon on any assistant message to hear Hathor speak.
- **Mood Modulation**: Automatically alters speech pitch and rate depending on whether she is amused, watchful, or furious.
- **Direct Speech Filter**: The voice engine automatically omits non-verbal stage directions (`*...*`) and narrates only spoken words.

### 🛡️ Safety & Sanctuary Controls
- **Out-of-Character `(ooc)` Exit**: Type `(ooc)` anywhere to immediately pause the deity persona for respectful, plain human conversation.
- **18+ Disclaimer Modal**: Onboarding safety confirmation.
- **Sanctuary Purification**: Tap **⚙ (Settings)** to inspect pilgrim ID, live numeric heat score, or completely purge conversation memory.
- **Daily Quotas**: Server-enforced rate limiter (60 messages/day) with in-character resting notifications.

---

## 🏛️ Architecture

```
┌────────────────────────────────────────────────────────┐
│             Mobile Client (Android APK / Web)          │
│       Expo SDK 58 • React Native 0.88 • Reanimated     │
└───────────┬────────────────────────────────┬───────────┘
            │ HTTPS + x-app-secret           │ Anonymous Auth
            │ SSE text/event-stream          │ Messages & State
            ▼                                ▼
┌──────────────────────────────┐  ┌───────────────────────┐
│ Supabase Edge Function /chat │  │  Supabase Cloud (DB)  │
│      Deno Edge Runtime       │  │  PostgreSQL + RLS     │
└──────────────┬───────────────┘  └───────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│       LLM AI Providers       │
│  Groq (Qwen/Llama) • Gemini  │
└──────────────────────────────┘
```

---

## 🌡️ Temperament Tiers

| Tier | Heat Range | Persona Demeanor | Visual State | Voice Pitch |
| :--- | :--- | :--- | :--- | :--- |
| **Warm** | `0 – 35` | Indulgent, playful, generous, fond | Soft gold glow, gentle smile | 1.05 (Melodic) |
| **Watchful** | `36 – 70` | Teasing, possessive, demanding, sharp | Amber glare, arched brow smirk | 0.95 (Regal) |
| **Sekhmet** | `71 – 100` | Scorching wrath, ruthless fury, predatory | Crimson flame, slit pupils & fangs | 0.80 (Dark) |

---

## 📱 Installation & Downloads

### Download Android APK (Recommended)
Download the standalone, pre-compiled release APK directly to your Android device:
📥 **[Download Latest Hathor-v0.1.0.apk](https://github.com/ZamanAsad007/Hathor-fun-roleplay-chat-app/releases/latest)**

1. On your Android phone, download `Hathor-v0.1.0.apk`.
2. Allow installation from unknown sources if prompted.
3. Install and launch—no developer tools, Metro, or PC connection required.

---

## 🚀 Local Development

### Prerequisites
- Node.js 20+
- npm or yarn
- Supabase CLI: `npm install -g supabase`

### 1. Clone the Repository
```bash
git clone https://github.com/ZamanAsad007/Hathor-fun-roleplay-chat-app.git
cd Hathor-fun-roleplay-chat-app
```

### 2. Configure Environment Variables
Create a root `.env` file:
```env
# Supabase Backend
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# App Secret & Limits
APP_SECRET=<your-64-character-hex-secret>
DAILY_LIMIT=60

# LLM Configuration (Groq recommended)
LLM_PROVIDER=groq
LLM_MODEL=qwen/qwen3.8-27b
LLM_API_KEY=gsk_your_groq_api_key_here
GROQ_API_KEY=gsk_your_groq_api_key_here
```

Configure `app/.env` for the client:
```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_APP_SECRET=<your-64-character-hex-secret>
```

### 3. Run the Mobile / Web Client
```bash
cd app
npm install

# Start in Web Browser
npm run web

# Start with Expo Go / Dev Client
npm start
```

### 4. Deploy Supabase Edge Functions
```bash
# Push environment secrets to Supabase
npm run secrets:set

# Deploy the chat edge function
npm run functions:deploy
```

---

## 📂 Repository Structure

```
.
├── .github/workflows/
│   └── build-apk.yml           # Automated Standalone Release APK CI pipeline
├── app/                        # Expo / React Native Client
│   ├── app/
│   │   ├── _layout.tsx         # Root navigation & theme layout
│   │   └── index.tsx           # Primary sanctuary chat interface
│   ├── components/
│   │   ├── HathorAvatar.tsx    # 2D SVG animated avatar & expression engine
│   │   ├── DisclaimerModal.tsx # 18+ and OOC safety guidance sheet
│   │   └── SettingsModal.tsx   # Heat gauge & memory purification sheet
│   ├── lib/
│   │   ├── chat.ts             # SSE streaming reader & history persistence
│   │   ├── notifications.ts    # 24h idle engagement reminders
│   │   ├── speech.ts           # Dynamic Text-to-Speech voice modulator
│   │   └── supabase.ts         # Anonymous authentication & Supabase client
│   └── app.json                # Expo configuration & adaptive icon metadata
├── supabase/
│   ├── functions/chat/
│   │   ├── index.ts            # Deno SSE endpoint with auth & HMAC verification
│   │   ├── llm.ts              # Multi-provider streaming adapter (Groq/Gemini/OpenAI)
│   │   ├── heat.ts             # Tone classifier, decay, quotas & summarizer
│   │   └── persona.ts          # Core Hathor & Sekhmet system prompts
│   └── migrations/             # PostgreSQL database schemas & RLS policies
├── scripts/
│   └── rotate-secret.sh        # Zero-downtime APP_SECRET rotation utility
├── RELEASE.md                  # Comprehensive release & sideloading manual
└── package.json
```

---

## 📜 License

This project is open-source and available under the **MIT License**.
