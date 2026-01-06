/**
 * Jubilee Inspire - Conversation Item Component
 *
 * Displays a conversation in the sidebar list.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../types';
import { colors, spacing, typography } from '../config';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onPress: () => void;
  onDelete: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onPress,
  onDelete,
}) => {
  const handleDelete = () => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.activeContainer]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name="chatbubble-outline"
          size={18}
          color={isActive ? colors.primary : colors.textSecondary}
        />
      </View>

      <View style={styles.contentContainer}>
        <Text
          style={[styles.title, isActive && styles.activeTitle]}
          numberOfLines={1}
        >
          {conversation.title}
        </Text>
        {conversation.preview && (
          <Text style={styles.preview} numberOfLines={1}>
            {conversation.preview}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 8,
    marginHorizontal: spacing.sm,
    marginVertical: 2,
  },
  activeContainer: {
    backgroundColor: 'rgba(26, 54, 93, 0.1)',
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  activeTitle: {
    color: colors.primary,
    fontWeight: '600',
  },
  preview: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: spacing.xs,
    opacity: 0.6,
  },
});

export default ConversationItem;
