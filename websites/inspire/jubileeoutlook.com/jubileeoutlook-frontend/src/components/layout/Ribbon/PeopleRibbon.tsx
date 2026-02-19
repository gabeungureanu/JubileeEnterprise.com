import React, { useState, useRef, useEffect } from 'react';
import './Ribbon.css';

interface PeopleRibbonProps {
  onNewContact?: () => void;
  onNewGroup?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onImport?: () => void;
  onExportVCard?: () => void;
  onExportCsv?: () => void;
  onBatchDelete?: () => void;
  onFavorite?: () => void;
  onEmail?: () => void;
  onChat?: () => void;
  onCall?: () => void;
  onShareVCard?: () => void;
  onCategory?: () => void;
  selectedCount?: number;
  hasSelection?: boolean;
  isInDeletedFolder?: boolean;
  onEmptyTrash?: () => void;
  onRestore?: () => void;
}

const PeopleRibbon: React.FC<PeopleRibbonProps> = ({
  onNewContact, onDelete, onEdit,
  onImport, onExportVCard,
  onBatchDelete, onFavorite,
  onEmail, onChat, onCall, onShareVCard, onCategory,
  selectedCount = 0, hasSelection = false,
  isInDeletedFolder = false, onEmptyTrash, onRestore,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  return (
    <div className="ribbon__content">
      {/* Split "New contact" button with dropdown */}
      <div className="ribbon__split-btn" ref={dropRef}>
        <button className="ribbon__split-btn-main" onClick={onNewContact} title="New contact">
          <span className="material-symbols-outlined">person_add</span>
          <span className="ribbon__split-btn-label">New contact</span>
        </button>
        <button className="ribbon__split-btn-arrow" onClick={() => setDropdownOpen(!dropdownOpen)}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
        </button>
        {dropdownOpen && (
          <div className="ribbon__dropdown">
            <button className="ribbon__dropdown-item" onClick={() => { onNewContact?.(); setDropdownOpen(false); }}>
              <span className="material-symbols-outlined">person_add</span>
              <span>New contact</span>
            </button>
            <div className="ribbon__dropdown-sep" />
            <button className="ribbon__dropdown-item" onClick={() => { onImport?.(); setDropdownOpen(false); }}>
              <span className="material-symbols-outlined">download</span>
              <span>Import contacts</span>
            </button>
            <button className="ribbon__dropdown-item" onClick={() => { onExportVCard?.(); setDropdownOpen(false); }}>
              <span className="material-symbols-outlined">upload</span>
              <span>Export contacts</span>
            </button>
          </div>
        )}
      </div>

      <div className="ribbon__separator" />

      {/* Edit + Delete */}
      <div className="ribbon__group">
        <button className="ribbon__icon-btn" onClick={onEdit} disabled={!hasSelection} title="Edit">
          <span className="material-symbols-outlined">edit</span>
        </button>
        <button className="ribbon__icon-btn" onClick={onDelete} disabled={!hasSelection} title="Delete">
          <span className="material-symbols-outlined">delete</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      {/* Email, Chat, Call, Share vCard */}
      <div className="ribbon__group">
        <button className="ribbon__icon-btn" onClick={onEmail} disabled={!hasSelection} title="Email">
          <span className="material-symbols-outlined">mail</span>
        </button>
        <button className="ribbon__icon-btn" onClick={onChat} disabled={!hasSelection} title="Chat">
          <span className="material-symbols-outlined">chat</span>
        </button>
        <button className="ribbon__icon-btn" onClick={onCall} disabled={!hasSelection} title="Call">
          <span className="material-symbols-outlined">call</span>
        </button>
        <button className="ribbon__icon-btn" onClick={onShareVCard} disabled={!hasSelection} title="Share as vCard">
          <span className="material-symbols-outlined">share</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      {/* Favorites + Category */}
      <div className="ribbon__group">
        <button className="ribbon__icon-btn" onClick={onFavorite} disabled={!hasSelection} title="Add to favorites">
          <span className="material-symbols-outlined">star</span>
        </button>
        <button className="ribbon__icon-btn" onClick={onCategory} disabled={!hasSelection} title="Add category">
          <span className="material-symbols-outlined">label</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      {/* Import + Export */}
      <div className="ribbon__group">
        <button className="ribbon__icon-btn" onClick={onImport} title="Import">
          <span className="material-symbols-outlined">download</span>
        </button>
        <button className="ribbon__icon-btn" onClick={onExportVCard} title="Export">
          <span className="material-symbols-outlined">upload</span>
        </button>
      </div>

      {/* Deleted folder actions */}
      {isInDeletedFolder && (
        <>
          <div className="ribbon__separator" />
          <div className="ribbon__group">
            <button className="ribbon__icon-btn" onClick={onEmptyTrash} title="Empty deleted folder">
              <span className="material-symbols-outlined">delete_sweep</span>
            </button>
            <button className="ribbon__icon-btn" onClick={onRestore} disabled={!hasSelection} title="Restore contact">
              <span className="material-symbols-outlined">restore_from_trash</span>
            </button>
          </div>
        </>
      )}

      {/* Bulk actions */}
      {selectedCount > 1 && (
        <>
          <div className="ribbon__separator" />
          <div className="ribbon__group">
            <span className="ribbon__selection-badge">{selectedCount} selected</span>
            <button className="ribbon__icon-btn" onClick={onBatchDelete} title="Delete selected">
              <span className="material-symbols-outlined">delete</span>
            </button>
            <button className="ribbon__icon-btn" title="Add selected to favorites">
              <span className="material-symbols-outlined">star</span>
            </button>
            <button className="ribbon__icon-btn" onClick={onExportVCard} title="Export selected">
              <span className="material-symbols-outlined">upload</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PeopleRibbon;
