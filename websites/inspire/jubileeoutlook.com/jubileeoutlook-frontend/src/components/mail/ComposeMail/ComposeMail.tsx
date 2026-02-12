import React, { useState } from 'react';
import { RecipientDto } from '../../../types/mail';
import './ComposeMail.css';

interface ComposeFormData {
  toInput: string;
  ccInput: string;
  subject: string;
  bodyText: string;
}

interface ComposeMailProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { subject: string; bodyText: string; recipients: RecipientDto[] }) => void;
  initialSubject?: string;
  initialBody?: string;
  initialTo?: string;
}

const ComposeMail: React.FC<ComposeMailProps> = ({ isOpen, onClose, onSend, initialSubject, initialBody, initialTo }) => {
  const [formData, setFormData] = useState<ComposeFormData>({
    toInput: initialTo || '',
    ccInput: '',
    subject: initialSubject || '',
    bodyText: initialBody || '',
  });

  if (!isOpen) return null;

  const parseRecipients = (input: string, type: 'to' | 'cc' | 'bcc'): RecipientDto[] => {
    return input
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({ email, name: '', type }));
  };

  const handleSend = () => {
    const recipients: RecipientDto[] = [
      ...parseRecipients(formData.toInput, 'to'),
      ...parseRecipients(formData.ccInput, 'cc'),
    ];
    onSend({ subject: formData.subject, bodyText: formData.bodyText, recipients });
    onClose();
  };

  return (
    <div className="compose-mail">
      <div className="compose-mail__header">
        <button className="compose-mail__send-btn" onClick={handleSend}>
          <span className="material-symbols-outlined">send</span>
          <span>Send</span>
        </button>
        <div className="compose-mail__toolbar">
          <button className="compose-mail__tool-btn" title="Bold">
            <span className="material-symbols-outlined">format_bold</span>
          </button>
          <button className="compose-mail__tool-btn" title="Italic">
            <span className="material-symbols-outlined">format_italic</span>
          </button>
          <button className="compose-mail__tool-btn" title="Underline">
            <span className="material-symbols-outlined">format_underlined</span>
          </button>
          <div className="compose-mail__tool-separator" />
          <button className="compose-mail__tool-btn" title="Attach file">
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <button className="compose-mail__tool-btn" title="Insert image">
            <span className="material-symbols-outlined">image</span>
          </button>
        </div>
        <button className="compose-mail__close-btn" onClick={onClose} title="Discard">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="compose-mail__fields">
        <div className="compose-mail__field">
          <label className="compose-mail__label">To</label>
          <input
            type="text"
            className="compose-mail__input"
            placeholder="Recipients (comma separated)"
            value={formData.toInput}
            onChange={(e) => setFormData((prev) => ({ ...prev, toInput: e.target.value }))}
          />
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
