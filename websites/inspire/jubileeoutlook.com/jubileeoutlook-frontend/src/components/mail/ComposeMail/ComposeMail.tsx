import React, { useState, useCallback, useRef, useEffect } from 'react';
import { EmailMessage, ComposeMode, RecipientDto } from '../../../types/mail';
import { mailService } from '../../../services/mail/mailService';
import { tokenStore } from '../../../services/apiClient';
import './ComposeMail.css';

interface ComposeMailProps {
  mode: ComposeMode;
  originalMessage: EmailMessage | null;
  senderEmail: string;
  senderName: string;
  onClose: () => void;
  onSent: () => void;
}

interface ComposeFormData {
  toInput: string;
  ccInput: string;
  bccInput: string;
  subject: string;
  bodyText: string;
}

function buildInitialForm(mode: ComposeMode, original: EmailMessage | null): ComposeFormData {
  if (!original || mode === 'new') {
    return { toInput: '', ccInput: '', bccInput: '', subject: '', bodyText: '' };
  }

  const senderAddr = original.from.name
    ? `${original.from.name} <${original.from.address}>`
    : original.from.address;

  if (mode === 'reply') {
    return {
      toInput: senderAddr,
      ccInput: '',
      bccInput: '',
      subject: original.subject.startsWith('RE:') ? original.subject : `RE: ${original.subject}`,
      bodyText: buildQuotedText(original),
    };
  }

  if (mode === 'replyAll') {
    const toAddrs = [senderAddr, ...original.to.map(r => r.name ? `${r.name} <${r.address}>` : r.address)];
    const ccAddrs = original.cc.map(r => r.name ? `${r.name} <${r.address}>` : r.address);
    return {
      toInput: toAddrs.join('; '),
      ccInput: ccAddrs.join('; '),
      bccInput: '',
      subject: original.subject.startsWith('RE:') ? original.subject : `RE: ${original.subject}`,
      bodyText: buildQuotedText(original),
    };
  }

  // forward
  return {
    toInput: '',
    ccInput: '',
    bccInput: '',
    subject: original.subject.startsWith('FW:') ? original.subject : `FW: ${original.subject}`,
    bodyText: buildForwardText(original),
  };
}

function buildQuotedText(msg: EmailMessage): string {
  const date = new Date(msg.sentAt || msg.receivedAt).toLocaleString();
  const from = msg.from.name ? `${msg.from.name} <${msg.from.address}>` : msg.from.address;
  return `\n\n---------- Original Message ----------\nFrom: ${from}\nDate: ${date}\nSubject: ${msg.subject}\n\n${msg.bodyText || ''}`;
}

function buildForwardText(msg: EmailMessage): string {
  const date = new Date(msg.sentAt || msg.receivedAt).toLocaleString();
  const from = msg.from.name ? `${msg.from.name} <${msg.from.address}>` : msg.from.address;
  const to = msg.to.map(r => r.name ? `${r.name} <${r.address}>` : r.address).join('; ');
  return `\n\n---------- Forwarded message ----------\nFrom: ${from}\nDate: ${date}\nSubject: ${msg.subject}\nTo: ${to}\n\n${msg.bodyText || ''}`;
}

