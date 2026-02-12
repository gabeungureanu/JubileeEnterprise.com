import React, { useState } from 'react';
import { ComposeMailData } from '../../../types/mail';
import './ComposeMail.css';

interface ComposeMailProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: ComposeMailData) => void;
  initialData?: Partial<ComposeMailData>;
}

const ComposeMail: React.FC<ComposeMailProps> = ({ isOpen, onClose, onSend, initialData }) => {
  const [formData, setFormData] = useState<ComposeMailData>({
    to: initialData?.to || [],
    cc: initialData?.cc || [],
    bcc: initialData?.bcc || [],
    subject: initialData?.subject || '',
    body: initialData?.body || '',
    attachments: [],
    importance: 'normal',
    isReply: initialData?.isReply || false,
    isForward: initialData?.isForward || false,
    originalMessageId: initialData?.originalMessageId,
  });

  if (!isOpen) return null;

  const handleSend = () => {
    onSend(formData);
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
          <input type="text" className="compose-mail__input" placeholder="Recipients" />
        </div>
        <div className="compose-mail__field">
          <label className="compose-mail__label">Cc</label>
          <input type="text" className="compose-mail__input" placeholder="Cc" />
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
          value={formData.body}
          onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
        />
      </div>
    </div>
  );
};

export default ComposeMail;
