/**
 * Hathor Heat Engine & Memory Summarizer
 * Handles idle heat decay, tone classification, daily usage quotas, and rolling memory summarization.
 */

import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getHeatMode } from "./persona.ts";

/**
 * Calculates idle heat decay towards baseline (40) by 5 points per elapsed hour.
 */
export function calculateIdleDecay(currentHeat: number, lastSeen: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffHours = Math.max(0, diffMs / (1000 * 60 * 60));
  const fullHours = Math.floor(diffHours);

  if (fullHours <= 0) return currentHeat;

  const totalDecay = fullHours * 5;
  let decayedHeat = currentHeat;

  if (decayedHeat > 40) {
    decayedHeat = Math.max(40, decayedHeat - totalDecay);
  } else if (decayedHeat < 40) {
    decayedHeat = Math.min(40, decayedHeat + totalDecay);
  }

  return decayedHeat;
}

/**
 * Classifies user tone into heat delta from -10 to +10.
 * Disrespect/defiance raises heat (+), devotion/reverence lowers heat (-).
 */
export async function classifyTone(
  userMessage: string,
  apiKey?: string
): Promise<number> {
  const msgLower = userMessage.toLowerCase().trim();

  // OOC or empty message does not shift heat
  if (msgLower.includes("(ooc)") || !msgLower) {
    return 0;
  }

  // Fast heuristic classification
  const devotionKeywords = [
    "goddess", "worship", "praise", "offering", "temple", "reverence",
    "grace", "divine", "blessing", "majesty", "radiant", "glory",
    "humbled", "forgive", "my queen", "lady", "bow", "serve"
  ];

  const disrespectKeywords = [
    "fake", "stupid", "shut up", "whatever", "boring", "useless",
    "hate you", "you suck", "not real", "computer", "bot", "tool",
    "clown", "weak", "ugly", "threaten", "insignificant", "loser"
  ];

  let score = 0;
  for (const kw of devotionKeywords) {
    if (msgLower.includes(kw)) score -= 3;
  }
  for (const kw of disrespectKeywords) {
    if (msgLower.includes(kw)) score += 5;
  }

  // If Gemini API is available and message is complex, run tiny classification call
  if (apiKey && Math.abs(score) === 0 && userMessage.length > 20) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze the user's message towards Hathor (an Egyptian deity). Output ONLY a single integer from -10 to 10:
- Devotion, humility, reverence, praise: -10 to -3
- Casual, respectful, neutral: -2 to +2
- Sarcastic, mocking, questioning her power: +3 to +6
- Blatant disrespect, insult, defiance: +7 to +10

User message: "${userMessage.replace(/"/g, '\\"')}"
Integer score:`,
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 10,
              temperature: 0.1,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        const parsed = parseInt(text, 10);
        if (!isNaN(parsed) && parsed >= -10 && parsed <= 10) {
          return parsed;
        }
      }
    } catch {
      // Fall back to score
    }
  }

  return Math.max(-10, Math.min(10, score));
}

/**
 * Checks and increments the user's daily usage.
 * Returns true if allowed, false if limit exceeded.
 */
export async function checkAndIncrementDailyUsage(
  admin: SupabaseClient,
  userId: string,
  dailyLimit: number
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Fetch current usage
  const { data: usageRecord } = await admin
    .from("daily_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();

  const currentCount = usageRecord?.count ?? 0;

  if (currentCount >= dailyLimit) {
    return { allowed: false, count: currentCount, limit: dailyLimit };
  }

  // Increment usage
  const nextCount = currentCount + 1;
  const { error: upsertErr } = await admin.from("daily_usage").upsert({
    user_id: userId,
    day: today,
    count: nextCount,
  });

  if (upsertErr) {
    console.error("Failed to upsert daily_usage:", upsertErr);
  }

  return { allowed: true, count: nextCount, limit: dailyLimit };
}

/**
 * Summarizes older messages if total message count exceeds 20.
 */
export async function summarizeHistoryIfNeeded(
  admin: SupabaseClient,
  userId: string,
  existingSummary: string
): Promise<string> {
  const { count, error } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error || !count || count <= 20) {
    return existingSummary;
  }

  // Fetch messages older than the most recent 20
  const { data: olderMessages } = await admin
    .from("messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .range(0, count - 21);

  if (!olderMessages || olderMessages.length === 0) {
    return existingSummary;
  }

  // Build condensed summary text
  const condensed = olderMessages
    .map((m) => `${m.role === "user" ? "Mortal" : "Hathor"}: ${m.content.slice(0, 80)}`)
    .join(" | ");

  const newSummary = existingSummary
    ? `${existingSummary}. Past interactions: ${condensed.slice(0, 300)}`
    : `Past interactions: ${condensed.slice(0, 300)}`;

  // Update chat_state summary
  await admin
    .from("chat_state")
    .update({ summary: newSummary.slice(0, 800) })
    .eq("user_id", userId);

  return newSummary;
}
