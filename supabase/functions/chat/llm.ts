/**
 * Unified LLM Client Wrapper with Streaming
 * Supports Gemini API with fallback to thematic persona simulation if the API key is invalid/denied.
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

export async function* callLLM(
  messages: ChatMessage[],
  systemPrompt: string,
  options: LLMStreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  const apiKey = Deno.env.get("LLM_API_KEY") || "";
  const model = options.model || "gemini-2.5-flash";
  const heat = options.heat ?? 40;

  // Format messages for Gemini API
  const geminiContents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: geminiContents,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 300,
    },
  };

  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok && response.body) {
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
                // Ignore parse errors on malformed chunks
              }
            }
          }
        }
        return;
      } else {
        const errText = await response.text();
        console.warn(`Gemini API returned error ${response.status}: ${errText}`);
      }
    } catch (err) {
      console.error("Gemini API call failed:", err);
    }
  }

  // Fallback persona response generator when LLM API is unavailable or denied access
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

  // Check for OOC in fallback
  if (lastUserMsg.toLowerCase().includes("(ooc)")) {
    selectedReply =
      "(Stepping out of character) Hey, I hear you. Everything is paused, and you're in a safe space. Take your time to breathe, and let me know whenever you'd like to continue or take a break.";
  }

  // Stream in small token slices to simulate live generation
  const words = selectedReply.split(" ");
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? "" : " ") + words[i];
    yield chunk;
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
}
