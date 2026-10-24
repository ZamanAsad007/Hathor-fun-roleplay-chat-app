import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Sanitizes roleplay actions (e.g. *chuckles softly*, *leans forward*)
 * so speech sounds natural rather than reading asterisks.
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\*[^*]+\*/g, '') // remove actions between asterisks
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Speaks text using Hathor's voice characteristics based on temperament mode.
 */
export async function speakHathor(
  text: string,
  mode: 'warm' | 'watchful' | 'Sekhmet',
  callbacks?: {
    onStart?: () => void;
    onDone?: () => void;
    onError?: (error: any) => void;
  }
): Promise<void> {
  const clean = cleanTextForSpeech(text);
  if (!clean) {
    callbacks?.onDone?.();
    return;
  }

  try {
    // Stop any ongoing speech first
    await stopSpeaking();

    // Modulate pitch and rate according to mood
    let pitch = 0.92;
    let rate = 0.86;

    if (text.toLowerCase().includes('(ooc)') || text.startsWith('(Stepping')) {
      // Out-of-character: clear, friendly contemporary cadence
      pitch = 1.0;
      rate = 0.95;
    } else if (mode === 'warm') {
      pitch = 0.98; // Sultry, velvety, playful
      rate = 0.88;
    } else if (mode === 'watchful') {
      pitch = 0.90; // Calculating, regal, deliberate
      rate = 0.84;
    } else if (mode === 'Sekhmet') {
      pitch = 0.82; // Deep, commanding, chilling predator tone
      rate = 0.80;
    }

    Speech.speak(clean, {
      language: 'en-US',
      pitch,
      rate,
      onStart: callbacks?.onStart,
      onDone: callbacks?.onDone,
      onStopped: callbacks?.onDone,
      onError: (err) => {
        console.warn('Speech error:', err);
        callbacks?.onError?.(err);
      },
    });
  } catch (err) {
    console.warn('Speech synthesis failed:', err);
    callbacks?.onError?.(err);
  }
}

/**
 * Halts any active speech playback.
 */
export async function stopSpeaking(): Promise<void> {
  try {
    if (await Speech.isSpeakingAsync()) {
      await Speech.stop();
    }
  } catch {
    // Gracefully ignore on unsupported targets
  }
}

/**
 * Returns whether speech is currently in progress.
 */
export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
