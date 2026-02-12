import React, { useState, useCallback, useRef, useEffect } from 'react';
import { EmailMessage } from '../../../types/mail';
import './MessageList.css';

interface MessageListProps {
  messages: EmailMessage[];
  selectedMessageId: string | null;
  onMessageSelect: (messageId: string) => void;
  onToggleFlag?: (messageId: string, e: React.MouseEvent) => void;
  onSearch?: (query: string) => void;
  loading?: boolean;
  folderName?: string;
}

const MessageList: React.FC<MessageListProps> = ({
  messages, selectedMessageId, onMessageSelect, onToggleFlag, onSearch, loading, folderName
}) => {
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Debounced search — fires 300ms after user stops typing
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch?.(value);
    }, 300);
  }, [onSearch]);

  // Immediate search on Enter key
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onSearch?.(searchInput);
    }
  }, [onSearch, searchInput]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch?.('');
  }, [onSearch]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="message-list">
      <div className="message-list__header">
        {folderName && <div className="message-list__folder-name">{folderName}</div>}
        <div className="message-list__search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Search mail..."
            className="message-list__search-input"
            value={searchInput}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
          {searchInput && (
            <button
              className="message-list__search-clear"
              onClick={handleClearSearch}
              title="Clear search"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
      </div>
      <div className="message-list__items">
        {loading && (
          <div className="message-list__loading">
            <span className="material-symbols-outlined message-list__loading-icon">hourglass_empty</span>
            <span>Loading messages...</span>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="message-list__empty">
            <span className="material-symbols-outlined message-list__empty-icon">inbox</span>
            <span>No messages in this folder</span>
          </div>
        )}
        {!loading && messages.map((msg) => (
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
              <span
                className={`material-symbols-outlined message-list__flag ${msg.isFlagged ? 'message-list__flag--active' : 'message-list__flag--inactive'}`}
                onClick={(e) => onToggleFlag?.(msg.id, e)}
                title={msg.isFlagged ? 'Unflag' : 'Flag'}
              >
                {msg.isFlagged ? 'flag' : 'outlined_flag'}
              </span>
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
