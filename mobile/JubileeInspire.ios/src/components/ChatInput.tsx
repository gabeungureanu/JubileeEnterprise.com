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
import { colors, spacing, typography } from '../config';

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
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Message Jubilee Inspire...',
}) => {
  const [text, setText] = useState('');
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showMicTooltip, setShowMicTooltip] = useState(false);
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

    console.log('[ChatInput] Tool selected:', tool);

    // Handle different tool actions
    if (tool === 'file-upload' || tool === 'image-upload') {
      await handleFileAttachment();
    } else {
      // TODO: Implement other tool actions
      console.log('[ChatInput] Tool not yet implemented:', tool);
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

        {/* Microphone or Send Button */}
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
                size={24}
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
        )}
      </View>

      {/* Tools Menu Modal */}
      <Modal
        visible={showToolsMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowToolsMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowToolsMenu(false)}>
          <View style={styles.toolsMenu}>
            <View style={styles.toolsHeader}>
              <Text style={styles.toolsTitle}>Tools</Text>
              <TouchableOpacity onPress={() => setShowToolsMenu(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('bible-search')}
            >
              <Ionicons name="book-outline" size={24} color={colors.primary} />
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>Bible Search</Text>
                <Text style={styles.toolDescription}>Search Scripture passages</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('file-upload')}
            >
              <Ionicons name="attach-outline" size={24} color={colors.primary} />
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>Attach File</Text>
                <Text style={styles.toolDescription}>Upload documents, images, or files</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('image-upload')}
            >
              <Ionicons name="image-outline" size={24} color={colors.primary} />
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>Upload Image</Text>
                <Text style={styles.toolDescription}>Attach or capture a photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('voice-mode')}
            >
              <Ionicons name="mic-outline" size={24} color={colors.primary} />
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>Voice Mode</Text>
                <Text style={styles.toolDescription}>Speak with Jubilee Inspire</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('scripture-notes')}
            >
              <Ionicons name="document-text-outline" size={24} color={colors.primary} />
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>Scripture Notes</Text>
                <Text style={styles.toolDescription}>Add study notes</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolItem}
              onPress={() => handleToolSelect('bookmarks')}
            >
              <Ionicons name="bookmark-outline" size={24} color={colors.primary} />
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>Bookmarks</Text>
                <Text style={styles.toolDescription}>Save favorite verses</Text>
              </View>
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

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 0,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  toolsMenu: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? spacing['2xl'] : spacing.lg,
  },
  toolsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  toolTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  toolDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});

export default ChatInput;
