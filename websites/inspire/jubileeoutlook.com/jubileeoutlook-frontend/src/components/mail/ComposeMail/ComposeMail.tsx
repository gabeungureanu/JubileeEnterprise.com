import React, { useState, useCallback, useRef, useEffect } from 'react';
import { EmailMessage, ComposeMode, RecipientDto } from '../../../types/mail';
import { mailService } from '../../../services/mail/mailService';
import { signatureService } from '../../../services/mail/signatureService';
import { templateService, EmailTemplate } from '../../../services/mail/templateService';
import { tokenStore } from '../../../services/apiClient';
import RecipientInput, { Recipient } from '../RecipientInput/RecipientInput';
import './ComposeMail.css';

interface ComposeMailProps {
  mode: ComposeMode;
  originalMessage: EmailMessage | null;
  senderEmail: string;
  senderName: string;
  onClose: () => void;
  onSent: () => void;
  /** Pre-fill To recipients (used for cross-module compose, e.g. People → Mail) */
  prefillRecipients?: Recipient[];
}

interface ComposeFormData {
  subject: string;
}

interface AttachmentFile {
  file: File;
  id: string;
}

type ImportanceLevel = 'normal' | 'high' | 'low';

function buildInitialSubject(mode: ComposeMode, original: EmailMessage | null): string {
  if (!original || mode === 'new') return '';
  if (mode === 'reply' || mode === 'replyAll') {
    return original.subject.startsWith('RE:') ? original.subject : `RE: ${original.subject}`;
  }
  return original.subject.startsWith('FW:') ? original.subject : `FW: ${original.subject}`;
}

