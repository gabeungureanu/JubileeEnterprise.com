import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Avatar } from '../../common/Avatar';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import type { EmailMessage } from '../../../types';

interface ReadingPaneProps {
  message: EmailMessage;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  onToggleFlag?: () => void;
}

function formatFullDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ReadingPane({
  message,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onToggleFlag,
}: ReadingPaneProps) {
  const { width } = useWindowDimensions();
  const senderDisplay = message.senderName || message.senderEmail || 'Unknown';
  const toRecipients = message.recipients?.filter((r) => r.type === 'to') || [];
  const ccRecipients = message.recipients?.filter((r) => r.type === 'cc') || [];

  const htmlSource = message.bodyHtml
    ? { html: message.bodyHtml }
    : { html: `<pre style="color: #fff; font-family: sans-serif;">${message.bodyText || message.bodyPreview || ''}</pre>` };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.senderRow}>
            <Avatar name={senderDisplay} size={44} />
            <View style={styles.senderInfo}>
              <Text style={styles.senderName}>{senderDisplay}</Text>
              <Text style={styles.senderEmail}>{message.senderEmail}</Text>
            </View>
            <TouchableOpacity onPress={onToggleFlag} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon
                name={message.isFlagged ? 'flag' : 'outlined-flag'}
                size={22}
                color={message.isFlagged ? Colors.flagged : Colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.subject}>{message.subject || '(No Subject)'}</Text>
          <Text style={styles.date}>{formatFullDate(message.receivedAt)}</Text>

          {toRecipients.length > 0 && (
            <Text style={styles.recipients}>
              To: {toRecipients.map((r) => r.name || r.email).join(', ')}
            </Text>
          )}
          {ccRecipients.length > 0 && (
            <Text style={styles.recipients}>
              Cc: {ccRecipients.map((r) => r.name || r.email).join(', ')}
            </Text>
          )}
        </View>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <View style={styles.attachments}>
            {message.attachments.map((att) => (
              <View key={att.id} style={styles.attachmentItem}>
                <Icon name="attach-file" size={16} color={Colors.textTertiary} />
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {att.fileName}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Body */}
        <View style={styles.body}>
          <RenderHtml
            contentWidth={width - 32}
            source={htmlSource}
            baseStyle={{ color: Colors.textPrimary, fontSize: 14, lineHeight: 22 }}
            tagsStyles={{
              a: { color: Colors.accent },
              img: { maxWidth: width - 32 },
            }}
          />
        </View>
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={onReply}>
          <Icon name="reply" size={22} color={Colors.textPrimary} />
          <Text style={styles.actionLabel}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onReplyAll}>
          <Icon name="reply-all" size={22} color={Colors.textPrimary} />
          <Text style={styles.actionLabel}>Reply All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onForward}>
          <Icon name="forward" size={22} color={Colors.textPrimary} />
          <Text style={styles.actionLabel}>Forward</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
          <Icon name="delete" size={22} color={Colors.error} />
          <Text style={[styles.actionLabel, { color: Colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    ...Typography.label,
    color: Colors.textPrimary,
  },
  senderEmail: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  subject: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  date: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  recipients: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  attachments: {
    padding: Spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 4,
  },
  attachmentName: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    maxWidth: 150,
  },
  body: {
    padding: Spacing.lg,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  actionButton: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
  },
  actionLabel: {
    ...Typography.caption,
    color: Colors.textPrimary,
  },
});
