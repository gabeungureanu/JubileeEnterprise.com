import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Avatar } from '../../common/Avatar';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';
import type { EmailMessage } from '../../../types';

interface MessageListItemProps {
  message: EmailMessage;
  isSelected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFlag?: () => void;
}

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function MessageListItem({
  message,
  isSelected,
  onPress,
  onLongPress,
  onToggleFlag,
}: MessageListItemProps) {
  const isUnread = !message.isRead;
  const senderDisplay = message.from.name || message.from.address || 'Unknown';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.selected,
        isUnread && styles.unread,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Unread indicator */}
      {isUnread && <View style={styles.unreadDot} />}

      <Avatar name={senderDisplay} size={40} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[styles.sender, isUnread && styles.textBold]}
            numberOfLines={1}
          >
            {senderDisplay}
          </Text>
          <Text style={styles.date}>{formatRelativeDate(message.receivedAt)}</Text>
        </View>

        <Text
          style={[styles.subject, isUnread && styles.textBold]}
          numberOfLines={1}
        >
          {message.subject || '(No Subject)'}
        </Text>

        <View style={styles.bottomRow}>
          <Text style={styles.preview} numberOfLines={1}>
            {message.bodyPreview || ''}
          </Text>

          <View style={styles.indicators}>
            {message.hasAttachments && (
              <Icon name="attach-file" size={14} color={Colors.textTertiary} />
            )}
            {message.importance === 'high' && (
              <Icon name="priority-high" size={14} color={Colors.error} />
            )}
          </View>
        </View>
      </View>

      {/* Flag */}
      <TouchableOpacity
        onPress={onToggleFlag}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.flagButton}
      >
        <Icon
          name={message.isFlagged ? 'flag' : 'outlined-flag'}
          size={18}
          color={message.isFlagged ? Colors.flagged : Colors.textTertiary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  selected: {
    backgroundColor: Colors.surfaceLight,
  },
  unread: {
    backgroundColor: Colors.surface,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    position: 'absolute',
    left: 4,
    top: '50%',
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sender: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  date: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  subject: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    flex: 1,
  },
  indicators: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: Spacing.sm,
  },
  textBold: {
    fontWeight: '600',
  },
  flagButton: {
    marginLeft: Spacing.sm,
    padding: 4,
  },
});
