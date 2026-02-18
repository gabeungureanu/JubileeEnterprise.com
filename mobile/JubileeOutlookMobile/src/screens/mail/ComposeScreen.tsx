/**
 * ComposeScreen — New/Reply/ReplyAll/Forward email compose modal.
 *
 * Receives mode and optional originalMessage from route params.
 * Pre-fills fields based on compose mode. Validates that at least
 * one recipient and a subject are present before sending.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner } from '../../components/common';
import { useAlert } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { mailService } from '../../services/mail/mailService';
import type { MailStackParamList } from '../../types/navigation';

type ComposeRecipient = { email: string; name: string; type: 'to' | 'cc' | 'bcc' };

interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uri: string;
}

type ComposeNav = NativeStackNavigationProp<MailStackParamList, 'Compose'>;
type ComposeRoute = RouteProp<MailStackParamList, 'Compose'>;

// ---------- Helpers ----------

function buildReplySubject(subject: string): string {
  if (/^re:/i.test(subject.trim())) return subject;
  return `Re: ${subject}`;
}

function buildForwardSubject(subject: string): string {
  if (/^fwd:/i.test(subject.trim())) return subject;
  return `Fwd: ${subject}`;
}

function buildReplyBody(senderName: string, date: string, bodyHtml: string): string {
  const formattedDate = date ? new Date(date).toLocaleString() : '';
  return `<br/><br/><hr/><p>On ${formattedDate}, ${senderName} wrote:</p><blockquote>${bodyHtml}</blockquote>`;
}

// ---------- Component ----------

export default function ComposeScreen() {
  const navigation = useNavigation<ComposeNav>();
  const route = useRoute<ComposeRoute>();
  const { user } = useAuth();

  const { alert, AlertComponent } = useAlert();
  const { mode = 'new', originalMessage, draftId } = route.params;

  // ---------- Form State ----------

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // ---------- Pre-fill based on mode ----------

  useEffect(() => {
    if (!originalMessage) return;

    switch (mode) {
      case 'reply': {
        const replyTo = originalMessage.from.address || '';
        setTo(replyTo);
        setSubject(buildReplySubject(originalMessage.subject || ''));
        setBody(
          buildReplyBody(
            originalMessage.from.name || originalMessage.from.address || '',
            originalMessage.receivedAt || originalMessage.sentAt || '',
            originalMessage.bodyHtml || originalMessage.bodyText || '',
          ),
        );
        break;
      }
      case 'replyAll': {
        const replyTo = originalMessage.from.address || '';
        const toRecipients = (originalMessage.to || [])
          .filter((r) => r.address !== user?.email)
          .map((r) => r.address);
        const ccRecipients = (originalMessage.cc || [])
          .map((r) => r.address);

        setTo([replyTo, ...toRecipients].join(', '));
        if (ccRecipients.length > 0) {
          setCc(ccRecipients.join(', '));
          setShowCc(true);
        }
        setSubject(buildReplySubject(originalMessage.subject || ''));
        setBody(
          buildReplyBody(
            originalMessage.from.name || originalMessage.from.address || '',
            originalMessage.receivedAt || originalMessage.sentAt || '',
            originalMessage.bodyHtml || originalMessage.bodyText || '',
          ),
        );
        break;
      }
      case 'forward': {
        setSubject(buildForwardSubject(originalMessage.subject || ''));
        setBody(
          buildReplyBody(
            originalMessage.from.name || originalMessage.from.address || '',
            originalMessage.receivedAt || originalMessage.sentAt || '',
            originalMessage.bodyHtml || originalMessage.bodyText || '',
          ),
        );
        break;
      }
      default:
        break;
    }
  }, [mode, originalMessage, user?.email]);

  // ---------- Recipient Parsing ----------

  const parseRecipients = useCallback(
    (input: string, type: 'to' | 'cc' | 'bcc'): ComposeRecipient[] => {
      return input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((email) => ({ email, name: email, type }));
    },
    [],
  );

  // ---------- Validation ----------

  const validate = useCallback((): boolean => {
    const recipients = parseRecipients(to, 'to');
    if (recipients.length === 0) {
      alert('Missing Recipient', 'Please add at least one recipient.', 'warning');
      return false;
    }
    if (!subject.trim()) {
      alert('Missing Subject', 'Please enter a subject line.', 'warning');
      return false;
    }
    return true;
  }, [to, subject, parseRecipients]);

  // ---------- Attachments ----------

  const handlePickAttachment = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets) return;

      const newAttachments: AttachmentItem[] = result.assets.map((asset) => ({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: asset.name,
        size: asset.size ?? 0,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        uri: asset.uri,
      }));

      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err) {
      alert('Error', 'Could not pick file.', 'error');
    }
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }, []);

  // ---------- Send ----------

  const handleSend = useCallback(async () => {
    if (!validate()) return;
    if (!user?.id || !user?.email) {
      alert('Error', 'You must be signed in to send messages.', 'error');
      return;
    }

    setIsSending(true);
    try {
      const recipients: ComposeRecipient[] = [
        ...parseRecipients(to, 'to'),
        ...parseRecipients(cc, 'cc'),
        ...parseRecipients(bcc, 'bcc'),
      ];

      // Convert attachments to base64 for the API
      const attachmentPayloads = await Promise.all(
        attachments.map(async (att) => {
          const file = new ExpoFile(att.uri);
          const base64 = await file.base64();
          return {
            filename: att.name,
            content: base64,
            contentType: att.mimeType,
          };
        }),
      );

      await mailService.sendMessage({
        userId: user.id,
        sender_email: user.email,
        subject: subject.trim(),
        body_html: body || `<p>${body}</p>`,
        body_text: body.replace(/<[^>]*>/g, ''),
        recipients,
        attachments: attachmentPayloads.length > 0 ? attachmentPayloads : undefined,
      });

      alert('Sent', 'Your message has been sent.', 'success', () => navigation.goBack());
    } catch (err) {
      alert('Send Failed', 'Could not send your message. Please try again.', 'error');
    } finally {
      setIsSending(false);
    }
  }, [validate, user, to, cc, bcc, subject, body, attachments, parseRecipients, navigation]);

  // ---------- Save Draft ----------

  const handleSaveDraft = useCallback(async () => {
    if (!user?.id || !user?.email) return;

    setIsSavingDraft(true);
    try {
      const recipients: ComposeRecipient[] = [
        ...parseRecipients(to, 'to'),
        ...parseRecipients(cc, 'cc'),
        ...parseRecipients(bcc, 'bcc'),
      ];

      await mailService.saveDraft({
        userId: user.id,
        sender_email: user.email,
        id: draftId,
        subject: subject.trim(),
        body_html: body || `<p>${body}</p>`,
        body_text: body.replace(/<[^>]*>/g, ''),
        recipients,
      });

      alert('Draft Saved', 'Your draft has been saved.', 'success', () => navigation.goBack());
    } catch (err) {
      alert('Error', 'Could not save draft.', 'error');
    } finally {
      setIsSavingDraft(false);
    }
  }, [user, to, cc, bcc, subject, body, draftId, parseRecipients, navigation]);

  // ---------- Header Buttons ----------

  useEffect(() => {
    const titleMap: Record<string, string> = {
      new: 'Compose',
      reply: 'Reply',
      replyAll: 'Reply All',
      forward: 'Forward',
    };

    navigation.setOptions({
      title: titleMap[mode] || 'Compose',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="close" size={24} color={Colors.primary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleSaveDraft}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerAction}
            disabled={isSavingDraft}
          >
            <Icon name="save" size={22} color={isSavingDraft ? Colors.textDisabled : Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSend}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.sendButton, isSending && { opacity: 0.5 }]}
            disabled={isSending}
          >
            <Icon name="send" size={20} color={Colors.textInverse} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, mode, handleSend, handleSaveDraft, isSending, isSavingDraft]);

  // ---------- Loading overlay ----------

  if (isSending) {
    return (
      <View style={styles.screen}>
        <LoadingSpinner fullScreen message="Sending..." />
      </View>
    );
  }

  // ---------- Render ----------

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* To */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>To</Text>
          <TextInput
            style={styles.fieldInput}
            value={to}
            onChangeText={setTo}
            placeholder="Recipients"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!showCc && (
            <TouchableOpacity
              onPress={() => setShowCc(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.ccToggle}>Cc/Bcc</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cc */}
        {showCc && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Cc</Text>
            <TextInput
              style={styles.fieldInput}
              value={cc}
              onChangeText={setCc}
              placeholder="Cc recipients"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!showBcc && (
              <TouchableOpacity
                onPress={() => setShowBcc(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.ccToggle}>Bcc</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Bcc */}
        {showBcc && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Bcc</Text>
            <TextInput
              style={styles.fieldInput}
              value={bcc}
              onChangeText={setBcc}
              placeholder="Bcc recipients"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Subject */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput
            style={styles.fieldInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        {/* Attachment picker */}
        <TouchableOpacity style={styles.attachmentRow} onPress={handlePickAttachment} activeOpacity={0.7}>
          <Icon name="attach-file" size={20} color={Colors.primary} />
          <Text style={styles.attachmentText}>Add attachment</Text>
        </TouchableOpacity>

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <View style={styles.attachmentList}>
            {attachments.map((att) => (
              <View key={att.id} style={styles.attachmentChip}>
                <Icon name="insert-drive-file" size={18} color={Colors.primary} />
                <View style={styles.attachmentChipInfo}>
                  <Text style={styles.attachmentChipName} numberOfLines={1}>{att.name}</Text>
                  <Text style={styles.attachmentChipSize}>{formatFileSize(att.size)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveAttachment(att.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="cancel" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Body */}
        <View style={styles.bodyContainer}>
          <TextInput
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="Compose your message..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {AlertComponent}
    </KeyboardAvoidingView>
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
    paddingBottom: Spacing.xxxxl,
  },
  // Header
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerAction: {
    padding: Spacing.xs,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fields
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 50,
    backgroundColor: Colors.surface,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    width: 56,
  },
  fieldInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    padding: 0,
  },
  ccToggle: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  // Attachment
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  attachmentText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  attachmentList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  attachmentChipInfo: {
    flex: 1,
  },
  attachmentChipName: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  attachmentChipSize: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  // Body
  bodyContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: Colors.background,
  },
  bodyInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    minHeight: 250,
    lineHeight: 22,
  },
});
