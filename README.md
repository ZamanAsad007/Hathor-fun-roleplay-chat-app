# Hathor (Roleplay Chat App)

A specialized roleplay chat application featuring Hathor, an ancient deity persona whose temperament evolves dynamically based on user interaction heat and tone.

## Architecture

```
Expo App (Android APK)
   │  HTTPS + headers: x-app-secret, Authorization: Bearer <anon user JWT>
   ▼
Supabase Edge Function /chat (Deno, holds LLM key + heat logic)
   │                │
   ▼                ▼
LLM API (Gemini)    Postgres (messages, chat_state, daily_usage)
```

### Core Principles
- **Protected Secrets**: LLM keys and service role keys live exclusively in Supabase backend secrets and are never exposed in the client.
- **Server-driven State**: Heat computation, daily message quotas, and chat memory summarization are executed securely in Supabase Edge Functions.
- **Dynamic Persona**: Hathor's mood dynamically transitions across heat tiers (warm -> watchful -> Sekhmet).
- **Safety First**: Non-explicit romance/tension guidelines and a dedicated out-of-character `(ooc)` exit mechanism.

## Project Structure

```
├── app/                  # Expo / React Native mobile application
├── supabase/             # Supabase Edge Functions and database migrations
│   ├── functions/        # Deno edge functions (chat)
│   └── migrations/       # SQL database schemas & RLS policies
├── .env.example          # Environment variables template
└── README.md
```

## Tech Stack

- **Client**: Expo SDK (TypeScript), React Native Reanimated, React Native SVG
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Database & Auth**: Supabase PostgreSQL with Row-Level Security (RLS) & Anonymous Auth
- **AI / LLM**: Gemini Flash via unified Edge Function integration
- **Packaging**: EAS Build (preview profile APK)
- **Distribution**: GitHub Releases
