import React from 'react';
import { EmailMessage } from '../../../types/mail';
import './MessageList.css';

interface MessageListProps {
  messages: EmailMessage[];
  selectedMessageId: string | null;
  onMessageSelect: (messageId: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, selectedMessageId, onMessageSelect }) => {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="message-list">
      <div className="message-list__header">
        <div className="message-list__search">
          <span className="material-symbols-outlined">search</span>
          <input type="text" placeholder="Search mail..." className="message-list__search-input" />
        </div>
      </div>
      <div className="message-list__items">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-list__item ${
              selectedMessageId === msg.id ? 'message-list__item--selected' : ''
            } ${!msg.isRead ? 'message-list__item--unread' : ''}`}
            onClick={() => onMessageSelect(msg.id)}
          >
            <div className="message-list__item-left">
              {!msg.isRead && <div className="message-list__unread-dot" />}
            </div>
            <div className="message-list__item-content">
              <div className="message-list__item-header">
                <span className="message-list__sender text-ellipsis">{msg.from.name || msg.from.address}</span>
                <span className="message-list__date">{formatDate(msg.receivedAt)}</span>
              </div>
              <div className="message-list__subject text-ellipsis">{msg.subject}</div>
              <div className="message-list__preview text-ellipsis">{msg.bodyPreview}</div>
            </div>
            <div className="message-list__item-actions">
              {msg.isFlagged && (
                <span className="material-symbols-outlined message-list__flag">flag</span>
              )}
              {msg.hasAttachments && (
                <span className="material-symbols-outlined message-list__attachment">attach_file</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessageList;
