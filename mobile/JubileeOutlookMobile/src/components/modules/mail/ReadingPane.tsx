import React, { useMemo, useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Avatar } from '../../common/Avatar';
import { EmailBodyViewer } from '../../common/EmailBodyViewer';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import {
  processEmailHtmlAsync,
  getRegularAttachments,
} from '../../../utils/emailHtmlProcessor';
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
  const senderDisplay = message.from.name || message.from.address || 'Unknown';
  const toRecipients = message.to || [];
  const ccRecipients = message.cc || [];

  // Process HTML async: replace CID inline image refs with base64 data URIs
  const [processedHtml, setProcessedHtml] = useState('');

  useEffect(() => {
    let cancelled = false;
    const raw = message.bodyHtml
      || `<pre style="color: #fff; font-family: sans-serif;">${message.bodyText || message.bodyPreview || ''}</pre>`;
    processEmailHtmlAsync(raw, message.id, message.attachments || [])
      .then((result) => {
        if (!cancelled) setProcessedHtml(result);
      })
      .catch(() => {
        // Fallback: use raw HTML without CID processing
        if (!cancelled) setProcessedHtml(raw);
      });
    return () => { cancelled = true; };
  }, [message.id, message.bodyHtml]);

  // Separate inline attachments from regular attachments
  const displayAttachments = useMemo(
    () => getRegularAttachments(message.attachments || []),
    [message.attachments],
  );

  return (
    <View style={styles.container}>
      {/* ── Fixed header area ── */}
      <ScrollView
        style={styles.headerScroll}
        contentContainerStyle={styles.headerContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled
      >
        <View style={styles.senderRow}>
          <Avatar name={senderDisplay} size={40} />
          <View style={styles.senderInfo}>
            <Text style={styles.senderName}>{senderDisplay}</Text>
            <Text style={styles.senderEmail} numberOfLines={1}>{message.from.address}</Text>
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
          <Text style={styles.recipients} numberOfLines={1}>
            To: {toRecipients.map((r) => r.name || r.address).join(', ')}
          </Text>
        )}
        {ccRecipients.length > 0 && (
          <Text style={styles.recipients} numberOfLines={1}>
            Cc: {ccRecipients.map((r) => r.name || r.address).join(', ')}
          </Text>
        )}

        {/* Attachments (only non-inline) */}
        {displayAttachments.length > 0 && (
          <View style={styles.attachments}>
            {displayAttachments.map((att) => (
              <View key={att.id} style={styles.attachmentItem}>
                <Icon name="attach-file" size={16} color={Colors.textTertiary} />
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {att.fileName}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Divider */}
      <View style={styles.divider} />

      {/* ── Email body — WebView fills remaining space ── */}
      <View style={styles.body}>
        {processedHtml ? (
          <EmailBodyViewer html={processedHtml} />
        ) : null}
      </View>

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
  headerScroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: '40%',
  },
  headerContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xs,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.lg,
  },
  body: {
    flex: 1,
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
