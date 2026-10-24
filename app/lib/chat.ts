import { fetch as expoFetch } from 'expo/fetch';
import { supabase, supabaseUrl, appSecret } from './supabase';

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

/**
 * Loads historical messages and temperament for the current user from Supabase.
 */
export async function loadChatHistory(userId: string): Promise<{
  messages: ChatMessageItem[];
  heat: number;
}> {
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
  callbacks: StreamCallbacks
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    const err = new UnauthorizedError('Session expired. Please restart the app.');
    callbacks.onError(err);
    throw err;
  }

  const endpoint = `${supabaseUrl}/functions/v1/chat`;

  let response: Response;
  try {
    // expo/fetch supports response streaming in Expo native & modern environments
    const fetchFn = typeof expoFetch === 'function' ? expoFetch : fetch;
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-app-secret': appSecret,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message, stream: true }),
    });
  } catch (netErr: any) {
    const error = new NetworkChatError(netErr?.message || 'Network request failed');
    callbacks.onError(error);
    throw error;
  }

  if (response.status === 401) {
    const error = new UnauthorizedError('Invalid app secret');
    callbacks.onError(error);
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
    callbacks.onError(error);
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
    callbacks.onError(error);
    throw error;
  }

  if (!response.body) {
    const error = new Error('No response body returned from server');
    callbacks.onError(error);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

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
              callbacks.onDone({
                heat: parsed.heat ?? 40,
                mode: parsed.mode ?? 'watchful',
                delta: parsed.delta,
                usage: parsed.usage,
              });
            } else if (currentEvent === 'error') {
              callbacks.onError(new Error(parsed.error || 'Server stream error'));
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
  } catch (streamErr: any) {
    const error = new NetworkChatError(streamErr?.message || 'Error reading stream');
    callbacks.onError(error);
    throw error;
  }
}
