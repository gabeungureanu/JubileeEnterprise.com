import React from 'react';
import { EmailMessage } from '../../../types/mail';
import './ReadingPane.css';

interface ReadingPaneProps {
  message: EmailMessage | null;
}

const ReadingPane: React.FC<ReadingPaneProps> = ({ message }) => {
  if (!message) {
    return (
      <div className="reading-pane reading-pane--empty">
        <span className="material-symbols-outlined reading-pane__empty-icon">mail</span>
        <p className="reading-pane__empty-text">Select a message to read</p>
      </div>
    );
  }

  const formatDateTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="reading-pane">
      <div className="reading-pane__header">
        <h2 className="reading-pane__subject">{message.subject}</h2>
        <div className="reading-pane__meta">
          <div className="reading-pane__sender">
            <div className="reading-pane__avatar">
              {(message.from.name || message.from.address).charAt(0).toUpperCase()}
            </div>
            <div className="reading-pane__sender-info">
              <span className="reading-pane__sender-name">{message.from.name || message.from.address}</span>
              <span className="reading-pane__sender-email">{message.from.address}</span>
            </div>
          </div>
          <span className="reading-pane__date">{formatDateTime(message.receivedDateTime)}</span>
        </div>
        <div className="reading-pane__recipients">
          <span className="reading-pane__label">To:</span>
          <span className="reading-pane__addresses">
            {message.to.map((addr) => addr.name || addr.address).join(', ')}
          </span>
        </div>
      </div>
      <div className="reading-pane__body" dangerouslySetInnerHTML={{ __html: message.body }} />
      {message.attachments.length > 0 && (
        <div className="reading-pane__attachments">
          <h4 className="reading-pane__attachments-title">
            <span className="material-symbols-outlined">attach_file</span>
            Attachments ({message.attachments.length})
          </h4>
          <div className="reading-pane__attachment-list">
            {message.attachments.map((att) => (
              <div key={att.id} className="reading-pane__attachment-card">
                <span className="material-symbols-outlined">description</span>
                <span className="reading-pane__attachment-name text-ellipsis">{att.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingPane;
