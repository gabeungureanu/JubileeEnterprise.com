/**
 * Jubilee Inspire - Message Bubble Component
 *
 * Displays a single chat message with appropriate styling for user/assistant.
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../types';
import { colors, spacing, typography } from '../config';

const jubileeProfile = require('../../assets/jubilee-profile.png');

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <View style={[styles.container, isUser && styles.userContainer]}>
      {/* Avatar */}
      {isUser ? (
        <View style={[styles.avatar, styles.userAvatar]}>
          <Ionicons name="person" size={18} color="#ffffff" />
        </View>
      ) : (
        <Image source={jubileeProfile} style={styles.assistantAvatar} />
      )}

      {/* Message Content */}
      <View style={styles.contentContainer}>
        <Text style={[styles.roleLabel, isUser && styles.userRoleLabel]}>
          {isUser ? 'You' : 'Jubilee Inspire'}
        </Text>
        <Text style={styles.messageText}>
          {message.content}
          {message.isStreaming && <Text style={styles.cursor}>|</Text>}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  userContainer: {
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userAvatar: {
    backgroundColor: '#5436da',  // Purple for user
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  roleLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  userRoleLabel: {
    color: colors.text,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    color: colors.text,
    lineHeight: 24,
  },
  cursor: {
    color: colors.primary,
    fontWeight: '300',
  },
});

export default MessageBubble;
