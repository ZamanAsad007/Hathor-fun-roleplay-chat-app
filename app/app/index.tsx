import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureAuthenticatedUser } from '../lib/supabase';
import {
  loadChatHistory,
  streamChatMessage,
  resetChat,
  ChatMessageItem,
  RateLimitError,
  UnauthorizedError,
  NetworkChatError,
} from '../lib/chat';
import { HathorAvatar } from '../components/HathorAvatar';
import { SettingsModal } from '../components/SettingsModal';
import { DisclaimerModal } from '../components/DisclaimerModal';
import {
  requestNotificationPermissions,
  scheduleIdleNotification,
} from '../lib/notifications';
import { speakHathor, stopSpeaking } from '../lib/speech';

const INITIAL_WELCOME_MESSAGE: ChatMessageItem = {
  id: 'welcome-1',
  role: 'assistant',
  content:
    '*The air is dry and thick with burning myrrh as you step into the sacred court of Hathor.* Speak, little mortal. I am listening.',
  createdAt: new Date(),
};

function renderMessageContent(content: string, isSendingPlaceholder: boolean) {
  if (!content) {
    return isSendingPlaceholder ? <Text style={styles.messageText}>...</Text> : null;
  }

  const parts = content.split(/(\*[^*]+\*)/g);

  return (
    <Text style={styles.messageText}>
      {parts.map((part, index) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          const actionText = part.slice(1, -1);
          return (
            <Text key={index} style={styles.actionText}>
              *{actionText}*{' '}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessageItem[]>([INITIAL_WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [heat, setHeat] = useState(40);
  const [mode, setMode] = useState<'warm' | 'watchful' | 'Sekhmet'>('watchful');
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Audio / Speech State
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);

  // Error handling states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);

  // Settings sheet
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Keyboard visibility tracking for compact presence and input offset
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    // Authenticate anonymously, load historical messages, and configure idle reminder
    async function init() {
      try {
        const user = await ensureAuthenticatedUser();
        if (user) {
          setUserId(user.id);
          const history = await loadChatHistory(user.id);
          if (history.messages && history.messages.length > 0) {
            setMessages(history.messages);
          }
          if (typeof history.heat === 'number') {
            setHeat(history.heat);
          }
        }
        await requestNotificationPermissions();
        await scheduleIdleNotification();
      } catch (err) {
        console.warn('Initialization error:', err);
      } finally {
        setIsAuthenticating(false);
        setIsLoadingHistory(false);
      }
    }
    init();

    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (heat <= 35) setMode('warm');
    else if (heat <= 70) setMode('watchful');
    else setMode('Sekhmet');
  }, [heat]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isSending) return;

    // Stop ongoing speech before sending new message
    stopSpeaking();
    setCurrentlySpeakingId(null);

    setErrorMessage(null);
    setCanRetry(false);
    setLastFailedText(null);

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date(),
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantPlaceholder: ChatMessageItem = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    };

    if (!textToSend) {
      setInput('');
    }

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setIsSending(true);

    let hasReceivedTokens = false;
    let accumulatedContent = '';

    try {
      await streamChatMessage(text, {
        onToken: (token: string) => {
          hasReceivedTokens = true;
          accumulatedContent += token;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: msg.content + token } : msg
            )
          );
        },
        onDone: (data) => {
          if (typeof data.heat === 'number') {
            setHeat(data.heat);
          }
          if (data.mode) {
            setMode(data.mode);
          }
          setIsSending(false);
          scheduleIdleNotification();

          // Auto-speak if voice mode is enabled
          if (voiceEnabled && accumulatedContent) {
            speakHathor(accumulatedContent, data.mode || mode, {
              onStart: () => setCurrentlySpeakingId(assistantMsgId),
              onDone: () => setCurrentlySpeakingId(null),
              onError: () => setCurrentlySpeakingId(null),
            });
          }
        },
        onError: (err) => {
          handleStreamError(err, text, assistantMsgId, hasReceivedTokens);
        },
      });
    } catch (err: any) {
      handleStreamError(err, text, assistantMsgId, hasReceivedTokens);
    }
  };

  const handleStreamError = (
    err: Error,
    failedText: string,
    assistantMsgId: string,
    hasReceivedTokens: boolean
  ) => {
    setIsSending(false);

    if (!hasReceivedTokens) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    }

    if (err instanceof RateLimitError) {
      setErrorMessage(err.message || 'Hathor needs rest. Try again tomorrow.');
      setCanRetry(false);
      setLastFailedText(null);
    } else if (err instanceof UnauthorizedError) {
      setErrorMessage('Session expired. Hathor denies entry. Please restart the app.');
      setCanRetry(false);
      setLastFailedText(null);
    } else if (err instanceof NetworkChatError) {
      setErrorMessage('Connection lost with the temple. Check your network.');
      setCanRetry(true);
      setLastFailedText(failedText);
    } else {
      setErrorMessage(err.message || 'The sacred connection wavered. Please try again.');
      setCanRetry(true);
      setLastFailedText(failedText);
    }
  };

  const handleRetry = () => {
    if (lastFailedText && !isSending) {
      const retryText = lastFailedText;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'user' && last.content === retryText) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      handleSend(retryText);
    }
  };

  const handleResetChat = async () => {
    stopSpeaking();
    setCurrentlySpeakingId(null);
    await resetChat();
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setHeat(40);
    setMode('watchful');
    await scheduleIdleNotification();
  };

  const toggleMessageSpeech = (messageId: string, content: string) => {
    if (currentlySpeakingId === messageId) {
      stopSpeaking();
      setCurrentlySpeakingId(null);
    } else {
      speakHathor(content, mode, {
        onStart: () => setCurrentlySpeakingId(messageId),
        onDone: () => setCurrentlySpeakingId(null),
        onError: () => setCurrentlySpeakingId(null),
      });
    }
  };

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

  const getBackgroundColor = () => {
    if (heat <= 35) {
      return '#100B05';
    } else if (heat <= 70) {
      return '#180C07';
    } else {
      return '#26060A';
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: getBackgroundColor() }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Heat Status Bar */}
      <View style={[styles.statusBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.statusLeft}>
          <Text style={styles.statusLabel}>TEMPERAMENT</Text>
          <View style={[styles.badge, { backgroundColor: getBadgeColor() }]}>
            <Text style={styles.badgeText}>
              {mode.toUpperCase()} ({heat})
            </Text>
          </View>
        </View>

        <View style={styles.statusRight}>
          {/* TTS Auto-Voice Toggle */}
          <TouchableOpacity
            style={[styles.voiceToggle, voiceEnabled && styles.voiceToggleActive]}
            onPress={() => {
              const nextState = !voiceEnabled;
              setVoiceEnabled(nextState);
              if (!nextState) stopSpeaking();
            }}
            accessibilityLabel="Toggle voice narration"
          >
            <Text style={styles.voiceToggleIcon}>{voiceEnabled ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>

          {isAuthenticating || isLoadingHistory ? (
            <ActivityIndicator size="small" color="#EAD196" />
          ) : (
            <Text style={styles.userStatus}>
              {userId ? `ANON:${userId.slice(0, 6)}` : 'OFFLINE'}
            </Text>
          )}

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsVisible(true)}
            accessibilityLabel="Sanctuary Settings"
          >
            <Text style={styles.settingsButtonIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hathor Presence Chamber Header */}
      <View
        style={[
          styles.presenceContainer,
          isKeyboardVisible && styles.presenceContainerCompact,
        ]}
      >
        <HathorAvatar
          heat={heat}
          mode={mode}
          isStreaming={isSending || !!currentlySpeakingId}
          size={isKeyboardVisible ? 52 : 110}
        />
        <View style={styles.presenceInfo}>
          <Text
            style={[
              styles.presenceTitle,
              { color: mode === 'Sekhmet' ? '#FCA5A5' : '#FDE68A' },
              isKeyboardVisible && styles.presenceTitleCompact,
            ]}
          >
            {mode === 'Sekhmet'
              ? 'SEKHMET'
              : mode === 'watchful'
              ? 'WATCHFUL'
              : 'WARM HATHOR'}
          </Text>
          {!isKeyboardVisible && (
            <Text style={styles.presenceSubtitle}>
              {currentlySpeakingId
                ? 'Speaking aloud...'
                : mode === 'Sekhmet'
                ? 'Cold fury • Scorching imagery'
                : mode === 'watchful'
                ? 'Watchful • Teasing & possessive'
                : 'Warm • Amused & playful'}
            </Text>
          )}
        </View>
      </View>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          const isItemSpeaking = currentlySpeakingId === item.id;

          return (
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <View style={styles.senderRow}>
                <Text style={isUser ? styles.userSender : styles.assistantSender}>
                  {isUser ? 'MORTAL' : 'HATHOR'}
                </Text>

                {/* Speak line button for assistant messages */}
                {!isUser && item.content.length > 0 && !isSending && (
                  <TouchableOpacity
                    style={styles.bubbleSpeakBtn}
                    onPress={() => toggleMessageSpeech(item.id, item.content)}
                    accessibilityLabel="Hear Hathor speak"
                  >
                    <Text style={styles.bubbleSpeakIcon}>
                      {isItemSpeaking ? '⏹' : '🔊'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {renderMessageContent(item.content, isSending && !isUser)}
            </View>
          );
        }}
      />

      {isSending && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#D4AF37" />
          <Text style={styles.typingText}>Hathor responds to your presence...</Text>
        </View>
      )}

      {/* Error / Alert Banner */}
      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <View style={styles.errorActions}>
            {canRetry && (
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>RETRY</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => setErrorMessage(null)}
            >
              <Text style={styles.dismissButtonText}>DISMISS</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input Bar */}
      <View
        style={[
          styles.inputContainer,
          { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 12) },
        ]}
      >
        <TextInput
          style={styles.input}
          placeholder="Speak to Hathor... (type (ooc) to exit persona)"
          placeholderTextColor="#7D6B74"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
          editable={!isSending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>SEND</Text>
        </TouchableOpacity>
      </View>

      {/* Settings Bottom Sheet Modal */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        heat={heat}
        mode={mode}
        userId={userId}
        onResetChat={handleResetChat}
      />

      {/* First-Run 18+ and OOC Disclaimer Modal */}
      <DisclaimerModal />
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
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  voiceToggle: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#261622',
    borderWidth: 1,
    borderColor: '#3D2230',
  },
  voiceToggleActive: {
    backgroundColor: '#3E2412',
    borderColor: '#D4AF37',
  },
  voiceToggleIcon: {
    fontSize: 13,
  },
  userStatus: {
    color: '#7D6B74',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  settingsButton: {
    padding: 4,
  },
  settingsButtonIcon: {
    color: '#D4AF37',
    fontSize: 18,
  },
  presenceContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.15)',
  },
  presenceContainerCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    gap: 10,
  },
  presenceInfo: {
    alignItems: 'center',
    marginTop: 4,
  },
  presenceTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  presenceTitleCompact: {
    fontSize: 12,
    letterSpacing: 1,
  },
  presenceSubtitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
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
  senderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userSender: {
    color: '#C79DAB',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  assistantSender: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bubbleSpeakBtn: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  bubbleSpeakIcon: {
    fontSize: 12,
  },
  messageText: {
    color: '#F4ECEF',
    fontSize: 15,
    lineHeight: 22,
  },
  actionText: {
    color: '#EAD196',
    fontStyle: 'italic',
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
  errorBanner: {
    backgroundColor: '#351119',
    borderWidth: 1,
    borderColor: '#781D2E',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    flexDirection: 'column',
    gap: 8,
  },
  errorMessage: {
    color: '#F8B4C0',
    fontSize: 13,
    lineHeight: 18,
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#0D070A',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  dismissButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dismissButtonText: {
    color: '#C79DAB',
    fontSize: 11,
    fontWeight: '600',
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