function buildInitialRecipientArrays(mode: ComposeMode, original: EmailMessage | null): { to: Recipient[]; cc: Recipient[]; bcc: Recipient[] } {
  if (!original || mode === 'new') return { to: [], cc: [], bcc: [] };

  if (mode === 'reply') {
    return { to: [{ name: original.from.name, email: original.from.address }], cc: [], bcc: [] };
  }

  if (mode === 'replyAll') {
    const toList: Recipient[] = [
      { name: original.from.name, email: original.from.address },
      ...original.to.map(r => ({ name: r.name, email: r.address })),
    ];
    const ccList: Recipient[] = original.cc.map(r => ({ name: r.name, email: r.address }));
    return { to: toList, cc: ccList, bcc: [] };
  }

  // forward
  return { to: [], cc: [], bcc: [] };
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

function getSignatureHtml(): string {
  const sig = signatureService.getActive();
  if (!sig || !sig.html) return '';
  return `<br><div class="email-signature" style="margin-top:16px;border-top:1px solid #555;padding-top:12px">${sig.html}</div>`;
}

function getInitialBodyHtml(mode: ComposeMode, original: EmailMessage | null): string {
  const signature = getSignatureHtml();
  if (!original || mode === 'new') return signature;
  if (mode === 'reply' || mode === 'replyAll') return signature + buildQuotedHtml(original);
  return signature + buildForwardHtml(original);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ComposeMail: React.FC<ComposeMailProps> = ({ mode, originalMessage, senderEmail, senderName, onClose, onSent, prefillRecipients }) => {
  const builtRecipients = buildInitialRecipientArrays(mode, originalMessage);
  const [toRecipients, setToRecipients] = useState<Recipient[]>(
    prefillRecipients && prefillRecipients.length > 0 ? prefillRecipients : builtRecipients.to
  );
  const [ccRecipients, setCcRecipients] = useState<Recipient[]>(builtRecipients.cc);
  const [bccRecipients, setBccRecipients] = useState<Recipient[]>(builtRecipients.bcc);
  const [formData, setFormData] = useState<ComposeFormData>({
    subject: buildInitialSubject(mode, originalMessage),
  });
  const [showCc, setShowCc] = useState(builtRecipients.cc.length > 0);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'unsaved' | null>(null);
  const [importance, setImportance] = useState<ImportanceLevel>('normal');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [availableTemplates] = useState<EmailTemplate[]>(() => templateService.getAll());
  const lastSavedHash = useRef<string>('');
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize editor content on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = getInitialBodyHtml(mode, originalMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toRecipientDtos = (list: Recipient[], type: 'to' | 'cc' | 'bcc'): RecipientDto[] => {
    return list.filter((r) => r.email).map((r) => ({ name: r.name, email: r.email, type }));
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
      to: toRecipients.map((r) => r.email).join(','),
      cc: ccRecipients.map((r) => r.email).join(','),
      bcc: bccRecipients.map((r) => r.email).join(','),
      subj: formData.subject, body: getEditorText(),
    });
  }, [formData, toRecipients, ccRecipients, bccRecipients, getEditorText]);

  // Auto-save draft every 30 seconds if changed
  useEffect(() => {
    draftTimerRef.current = setInterval(async () => {
      const currentHash = getFormHash();
      if (currentHash === lastSavedHash.current) return;
      if (toRecipients.length === 0 && !formData.subject && !getEditorText()) return;

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
            ...toRecipientDtos(toRecipients, 'to'),
            ...toRecipientDtos(ccRecipients, 'cc'),
            ...toRecipientDtos(bccRecipients, 'bcc'),
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
  }, [formData, toRecipients, ccRecipients, bccRecipients, draftId, senderEmail, getFormHash, getEditorText, getEditorHtml]);

  const handleSend = useCallback(async () => {
    if (toRecipients.length === 0) {
      setSendError('Please add at least one recipient');
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const userId = tokenStore.getUserId();
      if (!userId) throw new Error('Not signed in');

      const allRecipients = [
        ...toRecipientDtos(toRecipients, 'to'),
        ...toRecipientDtos(ccRecipients, 'cc'),
        ...toRecipientDtos(bccRecipients, 'bcc'),
      ];

      // Convert attachments to base64 for sending
      const attachmentPayloads = await Promise.all(
        attachments.map(async (att) => ({
          filename: att.file.name,
          content: await fileToBase64(att.file),
          contentType: att.file.type || 'application/octet-stream',
        }))
      );

      await mailService.sendMessage({
        userId,
        sender_email: senderEmail,
        subject: formData.subject,
        body_html: getEditorHtml(),
        body_text: getEditorText(),
        recipients: allRecipients,
        importance,
        attachments: attachmentPayloads.length > 0 ? attachmentPayloads : undefined,
      });

      if (draftId) {
        try { await mailService.deleteMessage(draftId); } catch { /* ignore */ }
      }

      onSent();
    } catch (err: any) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      setSendError(serverMsg || err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }, [formData, toRecipients, ccRecipients, bccRecipients, senderEmail, draftId, onSent, getEditorHtml, getEditorText, importance, attachments]);

  // Formatting commands
  const execFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  // Insert hyperlink
  const handleInsertLink = useCallback(() => {
    const url = window.prompt('Enter URL:');
    if (url) {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      execFormat('createLink', fullUrl);
    }
  }, [execFormat]);

  // Insert template into editor
  const handleInsertTemplate = useCallback((tpl: EmailTemplate) => {
    if (tpl.subject && !formData.subject) {
      setFormData((prev) => ({ ...prev, subject: tpl.subject }));
    }
    if (editorRef.current && tpl.bodyHtml) {
      editorRef.current.innerHTML = tpl.bodyHtml + (editorRef.current.innerHTML || '');
    }
    setShowTemplateMenu(false);
  }, [formData.subject]);

  // Cycle importance: normal → high → low → normal
  const handleToggleImportance = useCallback(() => {
    setImportance((prev) => {
      if (prev === 'normal') return 'high';
      if (prev === 'high') return 'low';
      return 'normal';
    });
  }, []);

  // Attachment file picker
  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: AttachmentFile[] = Array.from(files).map((file) => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Ctrl+Enter to send
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const modeLabel = mode === 'new' ? 'New Message' : mode === 'reply' ? 'Reply' : mode === 'replyAll' ? 'Reply All' : 'Forward';

  const importanceIcon = importance === 'high' ? 'priority_high' : importance === 'low' ? 'arrow_downward' : 'remove';
  const importanceTitle = importance === 'high' ? 'High importance (click to set low)' : importance === 'low' ? 'Low importance (click to set normal)' : 'Normal importance (click to set high)';

  return (
    <div className="compose-mail">
      {/* Hidden file input for attachments */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

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

        <button className="compose-mail__action-btn" onClick={handleAttachClick} title="Attach file">
          <span className="material-symbols-outlined">attach_file</span>
        </button>
        <button className="compose-mail__action-btn" onClick={handleInsertLink} title="Insert link">
          <span className="material-symbols-outlined">link</span>
        </button>
        <button
          className={`compose-mail__action-btn ${importance !== 'normal' ? 'compose-mail__action-btn--importance-active' : ''}`}
          onClick={handleToggleImportance}
          title={importanceTitle}
        >
          <span className="material-symbols-outlined">{importanceIcon}</span>
        </button>
        {availableTemplates.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              className="compose-mail__action-btn"
              onClick={() => setShowTemplateMenu((prev) => !prev)}
              title="Insert template"
            >
              <span className="material-symbols-outlined">quick_reply</span>
            </button>
            {showTemplateMenu && (
              <div className="compose-mail__template-dropdown">
                {availableTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    className="compose-mail__template-option"
                    onClick={() => handleInsertTemplate(tpl)}
                  >
                    <span className="material-symbols-outlined">description</span>
                    <div className="compose-mail__template-info">
                      <span className="compose-mail__template-name">{tpl.name}</span>
                      {tpl.subject && <span className="compose-mail__template-subject">{tpl.subject}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="compose-mail__mode-label">{modeLabel}</span>

        {importance !== 'normal' && (
          <span className={`compose-mail__importance-badge compose-mail__importance-badge--${importance}`}>
            {importance === 'high' ? 'High Importance' : 'Low Importance'}
          </span>
        )}

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
          <RecipientInput
            recipients={toRecipients}
            onChange={setToRecipients}
            placeholder="Add recipients"
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
            <RecipientInput
              recipients={ccRecipients}
              onChange={setCcRecipients}
              placeholder="Add Cc recipients"
            />
          </div>
        )}

        {/* Bcc */}
        {showBcc && (
          <div className="compose-mail__field-row">
            <span className="compose-mail__field-label">Bcc</span>
            <RecipientInput
              recipients={bccRecipients}
              onChange={setBccRecipients}
              placeholder="Add Bcc recipients"
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

      {/* Attachments Bar */}
      {attachments.length > 0 && (
        <div className="compose-mail__attachments">
          <span className="compose-mail__attachments-label">
            <span className="material-symbols-outlined">attach_file</span>
            {attachments.length} file{attachments.length > 1 ? 's' : ''}
          </span>
          <div className="compose-mail__attachment-list">
            {attachments.map((att) => (
              <div key={att.id} className="compose-mail__attachment-chip">
                <span className="material-symbols-outlined">description</span>
                <span className="compose-mail__attachment-name">{att.file.name}</span>
                <span className="compose-mail__attachment-size">{formatFileSize(att.file.size)}</span>
                <button
                  className="compose-mail__attachment-remove"
                  onClick={() => handleRemoveAttachment(att.id)}
                  title="Remove"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
