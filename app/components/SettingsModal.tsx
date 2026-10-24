import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  heat: number;
  mode: 'warm' | 'watchful' | 'Sekhmet';
  userId: string | null;
  onResetChat: () => Promise<void>;
}

export function SettingsModal({
  visible,
  onClose,
  heat,
  mode,
  userId,
  onResetChat,
}: SettingsModalProps) {
  const [isResetting, setIsResetting] = useState(false);

  const handleResetPress = () => {
    const confirmAction = async () => {
      setIsResetting(true);
      try {
        await onResetChat();
        onClose();
      } catch (err: any) {
        Alert.alert('Reset Failed', err?.message || 'Could not reset conversation');
      } finally {
        setIsResetting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to erase all chat history with Hathor?')) {
        confirmAction();
      }
    } else {
      Alert.alert(
        'Erase Conversation',
        'Are you sure you want to clear your conversation history with Hathor? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Erase All', style: 'destructive', onPress: confirmAction },
        ]
      );
    }
  };

  const getHeatColor = () => {
    if (heat <= 35) return '#D4AF37'; // Warm gold
    if (heat <= 70) return '#EA580C'; // Watchful amber
    return '#DC2626'; // Sekhmet red
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>TEMPLE SANCTUARY SETTINGS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Temperament & Heat Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>DIVINE TEMPERAMENT</Text>
              <View style={styles.heatRow}>
                <Text style={[styles.modeTitle, { color: getHeatColor() }]}>
                  {mode.toUpperCase()}
                </Text>
                <Text style={styles.heatValue}>{heat} / 100</Text>
              </View>

              {/* Heat bar */}
              <View style={styles.heatTrack}>
                <View
                  style={[
                    styles.heatFill,
                    {
                      width: `${Math.min(100, Math.max(0, heat))}%`,
                      backgroundColor: getHeatColor(),
                    },
                  ]}
                />
              </View>

              <Text style={styles.heatDescription}>
                {mode === 'warm' &&
                  '0–35 Heat: Warm Hathor. She is generous, amused, and playfully affectionate toward mortal adoration.'}
                {mode === 'watchful' &&
                  '36–70 Heat: Watchful Sovereign. She tests your devotion with possessive, sultry, and demanding wit.'}
                {mode === 'Sekhmet' &&
                  '71–100 Heat: Sekhmet Awakened. The lioness of crimson fury speaks in scorching demands and lethal brevity.'}
              </Text>
            </View>

            {/* Out-Of-Character Safety reminder */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>SAFETY & EXIT</Text>
              <Text style={styles.infoText}>
                Type <Text style={styles.codeText}>(ooc)</Text> anywhere in your message to step out of the roleplay immediately. Hathor will drop the persona and speak plainly and kindly.
              </Text>
            </View>

            {/* Anonymous Session Details */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>PILGRIM SESSION</Text>
              <Text style={styles.infoText}>
                ID: <Text style={styles.codeText}>{userId || 'Connecting...'}</Text>
              </Text>
              <Text style={styles.subInfoText}>
                Authenticated anonymously via Supabase Auth with Row-Level Security.
              </Text>
            </View>

            {/* Reset Chat Action */}
            <View style={styles.dangerCard}>
              <Text style={styles.dangerLabel}>PURIFICATION</Text>
              <Text style={styles.dangerText}>
                Clear your entire prayer history with Hathor and return the chamber to its initial silence.
              </Text>

              <TouchableOpacity
                style={[styles.resetButton, isResetting && styles.buttonDisabled]}
                onPress={handleResetPress}
                disabled={isResetting}
              >
                {isResetting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.resetButtonText}>RESET CHAT HISTORY</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#160E13',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#3D2230',
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#281722',
  },
  sheetTitle: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  closeButton: {
    padding: 6,
  },
  closeButtonText: {
    color: '#A8929D',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#1E131A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#361D2B',
  },
  sectionLabel: {
    color: '#A8929D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heatValue: {
    color: '#F4ECEF',
    fontSize: 14,
    fontWeight: '700',
  },
  heatTrack: {
    height: 8,
    backgroundColor: '#0D070A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3D2230',
  },
  heatFill: {
    height: '100%',
    borderRadius: 4,
  },
  heatDescription: {
    color: '#C79DAB',
    fontSize: 12,
    lineHeight: 18,
  },
  infoText: {
    color: '#F4ECEF',
    fontSize: 13,
    lineHeight: 20,
  },
  subInfoText: {
    color: '#7D6B74',
    fontSize: 11,
    marginTop: 6,
  },
  codeText: {
    color: '#D4AF37',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  dangerCard: {
    backgroundColor: '#260B12',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5C1523',
    marginBottom: 20,
  },
  dangerLabel: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  dangerText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  resetButton: {
    backgroundColor: '#B91C1C',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