const ComposeMail: React.FC<ComposeMailProps> = ({ mode, originalMessage, senderEmail, senderName, onClose, onSent }) => {
  const [formData, setFormData] = useState<ComposeFormData>(() => buildInitialForm(mode, originalMessage));
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'unsaved' | null>(null);
  const lastSavedHash = useRef<string>('');
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parseRecipients = (input: string, type: 'to' | 'cc' | 'bcc'): RecipientDto[] => {
    return input
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        // Parse "Name <email>" or plain "email"
        const match = entry.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
        if (match) return { name: match[1].trim(), email: match[2].trim(), type };
        return { name: '', email: entry, type };
      });
  };

  // Create a simple hash of form data for draft change detection
  const getFormHash = useCallback(() => {
    return JSON.stringify({
      to: formData.toInput, cc: formData.ccInput, bcc: formData.bccInput,
      subj: formData.subject, body: formData.bodyText,
    });
  }, [formData]);

  // Auto-save draft every 30 seconds if changed
  useEffect(() => {
    draftTimerRef.current = setInterval(async () => {
      const currentHash = getFormHash();
      if (currentHash === lastSavedHash.current) return;
      if (!formData.toInput && !formData.subject && !formData.bodyText) return;

      setDraftStatus('saving');
      try {
        const userId = tokenStore.getUserId();
        if (!userId) return;

        const result = await mailService.saveDraft({
          userId,
          id: draftId || undefined,
          sender_email: senderEmail,
          subject: formData.subject,
          body_text: formData.bodyText,
          recipients: [
            ...parseRecipients(formData.toInput, 'to'),
            ...parseRecipients(formData.ccInput, 'cc'),
            ...parseRecipients(formData.bccInput, 'bcc'),
          ],
        });

        if (result.draftId && !draftId) {
          setDraftId(result.draftId);
        }
        lastSavedHash.current = currentHash;
        setDraftStatus('saved');
      } catch {
        setDraftStatus('unsaved');
      }
    }, 30000);

    return () => {
      if (draftTimerRef.current) clearInterval(draftTimerRef.current);
    };
  }, [formData, draftId, senderEmail, getFormHash]);

  const handleSend = useCallback(async () => {
    const toRecipients = parseRecipients(formData.toInput, 'to');
    if (toRecipients.length === 0) {
      setSendError('Please add at least one recipient');
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const userId = tokenStore.getUserId();
      if (!userId) throw new Error('Not signed in');

      const recipients = [
        ...toRecipients,
        ...parseRecipients(formData.ccInput, 'cc'),
        ...parseRecipients(formData.bccInput, 'bcc'),
      ];

      await mailService.sendMessage({
        userId,
        sender_email: senderEmail,
        subject: formData.subject,
        body_text: formData.bodyText,
        recipients,
        importance: 'normal',
      });

      // If we had a draft, delete it after sending
      if (draftId) {
        try { await mailService.deleteMessage(draftId); } catch { /* ignore */ }
      }

      onSent();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }, [formData, senderEmail, draftId, onSent]);

  const modeLabel = mode === 'new' ? 'New Message' : mode === 'reply' ? 'Reply' : mode === 'replyAll' ? 'Reply All' : 'Forward';

  return (
    <div className="compose-mail">
      <div className="compose-mail__header">
        <div className="compose-mail__header-left">
          <span className="compose-mail__mode-label">{modeLabel}</span>
          {draftStatus === 'saved' && <span className="compose-mail__draft-status">Draft saved</span>}
          {draftStatus === 'saving' && <span className="compose-mail__draft-status">Saving...</span>}
        </div>
        <div className="compose-mail__header-right">
          <button
            className="compose-mail__send-btn"
            onClick={handleSend}
            disabled={sending}
          >
            <span className="material-symbols-outlined">send</span>
            <span>{sending ? 'Sending...' : 'Send'}</span>
          </button>
          <button className="compose-mail__close-btn" onClick={onClose} title="Discard">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {sendError && (
        <div className="compose-mail__error">
          <span className="material-symbols-outlined">error</span>
          <span>{sendError}</span>
        </div>
      )}

      <div className="compose-mail__fields">
        <div className="compose-mail__field">
          <label className="compose-mail__label">From</label>
          <div className="compose-mail__from-display">{senderName ? `${senderName} <${senderEmail}>` : senderEmail}</div>
        </div>
        <div className="compose-mail__field">
          <label className="compose-mail__label">To</label>
          <input
            type="text"
            className="compose-mail__input"
            placeholder="Recipients (semicolon separated)"
            value={formData.toInput}
            onChange={(e) => setFormData((prev) => ({ ...prev, toInput: e.target.value }))}
          />
          {!showBcc && (
            <button className="compose-mail__bcc-toggle" onClick={() => setShowBcc(true)}>Bcc</button>
          )}
        </div>
        <div className="compose-mail__field">
          <label className="compose-mail__label">Cc</label>
          <input
            type="text"
            className="compose-mail__input"
            placeholder="Cc"
            value={formData.ccInput}
            onChange={(e) => setFormData((prev) => ({ ...prev, ccInput: e.target.value }))}
          />
        </div>
        {showBcc && (
          <div className="compose-mail__field">
            <label className="compose-mail__label">Bcc</label>
            <input
              type="text"
              className="compose-mail__input"
              placeholder="Bcc"
              value={formData.bccInput}
              onChange={(e) => setFormData((prev) => ({ ...prev, bccInput: e.target.value }))}
            />
          </div>
        )}
        <div className="compose-mail__field">
          <label className="compose-mail__label">Subject</label>
          <input
            type="text"
            className="compose-mail__input"
            placeholder="Subject"
            value={formData.subject}
            onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
          />
        </div>
      </div>

      <div className="compose-mail__editor">
        <textarea
          className="compose-mail__textarea"
          placeholder="Write your message..."
          value={formData.bodyText}
          onChange={(e) => setFormData((prev) => ({ ...prev, bodyText: e.target.value }))}
        />
      </div>
    </div>
  );
};

export default ComposeMail;
