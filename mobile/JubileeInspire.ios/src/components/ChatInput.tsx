/**
 * Jubilee Inspire - Chat Input Component
 *
 * Message input with send button, plus menu, and microphone - styled like ChatGPT.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  centered?: boolean; // When true, center the input and limit width
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Message Jubilee Inspire...',
  centered = false,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors, centered);

  const [text, setText] = useState('');
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showMicTooltip, setShowMicTooltip] = useState(false);
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const [attachedFile, setAttachedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<any>(null);

  const handleSend = async () => {
    if (!text.trim() || disabled) return;

    // Haptic feedback
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onSend(text.trim());
    setText('');
    setAttachedFile(null); // Clear attachment after sending
  };

  const handleToolsMenu = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowToolsMenu(true);
  };

  const handleFileAttachment = async () => {
    try {
      console.log('[ChatInput] Opening file picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        console.log('[ChatInput] File selected:', file.name, file.mimeType);
        setAttachedFile(file);

        // Haptic feedback on successful selection
        if (Platform.OS === 'ios') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('[ChatInput] Error picking file:', error);
      Alert.alert('Error', 'Failed to select file. Please try again.');
    }
  };

  const handleRemoveAttachment = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    console.log('[ChatInput] Removing attachment');
    setAttachedFile(null);
  };

  const handleToolSelect = async (tool: string) => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowToolsMenu(false);
    setShowMoreMenu(false);

    console.log('[ChatInput] Tool selected:', tool);

    // Handle different tool actions
    switch (tool) {
      case 'add-photos':
        await handleFileAttachment();
        break;
      case 'create-image':
        Alert.alert('Create Image', 'Image generation feature coming soon!');
        break;
      case 'thinking':
        Alert.alert('Thinking Mode', 'Extended reasoning mode coming soon!');
        break;
      case 'deep-research':
        Alert.alert('Deep Research', 'Research mode coming soon!');
        break;
      case 'shopping-research':
        Alert.alert('Shopping Research', 'Shopping research coming soon!');
        break;
      case 'more':
        setShowMoreMenu(true);
        setShowToolsMenu(false);
        break;
      default:
        console.log('[ChatInput] Tool not yet implemented:', tool);
    }
  };

  const handleVoiceModeToggle = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowVoiceMode(!showVoiceMode);
    if (!showVoiceMode) {
      Alert.alert('Voice Mode', 'Full voice conversation mode coming soon!');
    }
  };

  // Initialize speech recognition on mount
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('');

          console.log('[ChatInput] Voice transcript:', transcript);
          setText(transcript);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          console.log('[ChatInput] Voice recognition ended');
          // Focus the input field so user can press Enter to send
          setTimeout(() => {
            if (inputRef.current) {
              console.log('[ChatInput] Focusing input field after voice input');
              inputRef.current.focus();
            }
          }, 100);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);

          if (event.error === 'not-allowed') {
            Alert.alert(
              'Microphone Access Denied',
              'Please allow microphone access in your browser settings to use voice input.'
            );
          } else if (event.error === 'no-speech') {
            Alert.alert('No Speech Detected', 'Please try speaking again.');
          }
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleVoiceInput = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (Platform.OS !== 'web') {
      Alert.alert('Not Supported', 'Voice input is currently only supported on web browsers.');
      return;
    }

    if (!recognitionRef.current) {
      Alert.alert(
        'Not Supported',
        'Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.'
      );
      return;
    }

    try {
      if (isListening) {
        // Stop listening
        recognitionRef.current.stop();
        setIsListening(false);
      } else {
        // Start listening
        setText(''); // Clear existing text
        recognitionRef.current.start();
        setIsListening(true);
        console.log('Voice recognition started');
      }
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      setIsListening(false);
      Alert.alert('Error', 'Failed to start voice recognition. Please try again.');
    }
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      {/* Attachment Preview */}
      {attachedFile && (
        <View style={styles.attachmentPreview}>
          <View style={styles.attachmentInfo}>
            <Ionicons name="document-attach" size={20} color={colors.primary} />
            <View style={styles.attachmentText}>
              <Text style={styles.attachmentName} numberOfLines={1}>
                {attachedFile.name}
              </Text>
              <Text style={styles.attachmentSize}>
                {attachedFile.size ? `${(attachedFile.size / 1024).toFixed(1)} KB` : 'Unknown size'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.removeAttachmentButton}
            onPress={handleRemoveAttachment}
          >
            <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputWrapper}>
        {/* Plus (+) Menu Button */}
        <TouchableOpacity
          style={styles.plusButton}
          onPress={handleToolsMenu}
          disabled={disabled}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={4000}
          editable={!disabled}
          returnKeyType="default"
          onKeyPress={(e) => {
            // Handle Enter key for web
            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !(e.nativeEvent as any).shiftKey) {
              e.preventDefault();
              if (text.trim()) {
                handleSend();
              }
            }
          }}
        />

        {/* Right side buttons - always show mic and voice, replace voice with send when text exists */}
        <View style={styles.rightButtons}>
          {/* Microphone Button - always visible */}
          <View style={styles.micButtonContainer}>
            <TouchableOpacity
              style={[styles.micButton, isListening && styles.micButtonActive]}
              onPress={handleVoiceInput}
              disabled={disabled}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setShowMicTooltip(true),
                onMouseLeave: () => setShowMicTooltip(false)
              } as any : {})}
            >
              <Ionicons
                name={isListening ? "mic" : "mic-outline"}
                size={22}
                color={isListening ? "#ef4444" : colors.textSecondary}
              />
            </TouchableOpacity>
            {showMicTooltip && Platform.OS === 'web' && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>
                  {isListening ? 'Stop listening' : 'Voice input'}
                </Text>
              </View>
            )}
          </View>

          {/* Voice Mode Button (wave icon) OR Send Button */}
          {canSend ? (
            <TouchableOpacity
              style={[styles.sendButton, styles.sendButtonActive]}
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-up" size={20} color="#000000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.voiceModeButton, showVoiceMode && styles.voiceModeButtonActive]}
              onPress={handleVoiceModeToggle}
              disabled={disabled}
            >
              <View style={styles.voiceWaveIcon}>
                <View style={[styles.voiceBar, styles.voiceBar1, showVoiceMode && styles.voiceBarActive]} />
                <View style={[styles.voiceBar, styles.voiceBar2, showVoiceMode && styles.voiceBarActive]} />
                <View style={[styles.voiceBar, styles.voiceBar3, showVoiceMode && styles.voiceBarActive]} />
                <View style={[styles.voiceBar, styles.voiceBar4, showVoiceMode && styles.voiceBarActive]} />
                <View style={[styles.voiceBar, styles.voiceBar5, showVoiceMode && styles.voiceBarActive]} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tools Menu Modal */}
      <Modal
        visible={showToolsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowToolsMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowToolsMenu(false)}>
          <View style={styles.toolsMenu}>
            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('add-photos')}
            >
              <Ionicons name="attach-outline" size={20} color={colors.text} />
              <Text style={styles.toolTitle}>Add photos & files</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('create-image')}
            >
              <Ionicons name="image-outline" size={20} color={colors.text} />
              <Text style={styles.toolTitle}>Create image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('thinking')}
            >
              <Ionicons name="bulb-outline" size={20} color={colors.text} />
              <Text style={styles.toolTitle}>Thinking</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('deep-research')}
            >
              <Ionicons name="search-outline" size={20} color={colors.text} />
              <Text style={styles.toolTitle}>Deep research</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('shopping-research')}
            >
              <Ionicons name="cart-outline" size={20} color={colors.text} />
              <Text style={styles.toolTitle}>Shopping research</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolItem, styles.lastToolItem]}
              onPress={() => handleToolSelect('more')}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
              <Text style={styles.toolTitle}>More</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={styles.chevron} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* More Menu Modal */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMoreMenu(false)}>
          <View style={styles.toolsMenu}>
            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('bible-search')}
            >
              <Ionicons name="book-outline" size={20} color={colors.text} />
              <Text style={styles.toolTitle}>Bible search</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('scripture-notes')}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.text} />
              <Text style={styles.toolTitle}>Scripture notes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolItem, styles.lastToolItem]}
              onPress={() => handleToolSelect('bookmarks')}
            >
              <Ionicons name="bookmark-outline" size={20} color={colors.text} />
              <Text style={styles.toolTitle}>Bookmarks</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.disclaimer}>
        {/* Empty for now, could add disclaimer text */}
      </View>
    </View>
  );
};

