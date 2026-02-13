import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MailFolder } from '../../../types/mail';
import { mailService } from '../../../services/mail/mailService';
import './FolderPane.css';

interface FolderPaneProps {
  folders: MailFolder[];
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string) => void;
  onFoldersChanged?: () => void;
  onDropMessages?: (messageIds: string[], targetFolderId: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  folder: MailFolder | null;
}

const FolderPane: React.FC<FolderPaneProps> = ({ folders, selectedFolderId, onFolderSelect, onFoldersChanged, onDropMessages }) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, folder: null });
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const getFolderIcon = (folderType: string): string => {
    switch (folderType) {
      case 'inbox': return 'inbox';
      case 'sent': return 'send';
      case 'drafts': return 'drafts';
      case 'trash': return 'delete';
      case 'archive': return 'archive';
      case 'spam': return 'report';
      case 'outbox': return 'outbox';
      default: return 'folder';
    }
  };

  const isSystemFolder = (folder: MailFolder): boolean => {
    return ['inbox', 'sent', 'drafts', 'trash', 'archive', 'spam', 'outbox'].includes(folder.folderType);
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu.visible]);

  // Focus rename input when active
  useEffect(() => {
    if (renamingFolderId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFolderId]);

  // Focus new folder input
  useEffect(() => {
    if (newFolderParentId !== null && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [newFolderParentId]);

  const handleContextMenu = useCallback((e: React.MouseEvent, folder: MailFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, folder });
  }, []);

  const handleNewFolder = useCallback(() => {
    setNewFolderParentId(contextMenu.folder?.id || '');
    setNewFolderName('');
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.folder]);

  const handleRenameStart = useCallback(() => {
    if (!contextMenu.folder) return;
    setRenamingFolderId(contextMenu.folder.id);
    setRenameValue(contextMenu.folder.displayName);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.folder]);

  const handleRenameSubmit = useCallback(async () => {
    if (!renamingFolderId || !renameValue.trim()) {
      setRenamingFolderId(null);
      return;
    }
    try {
      await mailService.renameFolder(renamingFolderId, renameValue.trim());
      onFoldersChanged?.();
    } catch { /* silently fail */ }
    setRenamingFolderId(null);
  }, [renamingFolderId, renameValue, onFoldersChanged]);

  const handleNewFolderSubmit = useCallback(async () => {
    if (!newFolderName.trim()) {
      setNewFolderParentId(null);
      return;
    }
    try {
      await mailService.createFolder(newFolderName.trim(), newFolderParentId || undefined);
      onFoldersChanged?.();
    } catch { /* silently fail */ }
    setNewFolderParentId(null);
    setNewFolderName('');
  }, [newFolderName, newFolderParentId, onFoldersChanged]);

  const handleDeleteFolder = useCallback(async () => {
    if (!contextMenu.folder) return;
    const confirmed = window.confirm(`Delete folder "${contextMenu.folder.displayName}"? Messages will be moved to Trash.`);
    if (!confirmed) {
      setContextMenu(prev => ({ ...prev, visible: false }));
      return;
    }
    try {
      await mailService.deleteFolder(contextMenu.folder.id);
      onFoldersChanged?.();
    } catch { /* silently fail */ }
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.folder, onFoldersChanged]);

  const renderFolder = (folder: MailFolder, depth: number = 0) => {
    const hasChildren = folder.childFolders && folder.childFolders.length > 0;
    const isCollapsed = collapsedGroups.has(folder.id);
    const isRenaming = renamingFolderId === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`folder-pane__item ${selectedFolderId === folder.id ? 'folder-pane__item--selected' : ''} ${dragOverFolderId === folder.id ? 'folder-pane__item--drag-over' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => !isRenaming && onFolderSelect(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, folder)}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/x-mail-ids')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverFolderId(folder.id);
            }
          }}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverFolderId(null);
            const data = e.dataTransfer.getData('application/x-mail-ids');
            if (data && onDropMessages) {
              try {
                const ids: string[] = JSON.parse(data);
                if (ids.length > 0 && folder.id !== selectedFolderId) {
                  onDropMessages(ids, folder.id);
                }
              } catch { /* invalid data */ }
            }
          }}
        >
          {hasChildren && (
            <span
              className="folder-pane__expand material-symbols-outlined"
              onClick={(e) => { e.stopPropagation(); toggleGroup(folder.id); }}
            >
              {isCollapsed ? 'chevron_right' : 'expand_more'}
            </span>
          )}
          <span className="material-symbols-outlined folder-pane__icon">
            {getFolderIcon(folder.folderType)}
          </span>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              className="folder-pane__rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setRenamingFolderId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="folder-pane__name text-ellipsis">{folder.displayName}</span>
          )}
          {!isRenaming && folder.unreadItemCount > 0 && (
            <span className="folder-pane__badge">{folder.unreadItemCount}</span>
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <div className="folder-pane__children">
            {folder.childFolders.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
        {/* New folder input appears after the folder if this is the parent */}
        {newFolderParentId === folder.id && (
          <div className="folder-pane__item folder-pane__new-folder" style={{ paddingLeft: `${12 + (depth + 1) * 16}px` }}>
            <span className="material-symbols-outlined folder-pane__icon">create_new_folder</span>
            <input
              ref={newFolderInputRef}
              className="folder-pane__rename-input"
              placeholder="New folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={handleNewFolderSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewFolderSubmit();
                if (e.key === 'Escape') { setNewFolderParentId(null); setNewFolderName(''); }
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="folder-pane">
      <div className="folder-pane__list">
        {folders.map((folder) => renderFolder(folder))}
      </div>

      {/* New folder at root level */}
      {newFolderParentId === '' && (
        <div className="folder-pane__item folder-pane__new-folder" style={{ paddingLeft: '12px' }}>
          <span className="material-symbols-outlined folder-pane__icon">create_new_folder</span>
          <input
            ref={newFolderInputRef}
            className="folder-pane__rename-input"
            placeholder="New folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={handleNewFolderSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNewFolderSubmit();
              if (e.key === 'Escape') { setNewFolderParentId(null); setNewFolderName(''); }
            }}
          />
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="folder-pane__context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="folder-pane__context-item" onClick={handleNewFolder}>
            <span className="material-symbols-outlined">create_new_folder</span>
            <span>New Folder</span>
          </button>
          {contextMenu.folder && !isSystemFolder(contextMenu.folder) && (
            <>
              <button className="folder-pane__context-item" onClick={handleRenameStart}>
                <span className="material-symbols-outlined">edit</span>
                <span>Rename</span>
              </button>
              <div className="folder-pane__context-separator" />
              <button className="folder-pane__context-item folder-pane__context-item--danger" onClick={handleDeleteFolder}>
                <span className="material-symbols-outlined">delete</span>
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FolderPane;
