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
  placeholder = 'Ask Jubilee Anything...',
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
  const [showVoiceModeTooltip, setShowVoiceModeTooltip] = useState(false);
  const [attachedFile, setAttachedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [inputHeight, setInputHeight] = useState(24); // Initial height for single line
  const [isFocused, setIsFocused] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 30 });
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  const plusButtonRef = useRef<any>(null);

  // Constants for auto-expanding textarea
  const LINE_HEIGHT = 20;
  const MAX_LINES = 7;
  const MIN_HEIGHT = 24; // Single line height
  const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES; // 140px for 7 lines

  const handleSend = async () => {
    if (!text.trim() || disabled) return;

    // Haptic feedback
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onSend(text.trim());
    setText('');
    setAttachedFile(null); // Clear attachment after sending
    setInputHeight(MIN_HEIGHT); // Reset height after sending
  };

  const handleToolsMenu = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Measure plus button position to position menu above it
    if (plusButtonRef.current) {
      plusButtonRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        // Position menu above the button, left-aligned with button
        // Menu height is approximately 300px (6 items * ~50px each)
        const menuHeight = 300;
        const topPosition = y - menuHeight - 8; // 8px gap above the button
        setMenuPosition({
          top: Math.max(10, topPosition), // Ensure minimum 10px from top
          left: x,
        });
        setShowToolsMenu(true);
      });
    } else {
      setShowToolsMenu(true);
    }
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
        // Keep tools menu open when showing more menu
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

  // Reference for hidden measurement div (web only)
  const measureRef = useRef<any>(null);

  // Handle content size change for auto-expanding textarea (native platforms)
  const handleContentSizeChange = (event: any) => {
    if (Platform.OS !== 'web') {
      const contentHeight = event.nativeEvent.contentSize.height;
      // Clamp height between MIN_HEIGHT and MAX_HEIGHT
      const newHeight = Math.min(Math.max(contentHeight, MIN_HEIGHT), MAX_HEIGHT);
      setInputHeight(newHeight);
    }
  };

  // Calculate height for web by measuring actual content
  const calculateWebHeight = (inputText: string) => {
    if (Platform.OS !== 'web') return;

    if (!inputText || inputText.length === 0) {
      setInputHeight(MIN_HEIGHT);
      return;
    }

    // Use a temporary element to measure text height
    if (typeof document !== 'undefined') {
      const measureEl = document.getElementById('chat-input-measure');
      if (measureEl) {
        // Set the same text content
        measureEl.textContent = inputText;
        // Add a trailing character to account for cursor line
        if (inputText.endsWith('\n')) {
          measureEl.textContent += ' ';
        }
        // Get the scroll height
        const scrollHeight = measureEl.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
        setInputHeight(newHeight);
      }
    }
  };

  // Handle text change
  const handleTextChange = (newText: string) => {
    setText(newText);

    // For web, calculate height based on content
    if (Platform.OS === 'web') {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        calculateWebHeight(newText);
      });
    }
  };

  const canSend = text.trim().length > 0 && !disabled;

  // Create hidden measurement element and inject CSS for hiding scrollbar on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Check if element already exists
      let measureEl = document.getElementById('chat-input-measure');
      if (!measureEl) {
        measureEl = document.createElement('div');
        measureEl.id = 'chat-input-measure';
        measureEl.style.cssText = `
          position: absolute;
          visibility: hidden;
          height: auto;
          width: 550px;
          max-width: 550px;
          padding: 2px 8px;
          font-size: 16px;
          line-height: 20px;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
          pointer-events: none;
        `;
        document.body.appendChild(measureEl);
      }

      // Add CSS to hide scrollbar on textarea (for WebKit browsers)
      let styleEl = document.getElementById('chat-input-scrollbar-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'chat-input-scrollbar-style';
        styleEl.textContent = `
          textarea::-webkit-scrollbar {
            display: none;
          }
        `;
        document.head.appendChild(styleEl);
      }

      return () => {
        // Cleanup on unmount
        const el = document.getElementById('chat-input-measure');
        if (el) {
          el.remove();
        }
        const styleElement = document.getElementById('chat-input-scrollbar-style');
        if (styleElement) {
          styleElement.remove();
        }
      };
    }
  }, []);

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

      <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
        {/* Plus (+) Menu Button */}
        <TouchableOpacity
          ref={plusButtonRef}
          style={[
            styles.plusButton,
            inputHeight > MIN_HEIGHT && { alignSelf: 'flex-end' },
          ]}
          onPress={handleToolsMenu}
          disabled={disabled}
        >
          <Ionicons name="add" size={22} color="#ffffff" />
        </TouchableOpacity>

        {/* TextInput - scrollbar hidden, overflow handled by wrapper */}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              height: inputHeight,
              maxHeight: MAX_HEIGHT,
              // Center text vertically for single line, align to top for multiline
              textAlignVertical: inputHeight > MIN_HEIGHT ? 'top' : 'center',
            },
            // Web-specific styles - hide the native scrollbar
            Platform.OS === 'web' && {
              paddingTop: 0,
              paddingBottom: 0,
              overflowY: inputHeight >= MAX_HEIGHT ? 'scroll' : 'hidden',
              // Hide scrollbar but keep functionality
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none', // IE/Edge
            } as any,
          ]}
          value={text}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor="#ffffff"
          multiline
          maxLength={4000}
          editable={!disabled}
          returnKeyType="default"
          scrollEnabled={inputHeight >= MAX_HEIGHT}
          onContentSizeChange={handleContentSizeChange}
          onKeyPress={(e) => {
            // Handle Enter key for web
            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !(e.nativeEvent as any).shiftKey) {
              e.preventDefault();
              if (text.trim()) {
                handleSend();
              }
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {/* Right side buttons */}
        <View style={[
          styles.rightButtons,
          inputHeight > MIN_HEIGHT && { alignSelf: 'flex-end' },
        ]}>
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
                  {isListening ? 'Stop listening' : 'Dictate'}
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
            <View style={styles.voiceModeButtonContainer}>
              <TouchableOpacity
                style={[styles.voiceModeButton, showVoiceMode && styles.voiceModeButtonActive]}
                onPress={handleVoiceModeToggle}
                disabled={disabled}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setShowVoiceModeTooltip(true),
                  onMouseLeave: () => setShowVoiceModeTooltip(false)
                } as any : {})}
              >
                <View style={styles.voiceWaveIcon}>
                  <View style={[styles.voiceBar, styles.voiceBar1, showVoiceMode && styles.voiceBarActive]} />
                  <View style={[styles.voiceBar, styles.voiceBar2, showVoiceMode && styles.voiceBarActive]} />
                  <View style={[styles.voiceBar, styles.voiceBar3, showVoiceMode && styles.voiceBarActive]} />
                  <View style={[styles.voiceBar, styles.voiceBar4, showVoiceMode && styles.voiceBarActive]} />
                  <View style={[styles.voiceBar, styles.voiceBar5, showVoiceMode && styles.voiceBarActive]} />
                </View>
              </TouchableOpacity>
              {showVoiceModeTooltip && Platform.OS === 'web' && (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipText}>Voice Input</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Tools Menu Modal - covers full screen for outside click detection */}
      <Modal
        visible={showToolsMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowToolsMenu(false);
          setShowMoreMenu(false);
        }}
      >
        {/* Full screen pressable overlay to close menu */}
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowToolsMenu(false);
            setShowMoreMenu(false);
          }}
        >
          {/* Menu container positioned above the + button */}
          <Pressable
            style={[styles.menuContainer, { top: menuPosition.top, left: menuPosition.left }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Main Tools Menu */}
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

              {/* More item with hover behavior */}
              <View
                style={[styles.toolItem, styles.lastToolItem]}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setShowMoreMenu(true),
                  onMouseLeave: () => setShowMoreMenu(false),
                } as any : {})}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
                <Text style={styles.toolTitle}>More</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={styles.chevron} />

                {/* More Menu - appears on hover */}
                {showMoreMenu && (
                  <View style={styles.moreMenuPopup}>
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
                )}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.disclaimer}>
        <Text style={styles.copyrightText}>
          Copyright © 2026 JubileeInspire.com | All Rights Reserved. JubileeVerse and AI can make mistakes. | Privacy Policy | Terms of Use
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors: any, centered: boolean) => StyleSheet.create({
  container: {
    paddingHorizontal: 30,
    paddingTop: centered ? 5 : spacing.sm,
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
    alignItems: 'center', // Center items vertically
    backgroundColor: '#5a5a5a',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#5a5a5a',
    paddingLeft: 15,
    paddingRight: 15,
    paddingVertical: spacing.sm,
    minHeight: 48,
    width: '100%',
    maxWidth: centered ? 700 : undefined,
  },
  inputWrapperFocused: {
    borderWidth: 2,
    borderColor: '#ffbd59',
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#6b6b6b',
    borderWidth: 1,
    borderColor: '#7b7b7b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text,
    paddingVertical: 0,
    paddingHorizontal: spacing.xs,
    lineHeight: 20,
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none',
      outlineWidth: 0,
      resize: 'none', // Prevent manual resize on web
    } as any : {}),
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceModeButtonContainer: {
    position: 'relative',
  },
  voiceModeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffbd59',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceModeButtonActive: {
    backgroundColor: '#e6a94f',
  },
  micButtonContainer: {
    position: 'relative',
  },
  micButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#6b6b6b',
    borderWidth: 1,
    borderColor: '#7b7b7b',
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
    marginTop: 5,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: 11,
    color: '#777777',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    position: 'absolute',
    flexDirection: 'row',
  },
  toolsMenu: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 220,
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
  moreMenuPopup: {
    position: 'absolute',
    left: '100%', // Position to the right of the parent
    bottom: 0,
    marginLeft: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 200,
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
    height: 18,
    width: 18,
  },
  voiceBar: {
    width: 2.5,
    backgroundColor: '#000000',
    borderRadius: 1.25,
  },
  voiceBar1: {
    height: 6,
  },
  voiceBar2: {
    height: 10,
  },
  voiceBar3: {
    height: 14,
  },
  voiceBar4: {
    height: 10,
  },
  voiceBar5: {
    height: 6,
  },
  voiceBarActive: {
    backgroundColor: '#000000',
  },
});

export default ChatInput;
