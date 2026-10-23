import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildSystemPrompt, getHeatMode } from "./persona.ts";
import { callLLM, ChatMessage } from "./llm.ts";

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

    // Privileged admin client to read/write state
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

    // Fetch or initialize chat_state
    let { data: chatState } = await admin
      .from("chat_state")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!chatState) {
      const { data: newState, error: initErr } = await admin
        .from("chat_state")
        .insert({ user_id: user.id, heat: 40, summary: "" })
        .select()
        .single();
      if (initErr) {
        console.error("Failed to initialize chat_state:", initErr);
      }
      chatState = newState || { heat: 40, summary: "" };
    }

    const heat = chatState.heat ?? 40;
    const summary = chatState.summary ?? "";

    // Fetch last 20 messages for context
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

    // Build chat context
    const systemPrompt = buildSystemPrompt(heat, summary);
    const messagesForLLM: ChatMessage[] = [
      ...history,
      { role: "user", content: userMessageText },
    ];

    // Collect stream output
    let fullReply = "";
    for await (const chunk of callLLM(messagesForLLM, systemPrompt, { heat })) {
      fullReply += chunk;
    }

    // Save user message and assistant reply to DB
    await admin.from("messages").insert([
      { user_id: user.id, role: "user", content: userMessageText },
      { user_id: user.id, role: "assistant", content: fullReply },
    ]);

    return new Response(
      JSON.stringify({
        reply: fullReply,
        user_id: user.id,
        heat,
        mode: getHeatMode(heat),
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