const createStyles = (colors: any, centered: boolean) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: centered ? 20 : spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 0,
    ...(centered ? { alignItems: 'center', width: '100%' } : {}),
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  attachmentText: {
    flex: 1,
  },
  attachmentName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  attachmentSize: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  removeAttachmentButton: {
    padding: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 48,
    ...(centered ? {
      maxWidth: 650,
      width: '100%',
    } : {}),
  },
  plusButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text,
    maxHeight: 120,
    paddingVertical: 0,
    paddingHorizontal: spacing.xs,
    textAlignVertical: 'center',
    lineHeight: Platform.OS === 'web' ? 20 : undefined,
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none',
      outlineWidth: 0,
    } as any : {}),
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  voiceModeButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceModeButtonActive: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: 20,
  },
  micButtonContainer: {
    position: 'relative',
  },
  micButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: {
    backgroundColor: '#fee2e2',
    borderRadius: 20,
  },
  tooltip: {
    position: 'absolute',
    bottom: '120%',
    right: -10,
    backgroundColor: '#1f2937',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 6,
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      },
    }),
  },
  tooltipText: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    ...(Platform.OS === 'web' ? { whiteSpace: 'nowrap' } as any : {}),
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4f4f4f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#ffffff',
  },
  disclaimer: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'web' ? 60 : 100,
    paddingLeft: spacing.md,
  },
  toolsMenu: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 280,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastToolItem: {
    borderBottomWidth: 0,
  },
  toolTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '400',
    color: colors.text,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
  voiceWaveIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 22,
    width: 22,
  },
  voiceBar: {
    width: 3,
    backgroundColor: colors.textSecondary,
    borderRadius: 1.5,
  },
  voiceBar1: {
    height: 8,
  },
  voiceBar2: {
    height: 14,
  },
  voiceBar3: {
    height: 20,
  },
  voiceBar4: {
    height: 14,
  },
  voiceBar5: {
    height: 8,
  },
  voiceBarActive: {
    backgroundColor: colors.primary,
  },
});

export default ChatInput;
