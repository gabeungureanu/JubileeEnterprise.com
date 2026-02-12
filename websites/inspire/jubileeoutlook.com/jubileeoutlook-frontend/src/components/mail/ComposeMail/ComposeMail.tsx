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
}

function buildInitialSubject(mode: ComposeMode, original: EmailMessage | null): string {
  if (!original || mode === 'new') return '';
  if (mode === 'reply' || mode === 'replyAll') {
    return original.subject.startsWith('RE:') ? original.subject : `RE: ${original.subject}`;
  }
  return original.subject.startsWith('FW:') ? original.subject : `FW: ${original.subject}`;
}

function buildInitialRecipients(mode: ComposeMode, original: EmailMessage | null): Pick<ComposeFormData, 'toInput' | 'ccInput' | 'bccInput'> {
  if (!original || mode === 'new') return { toInput: '', ccInput: '', bccInput: '' };

  const senderAddr = original.from.name
    ? `${original.from.name} <${original.from.address}>`
    : original.from.address;

  if (mode === 'reply') {
    return { toInput: senderAddr, ccInput: '', bccInput: '' };
  }

  if (mode === 'replyAll') {
    const toAddrs = [senderAddr, ...original.to.map(r => r.name ? `${r.name} <${r.address}>` : r.address)];
    const ccAddrs = original.cc.map(r => r.name ? `${r.name} <${r.address}>` : r.address);
    return { toInput: toAddrs.join('; '), ccInput: ccAddrs.join('; '), bccInput: '' };
  }

  // forward
  return { toInput: '', ccInput: '', bccInput: '' };
}

function buildQuotedHtml(msg: EmailMessage): string {
  const date = new Date(msg.sentAt || msg.receivedAt).toLocaleString();
  const from = msg.from.name ? `${msg.from.name} &lt;${msg.from.address}&gt;` : msg.from.address;
  const body = msg.bodyHtml || (msg.bodyText || '').replace(/\n/g, '<br>');
  return `<br><br><div style="border-left:2px solid #555;padding-left:12px;color:#999;margin-top:8px"><div style="margin-bottom:8px;font-size:12px"><b>From:</b> ${from}<br><b>Date:</b> ${date}<br><b>Subject:</b> ${msg.subject}</div>${body}</div>`;
}

function buildForwardHtml(msg: EmailMessage): string {
  const date = new Date(msg.sentAt || msg.receivedAt).toLocaleString();
  const from = msg.from.name ? `${msg.from.name} &lt;${msg.from.address}&gt;` : msg.from.address;
  const to = msg.to.map(r => r.name ? `${r.name} &lt;${r.address}&gt;` : r.address).join('; ');
  const body = msg.bodyHtml || (msg.bodyText || '').replace(/\n/g, '<br>');
  return `<br><br><div style="border-top:1px solid #555;padding-top:12px;margin-top:8px"><div style="margin-bottom:8px;font-size:12px;color:#999"><b>---------- Forwarded message ----------</b><br><b>From:</b> ${from}<br><b>Date:</b> ${date}<br><b>Subject:</b> ${msg.subject}<br><b>To:</b> ${to}</div>${body}</div>`;
}

function getInitialBodyHtml(mode: ComposeMode, original: EmailMessage | null): string {
  if (!original || mode === 'new') return '';
  if (mode === 'reply' || mode === 'replyAll') return buildQuotedHtml(original);
  return buildForwardHtml(original);
}

