import React, { useState } from 'react';
import { MailFolder } from '../../../types/mail';
import './FolderPane.css';

interface FolderPaneProps {
  folders: MailFolder[];
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string) => void;
}

const FolderPane: React.FC<FolderPaneProps> = ({ folders, selectedFolderId, onFolderSelect }) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  const renderFolder = (folder: MailFolder, depth: number = 0) => {
    const hasChildren = folder.childFolders && folder.childFolders.length > 0;
    const isCollapsed = collapsedGroups.has(folder.id);

    return (
      <div key={folder.id}>
        <div
          className={`folder-pane__item ${selectedFolderId === folder.id ? 'folder-pane__item--selected' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onFolderSelect(folder.id)}
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
          <span className="folder-pane__name text-ellipsis">{folder.displayName}</span>
          {folder.unreadItemCount > 0 && (
            <span className="folder-pane__badge">{folder.unreadItemCount}</span>
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <div className="folder-pane__children">
            {folder.childFolders.map((child) => renderFolder(child, depth + 1))}
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
    </div>
  );
};

export default FolderPane;
