/**
 * ComposeScreen — New/Reply/ReplyAll/Forward email compose modal.
 *
 * Receives mode and optional originalMessage from route params.
 * Pre-fills fields based on compose mode. Validates that at least
 * one recipient and a subject are present before sending.
 *
 * Features:
 * - Visible focus indicator (primary-color bottom border on active field)
 * - Separate user text + rendered quoted HTML for reply/forward
 * - Images, links, and formatting preserved in quoted content
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import RenderHtml from 'react-native-render-html';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner } from '../../components/common';
import { useAlert } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { mailService } from '../../services/mail/mailService';
import { signatureService } from '../../services/mail/signatureService';
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
  return `RE: ${subject}`;
}

function buildForwardSubject(subject: string): string {
  if (/^(fwd?|fw):/i.test(subject.trim())) return subject;
  return `FW: ${subject}`;
}

/** Build quoted HTML for reply modes — matches web: From/Date/Subject header block. */
function buildReplyQuotedHtml(
  from: { name?: string; address: string },
  date: string,
  subject: string,
  bodyHtml: string,
): string {
  const formattedDate = date ? new Date(date).toLocaleString() : '';
  const fromDisplay = from.name ? `${from.name} &lt;${from.address}&gt;` : from.address;
  const header = `<div style="margin-bottom:8px;font-size:12px"><b>From:</b> ${fromDisplay}<br><b>Date:</b> ${formattedDate}<br><b>Subject:</b> ${subject}</div>`;
  return `<br><br><div style="border-left:2px solid #555;padding-left:12px;color:#999;margin-top:8px">${header}${bodyHtml}</div>`;
}

/** Build quoted HTML for forward mode — matches web: ---------- Forwarded message ---------- header with From/Date/Subject/To. */
function buildForwardQuotedHtml(
  from: { name?: string; address: string },
  date: string,
  subject: string,
  toRecipients: { name?: string; address: string }[],
  bodyHtml: string,
): string {
  const formattedDate = date ? new Date(date).toLocaleString() : '';
  const fromDisplay = from.name ? `${from.name} &lt;${from.address}&gt;` : from.address;
  const toDisplay = toRecipients
    .map((r) => (r.name ? `${r.name} &lt;${r.address}&gt;` : r.address))
    .join('; ');
  const header = `<div style="margin-bottom:8px;font-size:12px;color:#999"><b>---------- Forwarded message ----------</b><br><b>From:</b> ${fromDisplay}<br><b>Date:</b> ${formattedDate}<br><b>Subject:</b> ${subject}<br><b>To:</b> ${toDisplay}</div>`;
  return `<br><br><div style="border-top:1px solid #555;padding-top:12px;margin-top:8px">${header}${bodyHtml}</div>`;
}

/** Convert user plain text to safe HTML. */
function plainTextToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

// ---------- Component ----------

