import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureAuthenticatedUser } from '../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'You step into the sacred court of Hathor. The air is dry and thick with burning myrrh. Speak, little mortal. I am listening.',
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [heat, setHeat] = useState(40);
  const [mode, setMode] = useState<'warm' | 'watchful' | 'Sekhmet'>('watchful');
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Authenticate anonymously on startup
    async function initAuth() {
      try {
        const user = await ensureAuthenticatedUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (err) {
        console.warn('Anonymous authentication error:', err);
      } finally {
        setIsAuthenticating(false);
      }
    }
    initAuth();
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    // Phase 5 simulated reply (transitioning into live streaming in Phase 6)
    setTimeout(() => {
      const isOOC = text.toLowerCase().includes('(ooc)');
      let replyContent =
        'Your devotion echoes against the stone pillars, little mortal. Continue, before the shadows lengthen.';

      if (isOOC) {
        replyContent =
          '(Stepping out of character) Hey, I hear you. You are completely safe here. Let me know whenever you want to pause or resume.';
      } else if (text.toLowerCase().includes('praise') || text.toLowerCase().includes('goddess')) {
        replyContent =
          'A soft desert breeze carries your sweet words to my ears. You please me today, mortal.';
        setHeat((prev) => Math.max(0, prev - 5));
      } else if (text.toLowerCase().includes('fake') || text.toLowerCase().includes('hate')) {
        replyContent =
          'Mind your tongue, creature of dust. The lioness stirs in the crimson sands.';
        setHeat((prev) => Math.min(100, prev + 10));
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsSending(false);
    }, 700);
  };

  useEffect(() => {
    if (heat <= 35) setMode('warm');
    else if (heat <= 70) setMode('watchful');
    else setMode('Sekhmet');
  }, [heat]);

  const getBadgeColor = () => {
    switch (mode) {
      case 'warm':
        return '#38761D';
      case 'watchful':
        return '#B45F06';
      case 'Sekhmet':
        return '#990000';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Heat Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <Text style={styles.statusLabel}>TEMPERAMENT</Text>
          <View style={[styles.badge, { backgroundColor: getBadgeColor() }]}>
            <Text style={styles.badgeText}>
              {mode.toUpperCase()} ({heat})
            </Text>
          </View>
        </View>
        {isAuthenticating ? (
          <ActivityIndicator size="small" color="#EAD196" />
        ) : (
          <Text style={styles.userStatus}>
            {userId ? `ANON:${userId.slice(0, 6)}` : 'OFFLINE'}
          </Text>
        )}
      </View>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text style={isUser ? styles.userSender : styles.assistantSender}>
                {isUser ? 'MORTAL' : 'HATHOR'}
              </Text>
              <Text style={styles.messageText}>{item.content}</Text>
            </View>
          );
        }}
      />

      {isSending && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#D4AF37" />
          <Text style={styles.typingText}>Hathor contemplates your words...</Text>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          placeholder="Speak to Hathor... (type (ooc) to exit persona)"
          placeholderTextColor="#7D6B74"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>SEND</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D070A',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#160E13',
    borderBottomWidth: 1,
    borderBottomColor: '#2B1A22',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    color: '#A8929D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  userStatus: {
    color: '#7D6B74',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    marginVertical: 6,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#261720',
    borderWidth: 1,
    borderColor: '#422837',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#170E14',
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
  },
  userSender: {
    color: '#C79DAB',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  assistantSender: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  messageText: {
    color: '#F4ECEF',
    fontSize: 15,
    lineHeight: 22,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
  },
  typingText: {
    color: '#D4AF37',
    fontSize: 12,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#160E13',
    borderTopWidth: 1,
    borderTopColor: '#2B1A22',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0D070A',
    color: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#301F29',
  },
  sendButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#423624',
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#0D070A',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
