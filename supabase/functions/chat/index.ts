import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildSystemPrompt, getHeatMode } from "./persona.ts";
import { callLLM, ChatMessage } from "./llm.ts";
import {
  calculateIdleDecay,
  classifyTone,
  checkAndIncrementDailyUsage,
  summarizeHistoryIfNeeded,
} from "./heat.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const appSecret = req.headers.get("x-app-secret");
    const expectedSecret = Deno.env.get("APP_SECRET");

    if (!expectedSecret || !appSecret || appSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing app secret" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const apiKey = Deno.env.get("LLM_API_KEY") ?? "";
    const dailyLimit = parseInt(Deno.env.get("DAILY_LIMIT") || "60", 10);

    // Authenticate user token using public client
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized: Invalid user token",
          details: userError?.message,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Privileged admin client to manage database state
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const userMessageText = (body?.message || body?.content || "").trim();

    if (!userMessageText) {
      return new Response(
        JSON.stringify({ error: "Bad Request: message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Daily usage rate limit check
    const usage = await checkAndIncrementDailyUsage(admin, user.id, dailyLimit);
    if (!usage.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: "Hathor needs rest. The sun has set upon today's discourse—return tomorrow when Ra rises anew.",
          count: usage.count,
          limit: usage.limit,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch or initialize chat_state
    let { data: chatState } = await admin
      .from("chat_state")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!chatState) {
      const { data: newState } = await admin
        .from("chat_state")
        .insert({ user_id: user.id, heat: 40, summary: "", last_seen: new Date().toISOString() })
        .select()
        .single();
      chatState = newState || { heat: 40, summary: "", last_seen: new Date().toISOString() };
    }

    // 3. Idle heat decay (5 points toward 40 per elapsed hour)
    const lastSeen = chatState.last_seen ? new Date(chatState.last_seen) : new Date();
    const decayedHeat = calculateIdleDecay(chatState.heat ?? 40, lastSeen);

    // 4. Tone classification delta (-10 to +10)
    const toneDelta = await classifyTone(userMessageText, apiKey);
    const updatedHeat = Math.max(0, Math.min(100, Math.round(decayedHeat + toneDelta)));

    const summary = chatState.summary ?? "";

    // 5. Fetch last 20 messages for context
    const { data: historyData } = await admin
      .from("messages")
      .select("role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const history: ChatMessage[] = (historyData || []).reverse().map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 6. Assemble context
    const systemPrompt = buildSystemPrompt(updatedHeat, summary);
    const messagesForLLM: ChatMessage[] = [
      ...history,
      { role: "user", content: userMessageText },
    ];

    // Check if client expects SSE stream (standard, or requested via header/flag)
    const acceptHeader = req.headers.get("accept") || "";
    const isStreamRequested = acceptHeader.includes("text/event-stream") || body?.stream !== false;

    if (isStreamRequested) {
      const textEncoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let fullReply = "";

          try {
            for await (const token of callLLM(messagesForLLM, systemPrompt, { heat: updatedHeat })) {
              fullReply += token;
              controller.enqueue(
                textEncoder.encode(`event: token\ndata: ${JSON.stringify({ token })}\n\n`)
              );
            }

            // Save user message and assistant reply to DB
            await admin.from("messages").insert([
              { user_id: user.id, role: "user", content: userMessageText },
              { user_id: user.id, role: "assistant", content: fullReply },
            ]);

            // Rolling memory summarization if messages > 20
            await summarizeHistoryIfNeeded(admin, user.id, summary);

            // Update chat_state (heat, last_seen)
            await admin
              .from("chat_state")
              .update({
                heat: updatedHeat,
                last_seen: new Date().toISOString(),
              })
              .eq("user_id", user.id);

            // Final SSE event
            controller.enqueue(
              textEncoder.encode(
                `event: done\ndata: ${JSON.stringify({
                  heat: updatedHeat,
                  mode: getHeatMode(updatedHeat),
                  delta: toneDelta,
                  usage: { count: usage.count, limit: usage.limit },
                })}\n\n`
              )
            );
          } catch (err: unknown) {
            const errStr = err instanceof Error ? err.message : String(err);
            controller.enqueue(
              textEncoder.encode(`event: error\ndata: ${JSON.stringify({ error: errStr })}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // JSON fallback (if explicitly requested with stream=false)
    let fullReply = "";
    for await (const chunk of callLLM(messagesForLLM, systemPrompt, { heat: updatedHeat })) {
      fullReply += chunk;
    }

    await admin.from("messages").insert([
      { user_id: user.id, role: "user", content: userMessageText },
      { user_id: user.id, role: "assistant", content: fullReply },
    ]);

    await summarizeHistoryIfNeeded(admin, user.id, summary);
    await admin
      .from("chat_state")
      .update({
        heat: updatedHeat,
        last_seen: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({
        reply: fullReply,
        user_id: user.id,
        heat: updatedHeat,
        mode: getHeatMode(updatedHeat),
        delta: toneDelta,
        usage: { count: usage.count, limit: usage.limit },
        status: "ok",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
