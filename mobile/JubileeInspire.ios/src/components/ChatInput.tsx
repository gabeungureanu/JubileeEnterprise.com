/**
 * Jubilee Inspire - Chat Input Component
 *
 * Message input with send button, styled like ChatGPT.
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
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

  const handleSend = async () => {
    if (!text.trim() || disabled) return;

    // Haptic feedback
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onSend(text.trim());
    setText('');
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
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

        <TouchableOpacity
          style={[styles.sendButton, canSend && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={canSend ? '#000000' : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

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
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text,
    maxHeight: 120,
    minHeight: 40,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    paddingRight: spacing.sm,
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
});

export default ChatInput;
