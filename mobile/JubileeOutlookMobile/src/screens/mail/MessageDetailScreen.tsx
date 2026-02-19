/**
 * MessageDetailScreen — Full message reading pane.
 *
 * Fetches the complete message by ID, renders sender info with avatar,
 * subject, date, recipients, and HTML body via react-native-render-html.
 * Action bar at the bottom provides Reply, Reply All, Forward, and Delete.
 * Marks the message as read on open.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner } from '../../components/common';
import { Avatar } from '../../components/common/Avatar';
import { useAlert } from '../../hooks';
import { mailService } from '../../services/mail/mailService';
import { tokenStore } from '../../services/apiClient';
import { API } from '../../constants/api';
import type { EmailMessage, AttachmentDto } from '../../types';
import type { MailStackParamList } from '../../types/navigation';

type DetailNav = NativeStackNavigationProp<MailStackParamList, 'MessageDetail'>;
type DetailRoute = RouteProp<MailStackParamList, 'MessageDetail'>;

// ---------- Helper ----------

function formatFullDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ---------- Component ----------

export default function MessageDetailScreen() {
  const navigation = useNavigation<DetailNav>();
  const route = useRoute<DetailRoute>();
  const { width: contentWidth } = useWindowDimensions();

  const { alert, confirm, AlertComponent } = useAlert();
  const { messageId } = route.params;

  const [message, setMessage] = useState<EmailMessage | null>(route.params.message || null);
  const [isLoading, setIsLoading] = useState(!route.params.message);
  const [isFlagged, setIsFlagged] = useState(route.params.message?.isFlagged ?? false);
  const [isPinned, setIsPinned] = useState(route.params.message?.isPinned ?? false);

  // ---------- Fetch Full Message ----------

  useEffect(() => {
    let cancelled = false;

    const fetchMessage = async () => {
      try {
        const full = await mailService.getMessage(messageId);
        if (!cancelled && full) {
          setMessage(full);
          setIsFlagged(full.isFlagged);
          setIsPinned(full.isPinned);
        }
      } catch (err) {
        console.warn('[MessageDetail] fetch failed:', err);
        if (!cancelled) {
          alert('Error', 'Could not load message.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchMessage();
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  // ---------- Mark as Read ----------

  useEffect(() => {
    mailService.markAsRead(messageId, true).catch(() => {});
  }, [messageId]);

  // ---------- Actions ----------

  const handleReply = useCallback(() => {
    if (!message) return;
    navigation.navigate('Compose', { mode: 'reply', originalMessage: message });
  }, [navigation, message]);

  const handleReplyAll = useCallback(() => {
    if (!message) return;
    navigation.navigate('Compose', { mode: 'replyAll', originalMessage: message });
  }, [navigation, message]);

  const handleForward = useCallback(() => {
    if (!message) return;
    navigation.navigate('Compose', { mode: 'forward', originalMessage: message });
  }, [navigation, message]);

  const handleDelete = useCallback(async () => {
    if (!message) return;
    confirm(
      'Delete Message',
      'Are you sure you want to delete this message?',
      async () => {
        try {
          await mailService.deleteMessage(message.id);
          navigation.goBack();
        } catch (err) {
          alert('Error', 'Could not delete message.', 'error');
        }
      },
      { confirmText: 'Delete', destructive: true },
    );
  }, [message, navigation, confirm, alert]);

  const handleToggleFlag = useCallback(async () => {
    if (!message) return;
    try {
      const newFlagged = !isFlagged;
      await mailService.toggleFlag(message.id, newFlagged);
      setIsFlagged(newFlagged);
    } catch (err) {
      console.warn('[MessageDetail] toggleFlag failed:', err);
    }
  }, [message, isFlagged]);

  const handleTogglePin = useCallback(async () => {
    if (!message) return;
    try {
      const newPinned = !isPinned;
      await mailService.togglePin(message.id, newPinned);
      setIsPinned(newPinned);
    } catch (err) {
      console.warn('[MessageDetail] togglePin failed:', err);
    }
  }, [message, isPinned]);

  // ---------- Attachment Download ----------

  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

  const handleDownloadAttachment = useCallback(async (att: AttachmentDto) => {
    if (!message) return;
    setDownloadingAttachmentId(att.id);
    try {
      const baseUrl = `${API.CONTINUUM_BASE_URL}/v1`;
      const downloadUrl =
        `${baseUrl}/outlook/messages/${encodeURIComponent(message.id)}/attachments/${encodeURIComponent(att.id)}/download`;

      const token = tokenStore.getAccessToken();
      const userId = tokenStore.getUserId();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (userId) headers['X-User-Id'] = userId;

      const destination = new ExpoFile(Paths.cache, att.fileName);
      const downloaded = await ExpoFile.downloadFileAsync(downloadUrl, destination, {
        headers,
        idempotent: true,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloaded.uri, {
          mimeType: att.mimeType || 'application/octet-stream',
          dialogTitle: att.fileName,
        });
      } else {
        alert('Downloaded', `File saved to: ${downloaded.uri}`, 'success');
      }
    } catch (err) {
      console.warn('[MessageDetail] download failed:', err);
      alert('Download Failed', 'Could not download attachment.', 'error');
    } finally {
      setDownloadingAttachmentId(null);
    }
  }, [message]);

  // ---------- Set Header ----------

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={handleTogglePin}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name="push-pin"
              size={22}
              color={isPinned ? Colors.accent : Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleToggleFlag}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name={isFlagged ? 'flag' : 'outlined-flag'}
              size={24}
              color={isFlagged ? Colors.flagged : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, handleToggleFlag, handleTogglePin, isFlagged, isPinned]);

  // ---------- Loading ----------

  if (isLoading || !message) {
    return (
      <View style={styles.screen}>
        <LoadingSpinner fullScreen message="Loading message..." />
      </View>
    );
  }

  // ---------- Derived ----------

  const senderDisplay = message.from.name || message.from.address || 'Unknown';
  const toRecipients = message.to || [];
  const ccRecipients = message.cc || [];

  const htmlSource = {
    html: message.bodyHtml || `<p>${message.bodyText || message.bodyPreview || ''}</p>`,
  };

  const htmlTagStyles = {
    body: { color: Colors.textPrimary, fontSize: 14, lineHeight: 22 },
    a: { color: Colors.accent },
    p: { marginBottom: 8 },
  };

  // ---------- Render ----------

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subject */}
        <Text style={styles.subject}>{message.subject || '(No Subject)'}</Text>

        {/* Sender Row */}
        <View style={styles.senderRow}>
          <Avatar name={senderDisplay} size={44} />
          <View style={styles.senderInfo}>
            <Text style={styles.senderName}>{senderDisplay}</Text>
            <Text style={styles.senderEmail}>{message.from.address}</Text>
          </View>
          <Text style={styles.date}>{formatFullDate(message.receivedAt || message.sentAt)}</Text>
        </View>

        {/* Recipients */}
        <View style={styles.recipientSection}>
          {toRecipients.length > 0 && (
            <View style={styles.recipientRow}>
              <Text style={styles.recipientLabel}>To:</Text>
              <Text style={styles.recipientText} numberOfLines={2}>
                {toRecipients.map((r) => r.name || r.address).join(', ')}
              </Text>
            </View>
          )}
          {ccRecipients.length > 0 && (
            <View style={styles.recipientRow}>
              <Text style={styles.recipientLabel}>Cc:</Text>
              <Text style={styles.recipientText} numberOfLines={2}>
                {ccRecipients.map((r) => r.name || r.address).join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* Importance */}
        {message.importance === 'high' && (
          <View style={styles.importanceBanner}>
            <Icon name="priority-high" size={16} color={Colors.error} />
            <Text style={styles.importanceText}>High Importance</Text>
          </View>
        )}

        {/* Attachments */}
        {message.hasAttachments && message.attachments && message.attachments.length > 0 && (
          <View style={styles.attachmentSection}>
            <Text style={styles.attachmentHeader}>
              <Icon name="attach-file" size={14} color={Colors.textSecondary} />
              {'  '}Attachments ({message.attachments.length})
            </Text>
            {message.attachments.map((att: AttachmentDto) => (
              <TouchableOpacity
                key={att.id}
                style={styles.attachmentItem}
                onPress={() => handleDownloadAttachment(att)}
                activeOpacity={0.7}
                disabled={downloadingAttachmentId === att.id}
              >
                {downloadingAttachmentId === att.id ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Icon name="insert-drive-file" size={20} color={Colors.accent} />
                )}
                <View style={styles.attachmentInfo}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {att.fileName}
                  </Text>
                  <Text style={styles.attachmentSize}>{formatFileSize(att.fileSize)}</Text>
                </View>
                <Icon name="file-download" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Body */}
        <View style={styles.bodyContainer}>
          <RenderHtml
            contentWidth={contentWidth - Spacing.lg * 2}
            source={htmlSource}
            tagsStyles={htmlTagStyles}
            defaultTextProps={{ selectable: true }}
            baseStyle={styles.htmlBase}
          />
        </View>
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={handleReply}>
          <Icon name="reply" size={22} color={Colors.accent} />
          <Text style={styles.actionLabel}>Reply</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleReplyAll}>
          <Icon name="reply-all" size={22} color={Colors.accent} />
          <Text style={styles.actionLabel}>Reply All</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleForward}>
          <Icon name="forward" size={22} color={Colors.accent} />
          <Text style={styles.actionLabel}>Forward</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
          <Icon name="delete" size={22} color={Colors.error} />
          <Text style={[styles.actionLabel, { color: Colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {AlertComponent}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  // Subject
  subject: {
    ...Typography.h2,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  // Sender
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  senderInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  senderName: {
    ...Typography.label,
    color: Colors.textPrimary,
  },
  senderEmail: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  date: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
  },
  // Recipients
  recipientSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  recipientLabel: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    width: 28,
    fontWeight: '600',
  },
  recipientText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  // Importance
  importanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  importanceText: {
    ...Typography.bodySmall,
    color: Colors.error,
    fontWeight: '600',
  },
  // Attachments
  attachmentSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  attachmentHeader: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  attachmentSize: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
  },
  // Body
  bodyContainer: {
    paddingHorizontal: Spacing.lg,
  },
  htmlBase: {
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 22,
  },
  // Action Bar
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  actionLabel: {
    ...Typography.caption,
    color: Colors.accent,
    marginTop: 2,
  },
});
