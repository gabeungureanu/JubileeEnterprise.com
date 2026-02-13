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
  currentPage?: number;
  totalCount?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkMarkRead?: (ids: string[], isRead: boolean) => void;
  onBulkMove?: (ids: string[]) => void;
  onContextAction?: (action: string, messageId: string) => void;
  sortBy?: string;
  onSortChange?: (sortBy: string) => void;
}

type SortOption = { value: string; label: string };

const SORT_OPTIONS: SortOption[] = [
  { value: 'date_desc', label: 'Date (Newest)' },
  { value: 'date_asc', label: 'Date (Oldest)' },
  { value: 'sender', label: 'Sender' },
  { value: 'subject', label: 'Subject' },
  { value: 'unread', label: 'Unread first' },
];

const MessageList: React.FC<MessageListProps> = ({
  messages, selectedMessageId, onMessageSelect, onToggleFlag, onSearch, loading, folderName,
  currentPage = 1, totalCount = 0, pageSize = 50, onPageChange,
  onBulkDelete, onBulkMarkRead, onBulkMove, onContextAction,
  sortBy = 'date_desc', onSortChange
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: string } | null>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showPagination = totalCount > pageSize;
  const bulkMode = selectedIds.size > 0;

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Debounced search
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch?.(value);
    }, 300);
  }, [onSearch]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onSearch?.(searchInput);
    }
  }, [onSearch, searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch?.('');
  }, [onSearch]);

  // Bulk select handlers
  const handleCheckboxChange = useCallback((messageId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map(m => m.id)));
    }
  }, [messages, selectedIds.size]);

  const handleBulkClear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, messageId });
  }, []);

  const handleContextAction = useCallback((action: string) => {
    if (contextMenu) {
      onContextAction?.(action, contextMenu.messageId);
    }
    setContextMenu(null);
  }, [contextMenu, onContextAction]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Close sort dropdown on click outside
  useEffect(() => {
    if (!showSortDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSortDropdown]);

  // Clear selections when messages change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [messages]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="message-list">
      <div className="message-list__header">
        <div className="message-list__header-top">
          {folderName && <div className="message-list__folder-name">{folderName}</div>}
          <div className="message-list__header-actions" ref={sortDropdownRef}>
            <button
              className="message-list__sort-btn"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              title="Sort & Filter"
            >
              <span className="material-symbols-outlined">sort</span>
            </button>
            {showSortDropdown && (
              <div className="message-list__sort-dropdown">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`message-list__sort-option ${sortBy === opt.value ? 'message-list__sort-option--active' : ''}`}
                    onClick={() => { onSortChange?.(opt.value); setShowSortDropdown(false); }}
                  >
                    {sortBy === opt.value && <span className="material-symbols-outlined">check</span>}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
            <button className="message-list__search-clear" onClick={handleClearSearch} title="Clear search">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="message-list__bulk-bar">
          <span className="message-list__bulk-count">{selectedIds.size} selected</span>
          <button className="message-list__bulk-btn" onClick={handleSelectAll} title="Select All">
            <span className="material-symbols-outlined">select_all</span>
          </button>
          <button
            className="message-list__bulk-btn"
            onClick={() => onBulkMarkRead?.(Array.from(selectedIds), true)}
            title="Mark Read"
          >
            <span className="material-symbols-outlined">mark_email_read</span>
          </button>
          <button
            className="message-list__bulk-btn"
            onClick={() => onBulkMarkRead?.(Array.from(selectedIds), false)}
            title="Mark Unread"
          >
            <span className="material-symbols-outlined">mark_email_unread</span>
          </button>
          <button
            className="message-list__bulk-btn"
            onClick={() => onBulkMove?.(Array.from(selectedIds))}
            title="Move"
          >
            <span className="material-symbols-outlined">drive_file_move</span>
          </button>
          <button
            className="message-list__bulk-btn message-list__bulk-btn--danger"
            onClick={() => onBulkDelete?.(Array.from(selectedIds))}
            title="Delete"
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
          <button className="message-list__bulk-btn" onClick={handleBulkClear} title="Clear Selection">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

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
            } ${!msg.isRead ? 'message-list__item--unread' : ''} ${
              selectedIds.has(msg.id) ? 'message-list__item--checked' : ''
            }`}
            draggable
            onDragStart={(e) => {
              const dragIds = selectedIds.size > 0 && selectedIds.has(msg.id)
                ? Array.from(selectedIds)
                : [msg.id];
              e.dataTransfer.setData('application/x-mail-ids', JSON.stringify(dragIds));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={() => onMessageSelect(msg.id)}
            onContextMenu={(e) => handleContextMenu(e, msg.id)}
          >
            <div className="message-list__item-left">
              <input
                type="checkbox"
                className="message-list__checkbox"
                checked={selectedIds.has(msg.id)}
                onChange={(e) => handleCheckboxChange(msg.id, e)}
                onClick={(e) => e.stopPropagation()}
              />
              {!msg.isRead && !selectedIds.size && <div className="message-list__unread-dot" />}
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

      {showPagination && (
        <div className="message-list__pagination">
          <button
            className="message-list__page-btn"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="message-list__page-info">
            {currentPage} of {totalPages}
          </span>
          <button
            className="message-list__page-btn"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next page"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="message-list__context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={() => handleContextAction('reply')}>
            <span className="material-symbols-outlined">reply</span> Reply
          </button>
          <button onClick={() => handleContextAction('replyAll')}>
            <span className="material-symbols-outlined">reply_all</span> Reply All
          </button>
          <button onClick={() => handleContextAction('forward')}>
            <span className="material-symbols-outlined">forward</span> Forward
          </button>
          <div className="message-list__context-divider" />
          <button onClick={() => handleContextAction('markRead')}>
            <span className="material-symbols-outlined">mark_email_read</span> Mark as Read
          </button>
          <button onClick={() => handleContextAction('markUnread')}>
            <span className="material-symbols-outlined">mark_email_unread</span> Mark as Unread
          </button>
          <button onClick={() => handleContextAction('flag')}>
            <span className="material-symbols-outlined">flag</span> Toggle Flag
          </button>
          <div className="message-list__context-divider" />
          <button onClick={() => handleContextAction('move')}>
            <span className="material-symbols-outlined">drive_file_move</span> Move to...
          </button>
          <button onClick={() => handleContextAction('archive')}>
            <span className="material-symbols-outlined">archive</span> Archive
          </button>
          <button className="message-list__context-danger" onClick={() => handleContextAction('delete')}>
            <span className="material-symbols-outlined">delete</span> Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageList;
