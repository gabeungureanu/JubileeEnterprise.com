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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { mailService } from '../../services/mail/mailService';
import type { EmailRecipient } from '../../types';
import type { MailStackParamList } from '../../types/navigation';

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

  // ---------- Pre-fill based on mode ----------

  useEffect(() => {
    if (!originalMessage) return;

    switch (mode) {
      case 'reply': {
        const replyTo = originalMessage.senderEmail || '';
        setTo(replyTo);
        setSubject(buildReplySubject(originalMessage.subject || ''));
        setBody(
          buildReplyBody(
            originalMessage.senderName || originalMessage.senderEmail || '',
            originalMessage.receivedAt || originalMessage.sentAt || '',
            originalMessage.bodyHtml || originalMessage.bodyText || '',
          ),
        );
        break;
      }
      case 'replyAll': {
        const replyTo = originalMessage.senderEmail || '';
        const toRecipients = originalMessage.recipients
          ?.filter((r) => r.type === 'to' && r.email !== user?.email)
          .map((r) => r.email) || [];
        const ccRecipients = originalMessage.recipients
          ?.filter((r) => r.type === 'cc')
          .map((r) => r.email) || [];

        setTo([replyTo, ...toRecipients].join(', '));
        if (ccRecipients.length > 0) {
          setCc(ccRecipients.join(', '));
          setShowCc(true);
        }
        setSubject(buildReplySubject(originalMessage.subject || ''));
        setBody(
          buildReplyBody(
            originalMessage.senderName || originalMessage.senderEmail || '',
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
            originalMessage.senderName || originalMessage.senderEmail || '',
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
    (input: string, type: 'to' | 'cc' | 'bcc'): EmailRecipient[] => {
      return input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((email) => ({ email, type }));
    },
    [],
  );

  // ---------- Validation ----------

  const validate = useCallback((): boolean => {
    const recipients = parseRecipients(to, 'to');
    if (recipients.length === 0) {
      Alert.alert('Missing Recipient', 'Please add at least one recipient.');
      return false;
    }
    if (!subject.trim()) {
      Alert.alert('Missing Subject', 'Please enter a subject line.');
      return false;
    }
    return true;
  }, [to, subject, parseRecipients]);

  // ---------- Send ----------

  const handleSend = useCallback(async () => {
    if (!validate()) return;
    if (!user?.id || !user?.email) {
      Alert.alert('Error', 'You must be signed in to send messages.');
      return;
    }

    setIsSending(true);
    try {
      const recipients: EmailRecipient[] = [
        ...parseRecipients(to, 'to'),
        ...parseRecipients(cc, 'cc'),
        ...parseRecipients(bcc, 'bcc'),
      ];

      await mailService.sendMessage({
        userId: user.id,
        sender_email: user.email,
        subject: subject.trim(),
        body_html: body || `<p>${body}</p>`,
        body_text: body.replace(/<[^>]*>/g, ''),
        recipients,
      });

      Alert.alert('Sent', 'Your message has been sent.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Send Failed', 'Could not send your message. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [validate, user, to, cc, bcc, subject, body, parseRecipients, navigation]);

  // ---------- Save Draft ----------

  const handleSaveDraft = useCallback(async () => {
    if (!user?.id || !user?.email) return;

    setIsSavingDraft(true);
    try {
      const recipients: EmailRecipient[] = [
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

      Alert.alert('Draft Saved', 'Your draft has been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Could not save draft.');
    } finally {
      setIsSavingDraft(false);
    }
  }, [user, to, cc, bcc, subject, body, draftId, parseRecipients, navigation]);

  // ---------- Header Buttons ----------

  useEffect(() => {
    const titleMap: Record<string, string> = {
      new: 'New Message',
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
          <Icon name="close" size={24} color={Colors.textSecondary} />
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
            <Icon name="save" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSend}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.sendButton}
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

        {/* Attachment placeholder */}
        <TouchableOpacity style={styles.attachmentRow}>
          <Icon name="attach-file" size={20} color={Colors.textTertiary} />
          <Text style={styles.attachmentText}>Add attachment</Text>
        </TouchableOpacity>

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
    backgroundColor: Colors.accent,
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
    borderBottomColor: Colors.divider,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 48,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textTertiary,
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
    color: Colors.accent,
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
    borderBottomColor: Colors.divider,
    gap: Spacing.sm,
  },
  attachmentText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
  // Body
  bodyContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  bodyInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    minHeight: 200,
    lineHeight: 22,
  },
});