const ComposeMail: React.FC<ComposeMailProps> = ({ mode, originalMessage, senderEmail, senderName, onClose, onSent }) => {
  const recipients = buildInitialRecipients(mode, originalMessage);
  const [formData, setFormData] = useState<ComposeFormData>({
    ...recipients,
    subject: buildInitialSubject(mode, originalMessage),
  });
  const [showCc, setShowCc] = useState(!!recipients.ccInput);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'unsaved' | null>(null);
  const lastSavedHash = useRef<string>('');
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize editor content on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = getInitialBodyHtml(mode, originalMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseRecipients = (input: string, type: 'to' | 'cc' | 'bcc'): RecipientDto[] => {
    return input
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const match = entry.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
        if (match) return { name: match[1].trim(), email: match[2].trim(), type };
        return { name: '', email: entry, type };
      });
  };

  const getEditorText = useCallback((): string => {
    return editorRef.current?.innerText || '';
  }, []);

  const getEditorHtml = useCallback((): string => {
    return editorRef.current?.innerHTML || '';
  }, []);

  // Create a simple hash of form data for draft change detection
  const getFormHash = useCallback(() => {
    return JSON.stringify({
      to: formData.toInput, cc: formData.ccInput, bcc: formData.bccInput,
      subj: formData.subject, body: getEditorText(),
    });
  }, [formData, getEditorText]);

  // Auto-save draft every 30 seconds if changed
  useEffect(() => {
    draftTimerRef.current = setInterval(async () => {
      const currentHash = getFormHash();
      if (currentHash === lastSavedHash.current) return;
      if (!formData.toInput && !formData.subject && !getEditorText()) return;

      setDraftStatus('saving');
      try {
        const userId = tokenStore.getUserId();
        if (!userId) return;

        const result = await mailService.saveDraft({
          userId,
          id: draftId || undefined,
          sender_email: senderEmail,
          subject: formData.subject,
          body_html: getEditorHtml(),
          body_text: getEditorText(),
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
  }, [formData, draftId, senderEmail, getFormHash, getEditorText, getEditorHtml]);

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
        body_html: getEditorHtml(),
        body_text: getEditorText(),
        recipients,
        importance: 'normal',
      });

      if (draftId) {
        try { await mailService.deleteMessage(draftId); } catch { /* ignore */ }
      }

      onSent();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }, [formData, senderEmail, draftId, onSent, getEditorHtml, getEditorText]);

  // Formatting commands
  const execFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  // Ctrl+Enter to send
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const modeLabel = mode === 'new' ? 'New Message' : mode === 'reply' ? 'Reply' : mode === 'replyAll' ? 'Reply All' : 'Forward';

  return (
    <div className="compose-mail">
      {/* Action Bar */}
      <div className="compose-mail__action-bar">
        <button
          className="compose-mail__send-btn"
          onClick={handleSend}
          disabled={sending}
        >
          <span className="material-symbols-outlined">send</span>
          <span>{sending ? 'Sending...' : 'Send'}</span>
        </button>

        <div className="compose-mail__action-separator" />

        <button className="compose-mail__action-btn" title="Attach file">
          <span className="material-symbols-outlined">attach_file</span>
        </button>
        <button className="compose-mail__action-btn" title="Insert link">
          <span className="material-symbols-outlined">link</span>
        </button>
        <button className="compose-mail__action-btn" title="Set importance">
          <span className="material-symbols-outlined">priority_high</span>
        </button>

        <span className="compose-mail__mode-label">{modeLabel}</span>

        {draftStatus && (
          <span className="compose-mail__draft-indicator">
            {draftStatus === 'saved' ? 'Draft saved' : draftStatus === 'saving' ? 'Saving...' : 'Unsaved changes'}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          className="compose-mail__action-btn compose-mail__action-btn--discard"
          onClick={onClose}
          title="Discard"
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      </div>

      {/* Error Banner */}
      {sendError && (
        <div className="compose-mail__error">
          <span className="material-symbols-outlined">error</span>
          <span>{sendError}</span>
        </div>
      )}

      {/* Address Fields */}
      <div className="compose-mail__fields">
        {/* From */}
        <div className="compose-mail__field-row">
          <span className="compose-mail__field-label">From</span>
          <span className="compose-mail__from-value">
            {senderName ? `${senderName} <${senderEmail}>` : senderEmail}
          </span>
        </div>

        {/* To */}
        <div className="compose-mail__field-row">
          <span className="compose-mail__field-label">To</span>
          <input
            type="text"
            className="compose-mail__field-input"
            placeholder="Add recipients"
            value={formData.toInput}
            onChange={(e) => setFormData((prev) => ({ ...prev, toInput: e.target.value }))}
            autoFocus
          />
          <div className="compose-mail__field-actions">
            {!showCc && (
              <button className="compose-mail__cc-bcc-btn" onClick={() => setShowCc(true)}>Cc</button>
            )}
            {!showBcc && (
              <button className="compose-mail__cc-bcc-btn" onClick={() => setShowBcc(true)}>Bcc</button>
            )}
          </div>
        </div>

        {/* Cc */}
        {showCc && (
          <div className="compose-mail__field-row">
            <span className="compose-mail__field-label">Cc</span>
            <input
              type="text"
              className="compose-mail__field-input"
              placeholder="Add Cc recipients"
              value={formData.ccInput}
              onChange={(e) => setFormData((prev) => ({ ...prev, ccInput: e.target.value }))}
            />
          </div>
        )}

        {/* Bcc */}
        {showBcc && (
          <div className="compose-mail__field-row">
            <span className="compose-mail__field-label">Bcc</span>
            <input
              type="text"
              className="compose-mail__field-input"
              placeholder="Add Bcc recipients"
              value={formData.bccInput}
              onChange={(e) => setFormData((prev) => ({ ...prev, bccInput: e.target.value }))}
            />
          </div>
        )}

        {/* Subject */}
        <div className="compose-mail__field-row compose-mail__field-row--subject">
          <span className="compose-mail__field-label">Subject</span>
          <input
            type="text"
            className="compose-mail__field-input"
            placeholder="Add a subject"
            value={formData.subject}
            onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
          />
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="compose-mail__format-bar">
        <button className="compose-mail__format-btn" onClick={() => execFormat('bold')} title="Bold (Ctrl+B)">
          <span className="material-symbols-outlined">format_bold</span>
        </button>
        <button className="compose-mail__format-btn" onClick={() => execFormat('italic')} title="Italic (Ctrl+I)">
          <span className="material-symbols-outlined">format_italic</span>
        </button>
        <button className="compose-mail__format-btn" onClick={() => execFormat('underline')} title="Underline (Ctrl+U)">
          <span className="material-symbols-outlined">format_underlined</span>
        </button>
        <button className="compose-mail__format-btn" onClick={() => execFormat('strikeThrough')} title="Strikethrough">
          <span className="material-symbols-outlined">strikethrough_s</span>
        </button>

        <div className="compose-mail__format-separator" />

        <button className="compose-mail__format-btn" onClick={() => execFormat('insertUnorderedList')} title="Bulleted list">
          <span className="material-symbols-outlined">format_list_bulleted</span>
        </button>
        <button className="compose-mail__format-btn" onClick={() => execFormat('insertOrderedList')} title="Numbered list">
          <span className="material-symbols-outlined">format_list_numbered</span>
        </button>

        <div className="compose-mail__format-separator" />

        <button className="compose-mail__format-btn" onClick={() => execFormat('justifyLeft')} title="Align left">
          <span className="material-symbols-outlined">format_align_left</span>
        </button>
        <button className="compose-mail__format-btn" onClick={() => execFormat('justifyCenter')} title="Align center">
          <span className="material-symbols-outlined">format_align_center</span>
        </button>
        <button className="compose-mail__format-btn" onClick={() => execFormat('justifyRight')} title="Align right">
          <span className="material-symbols-outlined">format_align_right</span>
        </button>

        <div className="compose-mail__format-separator" />

        <button className="compose-mail__format-btn" onClick={() => execFormat('removeFormat')} title="Clear formatting">
          <span className="material-symbols-outlined">format_clear</span>
        </button>
      </div>

      {/* Rich Text Editor */}
      <div className="compose-mail__editor">
        <div
          ref={editorRef}
          className="compose-mail__editable"
          contentEditable
          data-placeholder="Write your message..."
          onKeyDown={handleEditorKeyDown}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
};

export default ComposeMail;
