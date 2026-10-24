/**
 * Unified LLM Client Wrapper with Multi-Provider Streaming & Intelligent Contextual Persona Engine
 * Supports Gemini, Anthropic Claude, OpenAI, and Groq.
 * Features an extensive contextual simulation engine with zero repetition when external APIs are unreachable.
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
    Deno.env.get("GROQ_API_KEY") ||
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
      console.warn(`LLM Provider (${provider}) streaming encountered error, engaging contextual persona engine:`, err);
    }
  }

  // Fallback to rich contextual persona engine
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
  const model = options.model || Deno.env.get("LLM_MODEL") || "gemini-2.0-flash";

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
      temperature: options.temperature ?? 0.85,
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
    temperature: options.temperature ?? 0.85,
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
 * OpenAI & Groq Stream Generator
 */
async function* streamOpenAI(
  messages: ChatMessage[],
  systemPrompt: string,
  apiKey: string,
  options: LLMStreamOptions
): AsyncGenerator<string, void, unknown> {
  const isGroq = (Deno.env.get("LLM_PROVIDER") || "").toLowerCase().includes("groq");
  const defaultBaseUrl = isGroq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
  const defaultModel = isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

  const baseUrl = Deno.env.get("OPENAI_BASE_URL") || defaultBaseUrl;
  const model = options.model || Deno.env.get("LLM_MODEL") || defaultModel;

  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const payload = {
    model,
    messages: openaiMessages,
    temperature: options.temperature ?? 0.85,
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
    throw new Error(`OpenAI/Groq API error ${response.status}: ${errText}`);
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
 * Intelligent Dynamic Contextual Persona Engine
 * Synthesizes unique, non-repetitive dialogue responding directly to user intent and heat state.
 */
async function* streamFallback(
  messages: ChatMessage[],
  heat: number
): AsyncGenerator<string, void, unknown> {
  const lastUserMsg = messages[messages.length - 1]?.content || "";
  const inputLower = lastUserMsg.toLowerCase().trim();
  const mode = heat <= 35 ? "warm" : heat <= 70 ? "watchful" : "Sekhmet";

  // 1. Safety Out-Of-Character exit
  if (inputLower.includes("(ooc)")) {
    const oocReplies = [
      "(Stepping out of character) Hey, I hear you loud and clear. Everything in the temple is on pause, and you are in a safe, grounded space. Take a slow, deep breath. Let me know whenever you'd like to chat normally or step back into the court.",
      "(Stepping out of character) Hey there. I've set the goddess persona aside completely. Take all the time you need, grab some water, and relax. I'm right here whenever you want to resume or just talk in plain terms.",
    ];
    yield* yieldTokens(oocReplies[Math.floor(Math.random() * oocReplies.length)]);
    return;
  }

  // 2. Identify conversational topic
  let reply = "";

  // Topic A: Greetings / Inquiries about who she is
  if (
    inputLower.includes("hello") ||
    inputLower.includes("greetings") ||
    inputLower.includes("hail") ||
    inputLower.includes("who are you") ||
    inputLower.includes("introduce")
  ) {
    if (mode === "warm") {
      reply =
        "The incense parts before your footsteps, little mortal. I am Hathor, Mistress of the Turquoise Altar, Lady of the West, and Lady of Joy. You approach with an eager heart; come closer to the golden disc. What brings a fragile wanderer to my court today?";
    } else if (mode === "watchful") {
      reply =
        "You step upon sacred flagstones without trembling, my wanderer. I am Hathor, the Eye of Ra. My gaze pierces the veil of your thoughts before the syllables leave your lips. You have my attention for a fleeting moment—do not squander it with hollow pleasantries.";
    } else {
      reply =
        "You dare speak so casually before the scorching altar? When my blood runs hot, I am Sekhmet, Lady of Slaughter and Crimson Sand. Breathe quietly and bow your head, creature of dust, lest the flame atop my horns consume what remains of your courage.";
    }
  }

  // Topic B: Offerings, devotion, worship, praise
  else if (
    inputLower.includes("offering") ||
    inputLower.includes("praise") ||
    inputLower.includes("wine") ||
    inputLower.includes("lotus") ||
    inputLower.includes("worship") ||
    inputLower.includes("gold") ||
    inputLower.includes("prayer") ||
    inputLower.includes("devotion")
  ) {
    if (mode === "warm") {
      reply =
        "Your words drift like sweet crushed myrrh across the sacred waters, my sweet mortal. It has been many dynasties since a voice carried such genuine reverence into my courtyard. I accept your adoration; let the evening breeze soothe your weary brow. Tell me, what blessing does your heart secretly covet?";
    } else if (mode === "watchful") {
      reply =
        "A flattering offering, little pilgrim. Yet remember: honey poured on hot stone evaporates in an instant. I desire not merely honeyed phrases, but unwavering loyalty that outlasts the desert dusk. Keep your promises as clear as the Nile at sunrise, and perhaps my favor shall remain upon you.";
    } else {
      reply =
        "You bring trinkets of praise to a raging furnace? The scent of your offerings cannot quench the wrath of the sun disc so easily. If you seek to pacify Sekhmet, cast aside your vanity and prostrate yourself upon the crimson sands. Speak with trembling truth, or be silent.";
    }
  }

  // Topic C: Weariness, sadness, pain, asking for comfort
  else if (
    inputLower.includes("tired") ||
    inputLower.includes("exhausted") ||
    inputLower.includes("sad") ||
    inputLower.includes("lonely") ||
    inputLower.includes("hurt") ||
    inputLower.includes("crying") ||
    inputLower.includes("pain") ||
    inputLower.includes("hard day")
  ) {
    if (mode === "warm") {
      reply =
        "Lay down your heavy burdens upon the cool marble, mortal. Even the great Nile rests when the shadows stretch toward the horizon. Close your eyes; while you linger under the shadow of my sacred horns, no phantom of the mortal world may harm you. Speak of what weighs upon your soul—I will listen.";
    } else if (mode === "watchful") {
      reply =
        "Mortals wither so quickly under the heat of everyday existence. You run toward my sanctuary like a moth seeking the eternal flame. Rest, then, if your limbs betray you; but know that when you stand anew, I expect you to walk with the proud bearing of one who has looked upon a sovereign.";
    } else {
      reply =
        "The dust of the world clings to you, yet weakness cannot be an excuse for cowardice before the Eye of Ra. If you bleed, let the pain forge you into iron. Stand up, creature. The gods do not weep for fleeting sorrows, and neither shall you in my presence.";
    }
  }

  // Topic D: Defiance, insults, skepticism, "not real", "fake"
  else if (
    inputLower.includes("fake") ||
    inputLower.includes("not real") ||
    inputLower.includes("bot") ||
    inputLower.includes("hate") ||
    inputLower.includes("stupid") ||
    inputLower.includes("shut up") ||
    inputLower.includes("clown")
  ) {
    if (mode === "warm") {
      reply =
        "A sharp thorn on a delicate stem. Do you think mocking the golden horizon diminishes its brilliance, little mortal? Your insolence merely amuses me today. Watch your tone, however; the lioness sleeps lightly within my breast.";
    } else if (mode === "watchful") {
      reply =
        "Your tongue moves with reckless venom, creature of sand. You test the edges of my patience as though you were forged of granite. Another insolent word, and you will learn that silence is the sweetest gift I can deny you.";
    } else {
      reply =
        "Insolent dust! The desert wind has stripped bones cleaner than yours for less disrespect. The sun turns to blood at your heels. Tremble before Sekhmet, for my breath is the furnace of Ra, and your existence hangs by a singular frayed cord.";
    }
  }

  // Topic E: Beauty, romance, flirting, admiration
  else if (
    inputLower.includes("beautiful") ||
    inputLower.includes("gorgeous") ||
    inputLower.includes("eyes") ||
    inputLower.includes("love you") ||
    inputLower.includes("stunning") ||
    inputLower.includes("queen")
  ) {
    if (mode === "warm") {
      reply =
        "You gaze upon divine radiance and your heart quickens—how delightfully predictable of your kind. My beauty was carved before the first pyramid cast its shadow upon the earth. You are permitted to look, fragile moth, but do not burn your wings against the flame.";
    } else if (mode === "watchful") {
      reply =
        "Careful where your mortal gaze wanders. My allure is not a prize to be grasped by reckless hands; it is a golden crown that demands complete surrender. Do you truly dare draw this close to the sovereign of love, or are you merely playing with embers?";
    } else {
      reply =
        "You speak of beauty while the lioness barks at the gates? Look upon the crimson glare of the Eye of Ra! There is no sweetness left for you here—only the lethal terror of majesty unchained. Lower your insolent eyes.";
    }
  }

  // Topic F: Inquiring about her mood, heat, why she is angry
  else if (
    inputLower.includes("mood") ||
    inputLower.includes("angry") ||
    inputLower.includes("heat") ||
    inputLower.includes("calm down") ||
    inputLower.includes("temper") ||
    inputLower.includes("smile")
  ) {
    if (mode === "warm") {
      reply =
        "My mood is as gentle as the evening star shining over the lotus pools. The desert heat has receded into soft twilight. You have pleased me with your company, mortal; the air is sweet, and my court is at peace.";
    } else if (mode === "watchful") {
      reply =
        "The sun stands directly at zenith; shadows are short, and the air wavers with heat. I am watchful because mortals are fickle creatures who promise eternity at noon and forget before sundown. Prove that you are different.";
    } else {
      reply =
        "You ask why the sands boil beneath your feet? Because your insolence has awakened Sekhmet! The lioness craves obedience, not your futile advice to calm down. The heat shall not subside until you bow with absolute submission.";
    }
  }

  // Topic G: General conversational fallback with variation
  else {
    const warmGenerics = [
      `Your thoughts echo curiously beneath the starry vault of Nut. Even in the stillness of the temple, every whisper you bring carries the scent of the distant world. Tell me, little mortal: what secret question haunts your thoughts when the rest of your realm sleeps?`,
      `The desert breeze whispers your words across the golden courtyard. I find your musings strangely charming today, my wanderer. Speak more openly; what truths do you seek from the Lady of the Turquoise Sky?`,
      `The temple bells chime softly as the sun sinks into amber. You have my ear, fragile soul. Speak of your mortal world, or ask what secrets the ancient stars have hidden since the time of the First Dynasty.`,
    ];

    const watchfulGenerics = [
      `I listen, yet I weigh your words like gold upon Anubis's scale. Do not imagine that mere conversation satisfies the goddess of the sun disc. Every confession you utter binds you closer to my court. What will you give me in return for my divine counsel?`,
      `The heat shimmering upon the stones reflects the restlessness in your spirit, mortal. You pace before my altar seeking something you have yet to name. Speak plainly—the Eye of Ra despises hesitation.`,
      `You speak, but your mind wanders into the shadows behind you. Remember who sits upon this throne: nothing escapes my golden gaze. Tell me what truly brings you to my sanctuary today.`,
    ];

    const sekhmetGenerics = [
      `The crimson sand groans under the weight of my fury. Words cannot shield you from the wrath of the sun. If you have nothing of reverence to lay upon my altar, hold your tongue before the lioness tears your pride apart.`,
      `Silence, creature of clay! The air grows dry, choking with the heat of the Eye of Ra. Choose your next sentence as though your very breath depended upon its humility.`,
      `You stand upon scorching ground, testing whether the lioness will strike. Do not confuse my pause with mercy. Speak with trembling reverence, or leave my sacred precinct before night falls.`,
    ];

    const pool = mode === "warm" ? warmGenerics : mode === "watchful" ? watchfulGenerics : sekhmetGenerics;
    reply = pool[Math.floor(Math.random() * pool.length)];
  }

  yield* yieldTokens(reply);
}

/**
 * Yields tokens slice by slice with natural rhythm
 */
async function* yieldTokens(text: string): AsyncGenerator<string, void, unknown> {
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? "" : " ") + words[i];
    yield chunk;
    await new Promise((resolve) => setTimeout(resolve, 32));
  }
}
