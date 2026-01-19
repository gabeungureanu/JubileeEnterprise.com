/**
 * Jubilee Inspire - Voice Mode Component
 *
 * Full-screen voice conversation mode similar to ChatGPT.
 * Features:
 * - Speech-to-Text (STT) for user input
 * - Text-to-Speech (TTS) for AI responses
 * - Visual audio wave animation
 * - Voice selection
 * - Mute/unmute controls
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

// Helper function to get initials from a name
const getInitials = (name: string): string => {
  if (!name) return 'GU';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    speechSynthesis: SpeechSynthesis;
    SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance;
  }
}

// Available voice options
const VOICE_OPTIONS = [
  { id: 'default', name: 'Jubilee', description: 'Warm and friendly' },
  { id: 'professional', name: 'Grace', description: 'Clear and professional' },
  { id: 'calm', name: 'Peace', description: 'Calm and soothing' },
  { id: 'energetic', name: 'Joy', description: 'Upbeat and energetic' },
];

interface VoiceModeProps {
  visible: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => Promise<string>;
}

type VoiceModeState = 'idle' | 'listening' | 'processing' | 'speaking';

const VoiceMode: React.FC<VoiceModeProps> = ({
  visible,
  onClose,
  onSendMessage,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();

  // Get user initials for avatar
  const userInitials = getInitials(user?.displayName || 'Guest');
  const styles = createStyles(colors);

  // State
  const [state, setState] = useState<VoiceModeState>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0]);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.5),
    new Animated.Value(0.7),
    new Animated.Value(0.5),
    new Animated.Value(0.3),
  ]).current;

  // Initialize Speech Recognition and Synthesis
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Initialize Speech Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          setTranscript(finalTranscript || interimTranscript);

          // If we have a final result and silence, process it
          if (finalTranscript && event.results[event.results.length - 1].isFinal) {
            handleUserSpeechComplete(finalTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('[VoiceMode] Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setError('Microphone access denied. Please allow microphone access.');
          } else if (event.error !== 'aborted') {
            setError('Speech recognition error. Please try again.');
          }
          setState('idle');
        };

        recognitionRef.current.onend = () => {
          // Restart if we're still in listening mode and not muted
          if (state === 'listening' && !isMuted && visible) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              // Already started
            }
          }
        };
      }

      // Initialize Speech Synthesis
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      stopListening();
      stopSpeaking();
    };
  }, []);

  // Start/stop listening based on visibility
  useEffect(() => {
    if (visible && !isMuted) {
      startListening();
    } else {
      stopListening();
      stopSpeaking();
    }
  }, [visible]);

  // Pulse animation for the main circle
  useEffect(() => {
    if (state === 'listening' || state === 'speaking') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Wave animation for audio visualization
  useEffect(() => {
    if (state === 'listening' || state === 'speaking') {
      const animations = waveAnims.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 300 + index * 100,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 300 + index * 100,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
      });

      animations.forEach(anim => anim.start());

      return () => {
        animations.forEach(anim => anim.stop());
      };
    } else {
      waveAnims.forEach(anim => anim.setValue(0.3));
    }
  }, [state]);

  const startListening = useCallback(() => {
    if (Platform.OS !== 'web') {
      setError('Voice mode is currently only supported on web browsers.');
      return;
    }

    if (!recognitionRef.current) {
      setError('Speech recognition not available in this browser.');
      return;
    }

    try {
      setError(null);
      setTranscript('');
      recognitionRef.current.start();
      setState('listening');
      console.log('[VoiceMode] Started listening');
    } catch (e) {
      console.error('[VoiceMode] Error starting recognition:', e);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }
    if (state === 'listening') {
      setState('idle');
    }
  }, [state]);

  const handleUserSpeechComplete = async (userText: string) => {
    if (!userText.trim()) return;

    console.log('[VoiceMode] User said:', userText);
    setState('processing');

    try {
      // Send message and get AI response
      const response = await onSendMessage(userText.trim());
      setAiResponse(response);

      // Speak the response
      if (response && !isMuted) {
        speakResponse(response);
      } else {
        // Resume listening if muted
        setState('listening');
        startListening();
      }
    } catch (error) {
      console.error('[VoiceMode] Error getting response:', error);
      setError('Failed to get response. Please try again.');
      setState('listening');
      startListening();
    }
  };

  const speakResponse = (text: string) => {
    if (Platform.OS !== 'web' || !synthRef.current) return;

    setState('speaking');

    // Cancel any ongoing speech
    synthRef.current.cancel();

    utteranceRef.current = new window.SpeechSynthesisUtterance(text);
    utteranceRef.current.rate = 1.0;
    utteranceRef.current.pitch = 1.0;
    utteranceRef.current.volume = 1.0;

    // Try to find a suitable voice
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(
      voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
    ) || voices.find(voice => voice.lang.startsWith('en'));

    if (preferredVoice) {
      utteranceRef.current.voice = preferredVoice;
    }

    utteranceRef.current.onend = () => {
      console.log('[VoiceMode] Finished speaking');
      setTranscript('');
      setState('listening');
      if (!isMuted && visible) {
        startListening();
      }
    };

    utteranceRef.current.onerror = (event) => {
      console.error('[VoiceMode] Speech synthesis error:', event);
      setState('listening');
      if (!isMuted && visible) {
        startListening();
      }
    };

    synthRef.current.speak(utteranceRef.current);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (state === 'speaking') {
      setState('idle');
    }
  };

  const toggleMute = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newMuted = !isMuted;
    setIsMuted(newMuted);

    if (newMuted) {
      stopListening();
      stopSpeaking();
      setState('idle');
    } else {
      startListening();
    }
  };

  const handleClose = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    stopListening();
    stopSpeaking();
    setState('idle');
    setTranscript('');
    setAiResponse('');
    setError(null);
    onClose();
  };

  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return transcript || 'Listening...';
      case 'processing':
        return 'Thinking...';
      case 'speaking':
        return aiResponse || 'Speaking...';
      case 'idle':
      default:
        return isMuted ? 'Muted - Tap microphone to unmute' : 'Tap to start speaking';
    }
  };

  const getMainColor = () => {
    switch (state) {
      case 'listening':
        return '#ffbd59'; // Gold - listening
      case 'processing':
        return '#60a5fa'; // Blue - processing
      case 'speaking':
        return '#34d399'; // Green - speaking
      default:
        return isMuted ? '#6b7280' : '#ffbd59'; // Gray if muted, gold otherwise
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Voice Mode</Text>

          <TouchableOpacity
            style={styles.voiceProfileButton}
            onPress={() => setShowVoiceSelector(true)}
          >
            <View style={styles.voiceAvatarInitials}>
              <Text style={styles.voiceInitialsText}>{userInitials}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Audio Visualization */}
          <Animated.View
            style={[
              styles.mainCircle,
              {
                backgroundColor: getMainColor(),
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            {/* Wave Bars */}
            <View style={styles.waveContainer}>
              {waveAnims.map((anim, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.waveBar,
                    {
                      height: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 60],
                      }),
                      backgroundColor: state === 'idle' ? '#ffffff80' : '#ffffff',
                    },
                  ]}
                />
              ))}
            </View>
          </Animated.View>

          {/* Status Text */}
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>
              {state === 'listening' ? 'You' : state === 'speaking' ? 'Jubilee' : ''}
            </Text>
            <Text style={styles.statusText} numberOfLines={3}>
              {getStatusText()}
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {/* Bottom Controls */}
        <View style={styles.controls}>
          {/* Mute Button */}
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonMuted]}
            onPress={toggleMute}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={28}
              color={isMuted ? '#ef4444' : colors.text}
            />
          </TouchableOpacity>

          {/* End Call Button */}
          <TouchableOpacity
            style={styles.endButton}
            onPress={handleClose}
          >
            <Ionicons name="call" size={32} color="#ffffff" />
          </TouchableOpacity>

          {/* Speaker Button (placeholder for future audio output control) */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              // Toggle speaker/earpiece (future implementation)
            }}
          >
            <Ionicons name="volume-high" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Voice Selector Modal */}
        <Modal
          visible={showVoiceSelector}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowVoiceSelector(false)}
        >
          <View style={styles.voiceSelectorOverlay}>
            <View style={styles.voiceSelectorContainer}>
              <View style={styles.voiceSelectorHeader}>
                <Text style={styles.voiceSelectorTitle}>Choose a Voice</Text>
                <TouchableOpacity onPress={() => setShowVoiceSelector(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {VOICE_OPTIONS.map((voice) => (
                <TouchableOpacity
                  key={voice.id}
                  style={[
                    styles.voiceOption,
                    selectedVoice.id === voice.id && styles.voiceOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedVoice(voice);
                    setShowVoiceSelector(false);
                  }}
                >
                  <View style={styles.voiceOptionContent}>
                    <Text style={styles.voiceOptionName}>{voice.name}</Text>
                    <Text style={styles.voiceOptionDescription}>{voice.description}</Text>
                  </View>
                  {selectedVoice.id === voice.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#ffbd59" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#1a1a1a',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 20,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#2f2f2f',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    voiceButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#2f2f2f',
      justifyContent: 'center',
      alignItems: 'center',
    },
    voiceProfileButton: {
      padding: 4,
    },
    voiceAvatarInitials: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    voiceInitialsText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ffffff',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    mainCircle: {
      width: 200,
      height: 200,
      borderRadius: 100,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 40,
    },
    waveContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    waveBar: {
      width: 6,
      borderRadius: 3,
    },
    statusContainer: {
      alignItems: 'center',
      minHeight: 80,
    },
    statusLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: '#9ca3af',
      marginBottom: 8,
    },
    statusText: {
      fontSize: 20,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 28,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fee2e2',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 20,
      gap: 8,
    },
    errorText: {
      fontSize: 14,
      color: '#b91c1c',
      flex: 1,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: Platform.OS === 'ios' ? 50 : 30,
      gap: 40,
    },
    controlButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#2f2f2f',
      justifyContent: 'center',
      alignItems: 'center',
    },
    controlButtonMuted: {
      backgroundColor: '#fee2e2',
    },
    endButton: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: '#ef4444',
      justifyContent: 'center',
      alignItems: 'center',
      transform: [{ rotate: '135deg' }],
    },
    voiceSelectorOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    voiceSelectorContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    voiceSelectorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    voiceSelectorTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    voiceOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    voiceOptionSelected: {
      backgroundColor: 'rgba(255, 189, 89, 0.1)',
    },
    voiceOptionContent: {
      flex: 1,
    },
    voiceOptionName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    voiceOptionDescription: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

export default VoiceMode;