export default function ComposeScreen() {
  const navigation = useNavigation<ComposeNav>();
  const route = useRoute<ComposeRoute>();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const { alert, AlertComponent } = useAlert();
  const { mode = 'new', originalMessage, draftId, to: prefillTo } = route.params;

  // ---------- Form State ----------

  const [to, setTo] = useState(prefillTo || '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [quotedHtml, setQuotedHtml] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [signatureHtml, setSignatureHtml] = useState('');
  const [importance, setImportance] = useState<'normal' | 'high' | 'low'>('normal');

  // ---------- Input Refs ----------

  const toInputRef = useRef<TextInput>(null);
  const bodyInputRef = useRef<TextInput>(null);

  // ---------- Load Active Signature ----------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const activeId = await signatureService.getActiveId();
        if (cancelled) return;
        if (activeId) {
          const all = await signatureService.getAll();
          const sig = all.find((s) => s.id === activeId);
          if (sig && !cancelled) setSignatureHtml(sig.html);
        } else {
          const defaultSig = await signatureService.getDefault();
          if (defaultSig && !cancelled) setSignatureHtml(defaultSig.html);
        }
      } catch (err) {
        console.warn('[Compose] Failed to load signature:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---------- Pre-fill based on mode ----------

  useEffect(() => {
    if (!originalMessage) return;

    const msgBody = originalMessage.bodyHtml || originalMessage.bodyText || originalMessage.bodyPreview || '';
    const msgDate = originalMessage.receivedAt || originalMessage.sentAt || '';
    const msgSubject = originalMessage.subject || '';
    const msgFrom = originalMessage.from || { name: '', address: '' };

    switch (mode) {
      case 'reply': {
        setTo(originalMessage.from.address || '');
        setSubject(buildReplySubject(msgSubject));
        setQuotedHtml(buildReplyQuotedHtml(msgFrom, msgDate, msgSubject, msgBody));
        break;
      }
      case 'replyAll': {
        const replyTo = originalMessage.from.address || '';
        const toRecipients = (originalMessage.to || [])
          .filter((r) => r.address !== user?.email)
          .map((r) => r.address);
        const ccRecipients = (originalMessage.cc || [])
          .filter((r) => r.address !== user?.email)
          .map((r) => r.address);

        setTo([replyTo, ...toRecipients].join(', '));
        if (ccRecipients.length > 0) {
          setCc(ccRecipients.join(', '));
          setShowCc(true);
        }
        setSubject(buildReplySubject(msgSubject));
        setQuotedHtml(buildReplyQuotedHtml(msgFrom, msgDate, msgSubject, msgBody));
        break;
      }
      case 'forward': {
        setSubject(buildForwardSubject(msgSubject));
        setQuotedHtml(buildForwardQuotedHtml(msgFrom, msgDate, msgSubject, originalMessage.to || [], msgBody));
        break;
      }
      default:
        break;
    }
  }, [mode, originalMessage, user?.email]);

  // ---------- Auto-focus based on mode ----------

  useFocusEffect(
    useCallback(() => {
      const handle = InteractionManager.runAfterInteractions(() => {
        if (mode === 'forward') {
          toInputRef.current?.focus();
        } else if (mode === 'reply' || mode === 'replyAll') {
          bodyInputRef.current?.focus();
        } else {
          toInputRef.current?.focus();
        }
      });
      return () => handle.cancel();
    }, [mode]),
  );

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
  }, [to, subject, parseRecipients, alert]);

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
  }, [alert]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }, []);

  // ---------- Build full HTML for send/draft ----------

  const buildFullHtml = useCallback((): string => {
    const userHtml = plainTextToHtml(body);
    const sigBlock = signatureHtml ? `<br><div class="signature">${signatureHtml}</div>` : '';
    if (quotedHtml) {
      return `${userHtml}${sigBlock}${quotedHtml}`;
    }
    return (userHtml || '<p></p>') + sigBlock;
  }, [body, quotedHtml, signatureHtml]);

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
        body_html: buildFullHtml(),
        body_text: body,
        recipients,
        importance: importance !== 'normal' ? importance : undefined,
        attachments: attachmentPayloads.length > 0 ? attachmentPayloads : undefined,
      });

      alert('Sent', 'Your message has been sent.', 'success', () => navigation.goBack());
    } catch (err) {
      alert('Send Failed', 'Could not send your message. Please try again.', 'error');
    } finally {
      setIsSending(false);
    }
  }, [validate, user, to, cc, bcc, subject, body, attachments, importance, parseRecipients, navigation, buildFullHtml]);

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
        body_html: buildFullHtml(),
        body_text: body,
        recipients,
      });

      alert('Draft Saved', 'Your draft has been saved.', 'success', () => navigation.goBack());
    } catch (err) {
      alert('Error', 'Could not save draft.', 'error');
    } finally {
      setIsSavingDraft(false);
    }
  }, [user, to, cc, bcc, subject, body, draftId, parseRecipients, navigation, buildFullHtml]);

  // ---------- Importance Toggle ----------

  const handleToggleImportance = useCallback(() => {
    setImportance((prev) => {
      if (prev === 'normal') return 'high';
      if (prev === 'high') return 'low';
      return 'normal';
    });
  }, []);

  // ---------- Draft Auto-Save (30s interval) ----------

  const lastSavedHashRef = useRef('');
  const draftIdRef = useRef(draftId || '');

  useEffect(() => {
    if (!user?.id || !user?.email) return;

    const intervalId = setInterval(async () => {
      // Build a simple hash of current form content to detect changes
      const contentHash = `${to}|${cc}|${bcc}|${subject}|${body}`;
      if (contentHash === lastSavedHashRef.current) return; // No changes

      // Don't auto-save if there's literally nothing
      if (!to.trim() && !subject.trim() && !body.trim()) return;

      try {
        const recipients: ComposeRecipient[] = [
          ...parseRecipients(to, 'to'),
          ...parseRecipients(cc, 'cc'),
          ...parseRecipients(bcc, 'bcc'),
        ];

        const result = await mailService.saveDraft({
          userId: user.id,
          sender_email: user.email,
          id: draftIdRef.current || undefined,
          subject: subject.trim(),
          body_html: buildFullHtml(),
          body_text: body,
          recipients,
        });

        lastSavedHashRef.current = contentHash;
        if (result.draftId && !draftIdRef.current) {
          draftIdRef.current = result.draftId;
        }
      } catch {
        // Silent — auto-save should not interrupt the user
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [user, to, cc, bcc, subject, body, parseRecipients, buildFullHtml]);

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
            onPress={handleToggleImportance}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerAction}
          >
            <Icon
              name={importance === 'high' ? 'priority-high' : importance === 'low' ? 'arrow-downward' : 'remove'}
              size={20}
              color={importance === 'high' ? Colors.error : importance === 'low' ? Colors.accent : Colors.textTertiary}
            />
          </TouchableOpacity>
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
  }, [navigation, mode, handleSend, handleSaveDraft, handleToggleImportance, importance, isSending, isSavingDraft]);

  // ---------- HTML rendering config for quoted content ----------

  const quotedHtmlTagStyles = {
    body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
    a: { color: Colors.accent },
    p: { marginBottom: 4 },
    img: { maxWidth: screenWidth - Spacing.lg * 2 },
    blockquote: { marginLeft: 0, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: '#444' },
  };

  const quotedContentWidth = screenWidth - Spacing.lg * 2;

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
        <View style={[styles.fieldRow, focusedField === 'to' && styles.fieldRowFocused]}>
          <Text style={styles.fieldLabel}>To</Text>
          <TextInput
            ref={toInputRef}
            style={styles.fieldInput}
            value={to}
            onChangeText={setTo}
            placeholder="Recipients"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setFocusedField('to')}
            onBlur={() => setFocusedField(null)}
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
          <View style={[styles.fieldRow, focusedField === 'cc' && styles.fieldRowFocused]}>
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
              onFocus={() => setFocusedField('cc')}
              onBlur={() => setFocusedField(null)}
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
          <View style={[styles.fieldRow, focusedField === 'bcc' && styles.fieldRowFocused]}>
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
              onFocus={() => setFocusedField('bcc')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        )}

        {/* Subject */}
        <View style={[styles.fieldRow, focusedField === 'subject' && styles.fieldRowFocused]}>
          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput
            style={styles.fieldInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            placeholderTextColor={Colors.textTertiary}
            onFocus={() => setFocusedField('subject')}
            onBlur={() => setFocusedField(null)}
          />
          {importance !== 'normal' && (
            <View style={[styles.importanceBadge, importance === 'high' ? styles.importanceHigh : styles.importanceLow]}>
              <Text style={styles.importanceBadgeText}>
                {importance === 'high' ? 'High' : 'Low'}
              </Text>
            </View>
          )}
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

        {/* Body — user's new text */}
        <View style={[styles.bodyContainer, focusedField === 'body' && styles.bodyContainerFocused]}>
          <TextInput
            ref={bodyInputRef}
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="Compose Email"
            placeholderTextColor={Colors.textTertiary}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
            onFocus={() => setFocusedField('body')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        {/* Quoted content — rendered HTML with images/links preserved */}
        {quotedHtml.length > 0 && (
          <View style={styles.quotedContainer}>
            <RenderHtml
              contentWidth={quotedContentWidth}
              source={{ html: quotedHtml }}
              tagsStyles={quotedHtmlTagStyles}
              defaultTextProps={{ selectable: true }}
              baseStyle={styles.quotedBase}
              ignoredDomTags={['meta', 'link', 'script', 'style']}
              enableExperimentalMarginCollapsing
            />
          </View>
        )}
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
  fieldRowFocused: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: Colors.background,
    borderLeftWidth: 2,
    borderLeftColor: Colors.transparent,
  },
  bodyContainerFocused: {
    borderLeftColor: Colors.primary,
  },
  bodyInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    minHeight: 120,
    lineHeight: 22,
  },
  // Quoted content
  quotedContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.background,
  },
  quotedBase: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  // Importance badge
  importanceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  importanceHigh: {
    backgroundColor: Colors.error + '1A', // 10% opacity
  },
  importanceLow: {
    backgroundColor: Colors.accent + '1A',
  },
  importanceBadgeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
