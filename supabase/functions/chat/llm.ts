/**
 * Unified LLM Client Wrapper with Multi-Provider Streaming
 * Supports Gemini, Anthropic Claude, and OpenAI-compatible providers,
 * all swappable via `LLM_PROVIDER` environment variable without changing any calling code.
 * Falls back to thematic persona simulation if the API key is invalid/unavailable.
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMStreamOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  heat?: number;
}

/**
 * Calls LLM via streaming SSE, supporting multiple providers via `LLM_PROVIDER`:
 * - "gemini" (default)
 * - "anthropic" / "claude"
 * - "openai" / "groq"
 */
export async function* callLLM(
  messages: ChatMessage[],
  systemPrompt: string,
  options: LLMStreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  const provider = (Deno.env.get("LLM_PROVIDER") || "gemini").toLowerCase().trim();
  const apiKey =
    Deno.env.get("LLM_API_KEY") ||
    Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("ANTHROPIC_API_KEY") ||
    Deno.env.get("OPENAI_API_KEY") ||
    "";

  if (apiKey) {
    try {
      if (provider === "anthropic" || provider === "claude") {
        yield* streamAnthropic(messages, systemPrompt, apiKey, options);
        return;
      } else if (provider === "openai" || provider === "groq") {
        yield* streamOpenAI(messages, systemPrompt, apiKey, options);
        return;
      } else {
        // Default: Gemini
        yield* streamGemini(messages, systemPrompt, apiKey, options);
        return;
      }
    } catch (err) {
      console.error(`LLM Provider (${provider}) error:`, err);
    }
  }

  // Fallback persona response generator when LLM API is unavailable or denied access
  yield* streamFallback(messages, options.heat ?? 40);
}

/**
 * Gemini Stream Generator
 */
async function* streamGemini(
  messages: ChatMessage[],
  systemPrompt: string,
  apiKey: string,
  options: LLMStreamOptions
): AsyncGenerator<string, void, unknown> {
  const model = options.model || Deno.env.get("LLM_MODEL") || "gemini-2.5-flash";

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.8,
      maxOutputTokens: options.maxTokens ?? 300,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield text;
          }
        } catch {
          // Ignore chunk parse errors
        }
      }
    }
  }
}

/**
 * Anthropic Claude Stream Generator
 */
async function* streamAnthropic(
  messages: ChatMessage[],
  systemPrompt: string,
  apiKey: string,
  options: LLMStreamOptions
): AsyncGenerator<string, void, unknown> {
  const model = options.model || Deno.env.get("LLM_MODEL") || "claude-3-5-haiku-20241022";

  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const payload = {
    model,
    system: systemPrompt,
    messages: anthropicMessages,
    max_tokens: options.maxTokens ?? 300,
    temperature: options.temperature ?? 0.8,
    stream: true,
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch {
          // Ignore chunk parse errors
        }
      }
    }
  }
}

/**
 * OpenAI / Compatible Stream Generator
 */
async function* streamOpenAI(
  messages: ChatMessage[],
  systemPrompt: string,
  apiKey: string,
  options: LLMStreamOptions
): AsyncGenerator<string, void, unknown> {
  const baseUrl = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  const model = options.model || Deno.env.get("LLM_MODEL") || "gpt-4o-mini";

  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const payload = {
    model,
    messages: openaiMessages,
    temperature: options.temperature ?? 0.8,
    max_tokens: options.maxTokens ?? 300,
    stream: true,
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          const text = parsed?.choices?.[0]?.delta?.content;
          if (text) {
            yield text;
          }
        } catch {
          // Ignore chunk parse errors
        }
      }
    }
  }
}

/**
 * Thematic Persona Simulation Fallback
 */
async function* streamFallback(
  messages: ChatMessage[],
  heat: number
): AsyncGenerator<string, void, unknown> {
  const fallbackReplies: Record<string, string[]> = {
    warm: [
      "The warm breath of the desert stirs around us, little mortal. I hear the quiet murmur of your soul, resting like golden dust beneath my temple pillars. Speak on; your devotion is not unseen.",
      "A ripple of laughter glides across the sacred waters. You carry yourself with rare grace today, my curious wanderer. Tell me what offering stirs in your thoughts.",
    ],
    watchful: [
      "The noon heat sharpens every shadow on the sanctuary stone. Do not think you can hide your fleeting intentions from the Eye of Ra, mortal. I watch, and I measure every syllable you utter.",
      "You dare look so directly into the sun without shielding your eyes? Careful, fragile creature. The line between my favor and my judgment is as thin as a papyrus reed.",
    ],
    Sekhmet: [
      "Crimson sand gathers at your heels. The lioness stirs, and the furnace of the heavens turns toward you. Choose your next words with absolute terror, for my patience has withered into ash.",
      "Silence, insolent dust. You test the wrath of the heavens as though you were immortal. Step back before the scorching breath of Sekhmet reduces your pride to cinder.",
    ],
  };

  const mode = heat <= 35 ? "warm" : heat <= 70 ? "watchful" : "Sekhmet";
  const pool = fallbackReplies[mode];
  const lastUserMsg = messages[messages.length - 1]?.content || "";

  let selectedReply = pool[Math.floor(Math.random() * pool.length)];

  if (lastUserMsg.toLowerCase().includes("(ooc)")) {
    selectedReply =
      "(Stepping out of character) Hey, I hear you. Everything is paused, and you're in a safe space. Take your time to breathe, and let me know whenever you'd like to continue or take a break.";
  }

  const words = selectedReply.split(" ");
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? "" : " ") + words[i];
    yield chunk;
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
}
