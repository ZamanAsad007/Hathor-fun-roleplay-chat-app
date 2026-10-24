import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

const DISCLAIMER_STORAGE_KEY = 'hathor_adult_disclaimer_accepted_v1';

interface DisclaimerModalProps {
  onAccepted?: () => void;
}

export function DisclaimerModal({ onAccepted }: DisclaimerModalProps) {
  const [visible, setVisible] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkDisclaimer() {
      try {
        let accepted = null;
        if (Platform.OS === 'web') {
          accepted = typeof localStorage !== 'undefined' ? localStorage.getItem(DISCLAIMER_STORAGE_KEY) : 'true';
        } else {
          accepted = await SecureStore.getItemAsync(DISCLAIMER_STORAGE_KEY);
        }

        if (accepted !== 'true') {
          setVisible(true);
        }
      } catch (err) {
        console.warn('Error reading disclaimer acceptance:', err);
      } finally {
        setIsChecking(false);
      }
    }
    checkDisclaimer();
  }, []);

  const handleAccept = async () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
      } else {
        await SecureStore.setItemAsync(DISCLAIMER_STORAGE_KEY, 'true');
      }
      setVisible(false);
      onAccepted?.();
    } catch (err) {
      console.warn('Error saving disclaimer acceptance:', err);
      setVisible(false);
    }
  };

  if (isChecking || !visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.courtBadge}>SACRED THRESHOLD</Text>
          <Text style={styles.title}>HATHOR</Text>
          <Text style={styles.subtitle}>Goddess of the Golden Horizon</Text>

          <View style={styles.divider} />

          <View style={styles.noticeBox}>
            <Text style={styles.noticeTag}>NOTICE & COMMUNITY GUIDELINES</Text>
            <Text style={styles.ruleItem}>
              • <Text style={styles.boldText}>Fictional Character</Text>: Hathor is an AI-powered roleplay persona. All interactions are simulated and fictional.
            </Text>
            <Text style={styles.ruleItem}>
              • <Text style={styles.boldText}>Adults Only (18+)</Text>: This experience features sultry, dramatic, possessive, and menacing deity roleplay intended solely for mature audiences.
            </Text>
            <Text style={styles.ruleItem}>
              • <Text style={styles.boldText}>Safety Mechanism</Text>: If you ever feel distressed, confused, or want to speak normally, simply type <Text style={styles.highlightText}>(ooc)</Text> at any time. Hathor will drop the persona immediately and speak kindly.
            </Text>
          </View>

          <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
            <Text style={styles.acceptButtonText}>I AM 18+ • ENTER SANCTUARY</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0507',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#160E13',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#3D2230',
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  courtBadge: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    color: '#FFF8F0',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
  },
  subtitle: {
    color: '#C79DAB',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  divider: {
    height: 1,
    width: '80%',
    backgroundColor: '#301824',
    marginVertical: 20,
  },
  noticeBox: {
    backgroundColor: '#1E121A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 12,
    borderWidth: 1,
    borderColor: '#381C2C',
    marginBottom: 24,
  },
  noticeTag: {
    color: '#EAD196',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  ruleItem: {
    color: '#EDE3E7',
    fontSize: 13,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  highlightText: {
    color: '#D4AF37',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  acceptButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonText: {
    color: '#0D070A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
