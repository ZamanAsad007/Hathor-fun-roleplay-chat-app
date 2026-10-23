# Hathor Backend (Supabase)

This directory contains Supabase migrations, configurations, and Edge Functions for Hathor.

## Database & Security

### Tables
- `chat_state`: Stores user persona heat (0–100), memory summary, and last seen timestamp.
- `messages`: Chronological conversation history between user and Hathor.
- `daily_usage`: Daily rate limit usage tracking.

### Row Level Security (RLS)
- RLS is enabled on all tables (`chat_state`, `messages`, `daily_usage`).
- Read-own-rows policies allow authenticated users to select only their own records (`auth.uid() = user_id`).
- All insert/update/delete writes are restricted exclusively to the Edge Function via the Supabase Service Role.

