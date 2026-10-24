import { fetch as expoFetch } from 'expo/fetch';
import { supabase, supabaseUrl, isSupabaseConfigured } from './supabase';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface StreamDoneData {
  heat: number;
  mode: 'warm' | 'watchful' | 'Sekhmet';
  delta?: number;
  usage?: {
    count: number;
    limit: number;
  };
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (data: StreamDoneData) => void;
  onError: (error: Error) => void;
}

export interface StreamChatOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Loads historical messages and temperament for the current user from Supabase.
 */
export async function loadChatHistory(userId: string): Promise<{
  messages: ChatMessageItem[];
  heat: number;
}> {
  if (!isSupabaseConfigured) {
    return { messages: [], heat: 40 };
  }

  try {
    const [messagesRes, stateRes] = await Promise.all([
      supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('chat_state')
        .select('heat, summary')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    let messages: ChatMessageItem[] = [];
    if (messagesRes.data && messagesRes.data.length > 0) {
      messages = messagesRes.data.map((m: any) => ({
        id: String(m.id),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: new Date(m.created_at),
      }));
    }

    const heat = stateRes.data?.heat ?? 40;
    return { messages, heat };
  } catch (err) {
    console.warn('Failed to load chat history:', err);
    return { messages: [], heat: 40 };
  }
}

/**
 * Custom error types for specific backend statuses.
 */
export class RateLimitError extends Error {
  constructor(message: string = 'Hathor needs rest. Try again tomorrow.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Invalid app secret') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class NetworkChatError extends Error {
  constructor(message: string = 'Unable to reach Hathor. Please check your connection.') {
    super(message);
    this.name = 'NetworkChatError';
  }
}

/**
 * Calls /chat via streaming fetch (SSE) and emits tokens / completion events.
 */
export async function streamChatMessage(
  message: string,
  callbacks: StreamCallbacks,
  options?: StreamChatOptions
): Promise<void> {
  let hasDone = false;
  let hasError = false;
  let lastKnownHeat = 40;
  let lastKnownMode: 'warm' | 'watchful' | 'Sekhmet' = 'watchful';

  const safeOnDone = (data: StreamDoneData) => {
    if (!hasDone && !hasError) {
      hasDone = true;
      callbacks.onDone(data);
    }
  };

  const safeOnError = (error: Error) => {
    if (!hasError && !hasDone) {
      hasError = true;
      callbacks.onError(error);
    }
  };

  if (!isSupabaseConfigured) {
    // Graceful local preview mode
    const isOOC = message.toLowerCase().includes('(ooc)');
    const simulated = isOOC
      ? '(Stepping out of character) Hey, I hear you. Everything is paused, and you are in a safe space. Take your time to breathe.'
      : 'The warm breath of the desert stirs around us, little mortal. I hear the quiet murmur of your soul beneath my temple pillars. Speak on.';
    const words = simulated.split(' ');
    for (let i = 0; i < words.length; i++) {
      if (options?.signal?.aborted) {
        safeOnDone({ heat: 40, mode: 'watchful' });
        return;
      }
      const chunk = (i === 0 ? '' : ' ') + words[i];
      callbacks.onToken(chunk);
      await new Promise((r) => setTimeout(r, 35));
    }
    safeOnDone({ heat: 40, mode: 'watchful' });
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    const err = new UnauthorizedError('Session expired. Please restart the app.');
    safeOnError(err);
    throw err;
  }

  const internalController = new AbortController();
  const abortListener = () => {
    try {
      internalController.abort();
    } catch {}
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      internalController.abort();
    } else {
      options.signal.addEventListener('abort', abortListener, { once: true });
    }
  }

  const endpoint = `${supabaseUrl}/functions/v1/chat`;

  // Initial connection timeout (30s)
  const timeoutMs = options?.timeoutMs ?? 30000;
  let initialTimeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    try {
      internalController.abort();
    } catch {}
  }, timeoutMs);

  let response: Response;
  try {
    const fetchFn = typeof expoFetch === 'function' ? expoFetch : fetch;
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message, stream: true }),
      signal: internalController.signal,
    });
  } catch (netErr: any) {
    if (options?.signal?.aborted) {
      safeOnDone({ heat: lastKnownHeat, mode: lastKnownMode });
      return;
    }
    const isTimeout = internalController.signal.aborted;
    const error = new NetworkChatError(
      isTimeout
        ? 'Temple connection timed out. Hathor did not respond.'
        : netErr?.message || 'Network request failed'
    );
    safeOnError(error);
    throw error;
  } finally {
    if (initialTimeoutId) {
      clearTimeout(initialTimeoutId);
      initialTimeoutId = null;
    }
  }

  if (response.status === 401) {
    const error = new UnauthorizedError('Session expired. Please restart the app.');
    safeOnError(error);
    throw error;
  }

  if (response.status === 429) {
    let limitMsg = 'Hathor needs rest. Try again tomorrow.';
    try {
      const json = await response.json();
      if (json.message) limitMsg = json.message;
    } catch {
      // ignore json parse error
    }
    const error = new RateLimitError(limitMsg);
    safeOnError(error);
    throw error;
  }

  if (!response.ok) {
    let errMsg = `Request failed with status ${response.status}`;
    try {
      const json = await response.json();
      if (json.error) errMsg = json.error;
    } catch {
      // ignore json parse error
    }
    const error = new Error(errMsg);
    safeOnError(error);
    throw error;
  }

  if (!response.body) {
    const error = new Error('No response body returned from server');
    safeOnError(error);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  // Stream chunk stall timer (20s without incoming data during active stream)
  let chunkTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const resetChunkTimer = () => {
    if (chunkTimeoutId) clearTimeout(chunkTimeoutId);
    chunkTimeoutId = setTimeout(() => {
      try {
        internalController.abort();
      } catch {}
    }, 20000);
  };

  try {
    resetChunkTimer();
    while (true) {
      if (options?.signal?.aborted) {
        try {
          await reader.cancel();
        } catch {}
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      resetChunkTimer();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = 'message';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEvent = 'message';
          continue;
        }

        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.replace(/^event:\s*/, '').trim();
          continue;
        }

        if (trimmed.startsWith('data:')) {
          const rawData = trimmed.replace(/^data:\s*/, '');
          try {
            const parsed = JSON.parse(rawData);

            if (currentEvent === 'token' && typeof parsed.token === 'string') {
              callbacks.onToken(parsed.token);
            } else if (currentEvent === 'done') {
              if (typeof parsed.heat === 'number') lastKnownHeat = parsed.heat;
              if (parsed.mode) lastKnownMode = parsed.mode;
              safeOnDone({
                heat: parsed.heat ?? lastKnownHeat,
                mode: parsed.mode ?? lastKnownMode,
                delta: parsed.delta,
                usage: parsed.usage,
              });
            } else if (currentEvent === 'error') {
              safeOnError(new Error(parsed.error || 'Server stream error'));
            }
          } catch {
            // raw string fallback or malformed json
            if (currentEvent === 'token') {
              callbacks.onToken(rawData);
            }
          }
        }
      }
    }

    // If stream reached end without emitting done (e.g. server closed socket early)
    safeOnDone({
      heat: lastKnownHeat,
      mode: lastKnownMode,
    });
  } catch (streamErr: any) {
    if (options?.signal?.aborted) {
      safeOnDone({ heat: lastKnownHeat, mode: lastKnownMode });
      return;
    }
    const isTimeout = internalController.signal.aborted;
    const error = new NetworkChatError(
      isTimeout
        ? 'Temple connection timed out while Hathor was speaking.'
        : streamErr?.message || 'Error reading stream'
    );
    safeOnError(error);
    throw error;
  } finally {
    if (chunkTimeoutId) {
      clearTimeout(chunkTimeoutId);
      chunkTimeoutId = null;
    }
    if (options?.signal) {
      try {
        options.signal.removeEventListener('abort', abortListener);
      } catch {}
    }
  }
}

/**
 * Purges all conversation history and resets temperament to default (40).
 */
export async function resetChat(): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new UnauthorizedError('Session expired. Please restart the app.');
  }

  const endpoint = `${supabaseUrl}/functions/v1/chat`;
  const fetchFn = typeof expoFetch === 'function' ? expoFetch : fetch;
  const res = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'reset' }),
  });

  if (!res.ok) {
    throw new Error(`Failed to reset chat: status ${res.status}`);
  }
}
