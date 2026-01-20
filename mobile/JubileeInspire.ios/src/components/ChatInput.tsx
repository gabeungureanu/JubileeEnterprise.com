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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import VoiceMode from './VoiceMode';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatInputProps {
  onSend: (message: string) => void;
  onSendWithResponse?: (message: string) => Promise<string>; // For voice mode - sends and returns AI response
  disabled?: boolean;
  placeholder?: string;
  centered?: boolean; // When true, center the input and limit width
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onSendWithResponse,
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
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
  const [showTermsOfUse, setShowTermsOfUse] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
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
        const topPosition = y - menuHeight + 17; // 25px lower than before (was -8, now +17)
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
    setShowVoiceMode(true);
  };

  const handleVoiceModeClose = () => {
    setShowVoiceMode(false);
  };

  const handleVoiceModeSend = async (message: string): Promise<string> => {
    // If we have a callback for getting responses, use it
    if (onSendWithResponse) {
      return await onSendWithResponse(message);
    }
    // Otherwise, just send the message and return a placeholder
    onSend(message);
    return 'Message received. Check the chat for my response.';
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
          <Ionicons name="add" size={22} color={colors.chatInputButtonIcon} />
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
          placeholderTextColor={colors.placeholder}
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
                style={[styles.toolItem, hoveredMenuItem === 'add-photos' && styles.toolItemHovered]}
                onPress={() => handleToolSelect('add-photos')}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setHoveredMenuItem('add-photos'),
                  onMouseLeave: () => setHoveredMenuItem(null),
                } as any : {})}
              >
                <Ionicons name="attach-outline" size={20} color={colors.text} />
                <Text style={styles.toolTitle}>Add photos & files</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolItem, hoveredMenuItem === 'create-image' && styles.toolItemHovered]}
                onPress={() => handleToolSelect('create-image')}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setHoveredMenuItem('create-image'),
                  onMouseLeave: () => setHoveredMenuItem(null),
                } as any : {})}
              >
                <Ionicons name="image-outline" size={20} color={colors.text} />
                <Text style={styles.toolTitle}>Create image</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolItem, hoveredMenuItem === 'thinking' && styles.toolItemHovered]}
                onPress={() => handleToolSelect('thinking')}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setHoveredMenuItem('thinking'),
                  onMouseLeave: () => setHoveredMenuItem(null),
                } as any : {})}
              >
                <Ionicons name="bulb-outline" size={20} color={colors.text} />
                <Text style={styles.toolTitle}>Thinking</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolItem, hoveredMenuItem === 'deep-research' && styles.toolItemHovered]}
                onPress={() => handleToolSelect('deep-research')}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setHoveredMenuItem('deep-research'),
                  onMouseLeave: () => setHoveredMenuItem(null),
                } as any : {})}
              >
                <Ionicons name="search-outline" size={20} color={colors.text} />
                <Text style={styles.toolTitle}>Deep research</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolItem, hoveredMenuItem === 'shopping-research' && styles.toolItemHovered]}
                onPress={() => handleToolSelect('shopping-research')}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setHoveredMenuItem('shopping-research'),
                  onMouseLeave: () => setHoveredMenuItem(null),
                } as any : {})}
              >
                <Ionicons name="cart-outline" size={20} color={colors.text} />
                <Text style={styles.toolTitle}>Shopping research</Text>
              </TouchableOpacity>

              {/* More item with hover behavior */}
              <View
                style={[styles.toolItem, styles.lastToolItem, hoveredMenuItem === 'more' && styles.toolItemHovered]}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => { setShowMoreMenu(true); setHoveredMenuItem('more'); },
                  onMouseLeave: () => { setShowMoreMenu(false); setHoveredMenuItem(null); },
                } as any : {})}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
                <Text style={styles.toolTitle}>More</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={styles.chevron} />

                {/* More Menu - appears on hover */}
                {showMoreMenu && (
                  <View style={styles.moreMenuPopup}>
                    <TouchableOpacity
                      style={[styles.toolItem, hoveredMenuItem === 'bible-search' && styles.toolItemHovered]}
                      onPress={() => handleToolSelect('bible-search')}
                      {...(Platform.OS === 'web' ? {
                        onMouseEnter: () => setHoveredMenuItem('bible-search'),
                        onMouseLeave: () => setHoveredMenuItem('more'),
                      } as any : {})}
                    >
                      <Ionicons name="book-outline" size={20} color={colors.text} />
                      <Text style={styles.toolTitle}>Bible search</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.toolItem, hoveredMenuItem === 'scripture-notes' && styles.toolItemHovered]}
                      onPress={() => handleToolSelect('scripture-notes')}
                      {...(Platform.OS === 'web' ? {
                        onMouseEnter: () => setHoveredMenuItem('scripture-notes'),
                        onMouseLeave: () => setHoveredMenuItem('more'),
                      } as any : {})}
                    >
                      <Ionicons name="document-text-outline" size={20} color={colors.text} />
                      <Text style={styles.toolTitle}>Scripture notes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.toolItem, styles.lastToolItem, hoveredMenuItem === 'bookmarks' && styles.toolItemHovered]}
                      onPress={() => handleToolSelect('bookmarks')}
                      {...(Platform.OS === 'web' ? {
                        onMouseEnter: () => setHoveredMenuItem('bookmarks'),
                        onMouseLeave: () => setHoveredMenuItem('more'),
                      } as any : {})}
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
          Copyright © 2026 JubileeInspire.com | All Rights Reserved. JubileeVerse and AI can make mistakes. |{' '}
          <Text style={styles.copyrightLink} onPress={() => setShowPrivacyPolicy(true)}>Privacy Policy</Text>
          {' | '}
          <Text style={styles.copyrightLink} onPress={() => setShowTermsOfUse(true)}>Terms of Use</Text>
        </Text>
      </View>

      {/* Voice Mode Full-Screen Overlay */}
      <VoiceMode
        visible={showVoiceMode}
        onClose={handleVoiceModeClose}
        onSendMessage={handleVoiceModeSend}
      />

      {/* Terms of Use Modal */}
      <Modal
        visible={showTermsOfUse}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTermsOfUse(false)}
      >
        <View style={styles.termsModalOverlay}>
          <View style={styles.termsModalContainer}>
            <View style={styles.termsModalHeader}>
              <Text style={styles.termsModalTitle}>Terms of Use (EULA)</Text>
              <TouchableOpacity
                style={styles.termsCloseButton}
                onPress={() => setShowTermsOfUse(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.termsContent}
              showsVerticalScrollIndicator={true}
              {...(Platform.OS === 'web' ? { className: 'themed-scrollbar' } as any : {})}
            >
              <Text style={styles.termsIntro}>
                These Terms of Use (the "Agreement") govern your access to and use of the JubileeInspire mobile application ("App") provided by the app developer ("we," "us," or "our"). By downloading, installing, or using this App, you agree to be bound by this Agreement and comply with all applicable laws and regulations. If you do not agree to these terms, do not use the App.
              </Text>

              <Text style={styles.termsSectionTitle}>1. Intellectual Property</Text>
              <Text style={styles.termsText}>
                All content, including but not limited to software, text, graphics, images, layouts, databases, and logos ("Materials"), is the property of the developer or its content suppliers and is protected by United States and international copyright, trademark, and intellectual property laws. Unauthorized use of any Materials is strictly prohibited.
              </Text>
              <Text style={styles.termsText}>
                You may not reproduce, republish, distribute, display, modify, create derivative works from, transmit, or exploit any part of this App without prior written permission, except as explicitly permitted under this Agreement.
              </Text>

              <Text style={styles.termsSectionTitle}>2. License Grant and Restrictions</Text>
              <Text style={styles.termsText}>
                We grant you a limited, non-exclusive, non-transferable, revocable license to use the App solely for your personal, non-commercial use on an Apple-branded device owned or controlled by you.
              </Text>
              <Text style={styles.termsText}>You agree not to:</Text>
              <Text style={styles.termsBullet}>• Modify, reverse engineer, decompile, or disassemble the App</Text>
              <Text style={styles.termsBullet}>• Reproduce, distribute, or publicly display content without authorization</Text>
              <Text style={styles.termsBullet}>• Access or use the App for unlawful, harmful, or disruptive purposes</Text>
              <Text style={styles.termsBullet}>• Interfere with the App's operation or attempt to breach its security</Text>
              <Text style={styles.termsBullet}>• Use automated tools (bots, spiders, etc.) to interact with the App</Text>
              <Text style={styles.termsText}>
                This license is automatically terminated if you violate any part of this Agreement.
              </Text>

              <Text style={styles.termsSectionTitle}>3. User Content and Feedback</Text>
              <Text style={styles.termsText}>
                Any content or feedback you submit to us through the App or related services (e.g., suggestions, improvements, testimonials) shall be considered non-confidential. You grant us an unrestricted, irrevocable, worldwide license to use such content for business, marketing, or development purposes without compensation or acknowledgment.
              </Text>

              <Text style={styles.termsSectionTitle}>4. Privacy and Data Collection</Text>
              <Text style={styles.termsText}>
                Use of the App is governed by our Privacy Policy, which outlines how we collect, store, and use your data. By using the App, you consent to these data practices, including any updates.
              </Text>

              <Text style={styles.termsSectionTitle}>5. Auto-Renewable Subscriptions</Text>
              <Text style={styles.termsText}>JubileeInspire offers auto-renewable subscription plans:</Text>
              <Text style={styles.termsBullet}>• Standard Edition: $19.99/month</Text>
              <Text style={styles.termsBullet}>• Professional Edition: $49.99/month</Text>
              <Text style={styles.termsText}>
                Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. Manage subscriptions via your Apple ID account settings. We do not process or store payment data; Apple handles all billing securely through In-App Purchase.
              </Text>

              <Text style={styles.termsSectionTitle}>6. Links to External Sites</Text>
              <Text style={styles.termsText}>
                The App may contain links to third-party websites or services. We are not responsible for the content, security, or practices of those third parties. Access them at your own risk.
              </Text>

              <Text style={styles.termsSectionTitle}>7. Security and Account Responsibility</Text>
              <Text style={styles.termsText}>
                You are responsible for maintaining the confidentiality of your account credentials and all activity that occurs under your account. Notify us immediately if you suspect unauthorized access. You may not disrupt or attempt to disrupt the functioning of the App or access data you are not authorized to access.
              </Text>

              <Text style={styles.termsSectionTitle}>8. Usage Restrictions and Prohibited Conduct</Text>
              <Text style={styles.termsText}>You agree not to:</Text>
              <Text style={styles.termsBullet}>• Post or transmit unlawful, offensive, or harmful content</Text>
              <Text style={styles.termsBullet}>• Infringe on the intellectual property or rights of others</Text>
              <Text style={styles.termsBullet}>• Introduce viruses or malicious code</Text>
              <Text style={styles.termsBullet}>• Violate local, national, or international laws</Text>
              <Text style={styles.termsText}>
                Violations may result in suspension or termination of your account and possible legal action.
              </Text>

              <Text style={styles.termsSectionTitle}>9. U.S. Government Restricted Rights</Text>
              <Text style={styles.termsText}>
                If accessed by or on behalf of the United States Government, the App and Materials are provided with "RESTRICTED RIGHTS." Use, duplication, or disclosure is subject to applicable laws, including FAR 52.227-19 and DFARS 252.227-7013.
              </Text>

              <Text style={styles.termsSectionTitle}>10. Indemnification</Text>
              <Text style={styles.termsText}>
                You agree to defend, indemnify, and hold harmless the developer, its affiliates, officers, and employees from any claims, liabilities, or expenses (including legal fees) resulting from your use of the App or your breach of this Agreement.
              </Text>

              <Text style={styles.termsSectionTitle}>11. Disclaimer of Warranties</Text>
              <Text style={styles.termsText}>
                The App and all Materials are provided "as is" without warranties of any kind, either express or implied. We make no guarantees regarding availability, functionality, or content accuracy. We disclaim all warranties including those of merchantability, fitness for a particular purpose, and non-infringement.
              </Text>
              <Text style={styles.termsText}>
                Some jurisdictions do not allow disclaimers of implied warranties. In such cases, the above limitations may not apply to you.
              </Text>

              <Text style={styles.termsSectionTitle}>12. Limitation of Liability</Text>
              <Text style={styles.termsText}>
                To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, or consequential damages, including lost profits or data, arising from your use or inability to use the App. Our total liability shall not exceed $25.00.
              </Text>

              <Text style={styles.termsSectionTitle}>13. Termination</Text>
              <Text style={styles.termsText}>
                We may terminate your access to the App at any time, with or without cause. Upon termination, you must cease all use and uninstall the App from your device.
              </Text>

              <Text style={styles.termsSectionTitle}>14. Modifications</Text>
              <Text style={styles.termsText}>
                We may revise this Agreement at any time. Updates will be posted in the App or on our official website. Continued use after changes constitutes your acceptance of the revised terms.
              </Text>

              <Text style={styles.termsSectionTitle}>15. Governing Law and Jurisdiction</Text>
              <Text style={styles.termsText}>
                This Agreement is governed by the laws of the State of California, without regard to its conflict of law provisions. All disputes shall be resolved exclusively in the state or federal courts located in Sacramento, California.
              </Text>

              <Text style={styles.termsSectionTitle}>16. Contact Us</Text>
              <Text style={styles.termsText}>
                If you have questions or concerns regarding these Terms of Use, please contact:
              </Text>
              <Text style={styles.termsContact}>JubileeInspire Support Team</Text>
              <Text style={styles.termsContact}>Email: support@jubileeinspire.com</Text>
              <Text style={styles.termsContact}>Website: jubileeinspire.com</Text>

              <View style={styles.termsFooterSpacer} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={showPrivacyPolicy}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPrivacyPolicy(false)}
      >
        <View style={styles.termsModalOverlay}>
          <View style={styles.termsModalContainer}>
            <View style={styles.termsModalHeader}>
              <Text style={styles.termsModalTitle}>Privacy Policy</Text>
              <TouchableOpacity
                style={styles.termsCloseButton}
                onPress={() => setShowPrivacyPolicy(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.termsContent}
              showsVerticalScrollIndicator={true}
              {...(Platform.OS === 'web' ? { className: 'themed-scrollbar' } as any : {})}
            >
              <Text style={styles.termsIntro}>
                JubileeInspire ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application ("App"). Please read this policy carefully. By using the App, you consent to the practices described herein.
              </Text>

              <Text style={styles.termsSectionTitle}>1. Information We Collect</Text>
              <Text style={styles.termsText}>We may collect and process the following types of information:</Text>

              <Text style={styles.termsSubtitle}>1.1 Information You Provide</Text>
              <Text style={styles.termsBullet}>• Account information (name, email address, profile picture)</Text>
              <Text style={styles.termsBullet}>• User-generated content (chat messages, notes, bookmarks)</Text>
              <Text style={styles.termsBullet}>• Feedback and correspondence (support requests, surveys)</Text>
              <Text style={styles.termsBullet}>• Payment information (processed securely by Apple; we do not store payment details)</Text>

              <Text style={styles.termsSubtitle}>1.2 Automatically Collected Information</Text>
              <Text style={styles.termsBullet}>• Device information (device type, operating system, unique device identifiers)</Text>
              <Text style={styles.termsBullet}>• Usage data (features accessed, time spent, interaction patterns)</Text>
              <Text style={styles.termsBullet}>• Log data (IP address, browser type, access times, error logs)</Text>
              <Text style={styles.termsBullet}>• Analytics data (app performance, crash reports)</Text>

              <Text style={styles.termsSectionTitle}>2. How We Use Your Information</Text>
              <Text style={styles.termsText}>We use the collected information for the following purposes:</Text>
              <Text style={styles.termsBullet}>• To provide, maintain, and improve the App</Text>
              <Text style={styles.termsBullet}>• To personalize your experience and deliver relevant content</Text>
              <Text style={styles.termsBullet}>• To process transactions and manage subscriptions</Text>
              <Text style={styles.termsBullet}>• To communicate with you about updates, features, and support</Text>
              <Text style={styles.termsBullet}>• To analyze usage patterns and optimize performance</Text>
              <Text style={styles.termsBullet}>• To detect, prevent, and address technical issues or fraud</Text>
              <Text style={styles.termsBullet}>• To comply with legal obligations</Text>

              <Text style={styles.termsSectionTitle}>3. Data Sharing and Disclosure</Text>
              <Text style={styles.termsText}>We do not sell your personal information. We may share your information in the following circumstances:</Text>

              <Text style={styles.termsSubtitle}>3.1 Service Providers</Text>
              <Text style={styles.termsText}>
                We may share information with third-party vendors who assist us in operating the App (e.g., cloud hosting, analytics, customer support). These providers are contractually bound to protect your data.
              </Text>

              <Text style={styles.termsSubtitle}>3.2 Legal Requirements</Text>
              <Text style={styles.termsText}>
                We may disclose information if required by law, regulation, legal process, or governmental request, or to protect our rights, privacy, safety, or property.
              </Text>

              <Text style={styles.termsSubtitle}>3.3 Business Transfers</Text>
              <Text style={styles.termsText}>
                In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction.
              </Text>

              <Text style={styles.termsSectionTitle}>4. Data Storage and Security</Text>
              <Text style={styles.termsText}>
                We implement industry-standard security measures to protect your information, including encryption, secure servers, and access controls. However, no method of transmission over the Internet or electronic storage is 100% secure.
              </Text>
              <Text style={styles.termsText}>
                Your data is stored on secure servers located in the United States. By using the App, you consent to the transfer of your information to the United States.
              </Text>

              <Text style={styles.termsSectionTitle}>5. Data Retention</Text>
              <Text style={styles.termsText}>
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. You may request deletion of your data at any time (see Section 7).
              </Text>

              <Text style={styles.termsSectionTitle}>6. Children's Privacy</Text>
              <Text style={styles.termsText}>
                The App is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will take steps to delete it promptly.
              </Text>

              <Text style={styles.termsSectionTitle}>7. Your Rights and Choices</Text>
              <Text style={styles.termsText}>Depending on your jurisdiction, you may have the following rights:</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Access:</Text> Request a copy of your personal data</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Correction:</Text> Request correction of inaccurate data</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Deletion:</Text> Request deletion of your personal data</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Portability:</Text> Request transfer of your data in a portable format</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Opt-out:</Text> Opt out of marketing communications</Text>
              <Text style={styles.termsText}>
                To exercise these rights, please contact us at support@jubileeinspire.com.
              </Text>

              <Text style={styles.termsSectionTitle}>8. Cookies and Tracking Technologies</Text>
              <Text style={styles.termsText}>
                We may use cookies, pixels, and similar tracking technologies to collect usage data and improve your experience. You can manage cookie preferences through your device settings.
              </Text>

              <Text style={styles.termsSectionTitle}>9. Third-Party Links</Text>
              <Text style={styles.termsText}>
                The App may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
              </Text>

              <Text style={styles.termsSectionTitle}>10. Changes to This Privacy Policy</Text>
              <Text style={styles.termsText}>
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the App or sending you a notification. Your continued use of the App after such changes constitutes your acceptance of the updated policy.
              </Text>

              <Text style={styles.termsSectionTitle}>11. California Privacy Rights (CCPA)</Text>
              <Text style={styles.termsText}>
                If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, request deletion, and opt out of the sale of personal information (we do not sell personal information).
              </Text>

              <Text style={styles.termsSectionTitle}>12. International Users (GDPR)</Text>
              <Text style={styles.termsText}>
                If you are located in the European Economic Area (EEA), you have rights under the General Data Protection Regulation (GDPR), including access, rectification, erasure, restriction, portability, and objection. Our legal basis for processing includes consent, contractual necessity, and legitimate interests.
              </Text>

              <Text style={styles.termsSectionTitle}>13. Contact Us</Text>
              <Text style={styles.termsText}>
                If you have questions, concerns, or requests regarding this Privacy Policy, please contact us:
              </Text>
              <Text style={styles.termsContact}>JubileeInspire Privacy Team</Text>
              <Text style={styles.termsContact}>Email: privacy@jubileeinspire.com</Text>
              <Text style={styles.termsContact}>Website: jubileeinspire.com/privacy</Text>

              <View style={styles.termsFooterSpacer} />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    backgroundColor: colors.chatInputBg,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.chatInputBorder,
    paddingLeft: 15,
    paddingRight: 15,
    paddingVertical: spacing.sm,
    minHeight: 48,
    width: '100%',
    maxWidth: centered ? 800 : undefined,
  },
  inputWrapperFocused: {
    borderWidth: 2,
    borderColor: '#ffbd59',
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: colors.chatInputButtonBg,
    borderWidth: 1,
    borderColor: colors.chatInputButtonBorder,
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
    backgroundColor: colors.chatInputButtonBg,
    borderWidth: 1,
    borderColor: colors.chatInputButtonBorder,
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
  copyrightLink: {
    fontSize: 11,
    color: '#777777',
    textDecorationLine: 'underline',
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
  toolItemHovered: {
    backgroundColor: colors.menuItemHover,
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
  // Terms of Use and Privacy Policy Modal Styles
  termsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  termsModalContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
      },
    }),
  },
  termsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  termsModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  termsCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  termsIntro: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  termsSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  termsSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  termsBold: {
    fontWeight: '600',
    color: colors.text,
  },
  termsText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  termsBullet: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    marginLeft: spacing.md,
    marginBottom: 4,
  },
  termsContact: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    lineHeight: 22,
  },
  termsFooterSpacer: {
    height: spacing.xl,
  },
});

export default ChatInput;
