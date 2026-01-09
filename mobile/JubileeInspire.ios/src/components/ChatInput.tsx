/**
 * Jubilee Inspire - Chat Input Component
 *
 * Message input with send button, plus menu, and microphone - styled like ChatGPT.
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '../config';

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

  const handleSend = async () => {
    if (!text.trim() || disabled) return;

    // Haptic feedback
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onSend(text.trim());
    setText('');
  };

  const handleToolsMenu = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowToolsMenu(true);
  };

  const handleToolSelect = async (tool: string) => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowToolsMenu(false);
    // TODO: Implement tool actions
    console.log('Tool selected:', tool);
  };

  const handleVoiceInput = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // TODO: Implement voice input
    console.log('Voice input requested');
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
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
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={4000}
          editable={!disabled}
          returnKeyType="default"
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
          <TouchableOpacity
            style={styles.micButton}
            onPress={handleVoiceInput}
            disabled={disabled}
          >
            <Ionicons name="mic-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  plusButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text,
    maxHeight: 120,
    minHeight: 40,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  micButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4f4f4f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
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
