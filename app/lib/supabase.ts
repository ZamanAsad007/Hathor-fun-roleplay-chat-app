import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      try {
        return Promise.resolve(typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null);
      } catch {
        return Promise.resolve(null);
      }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
        return Promise.resolve();
      } catch {
        return Promise.resolve();
      }
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        return Promise.resolve();
      } catch {
        return Promise.resolve();
      }
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const appSecret = process.env.EXPO_PUBLIC_APP_SECRET || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Ensures an active session exists; signs in anonymously if not yet authenticated.
 */
export async function ensureAuthenticatedUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return session.user;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Anonymous sign-in error:', error);
      throw error;
    }
    return data?.user ?? null;
  } catch (err) {
    console.error('Failed to get or create anonymous user session:', err);
    throw err;
  }
}
