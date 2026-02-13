import React, { useState, useMemo } from 'react';
import { MailFolder } from '../../../types/mail';
import './MoveToFolderDialog.css';

interface MoveToFolderDialogProps {
  folders: MailFolder[];
  currentFolderId: string | null;
  onMove: (folderId: string) => void;
  onClose: () => void;
}

const MoveToFolderDialog: React.FC<MoveToFolderDialogProps> = ({
  folders, currentFolderId, onMove, onClose
}) => {
  const [filter, setFilter] = useState('');

  const flatFolders = useMemo(() => {
    const result: Array<MailFolder & { depth: number }> = [];
    const recurse = (items: MailFolder[], depth: number) => {
      for (const f of items) {
        result.push({ ...f, depth });
        if (f.childFolders?.length) recurse(f.childFolders, depth + 1);
      }
    };
    recurse(folders, 0);
    return result;
  }, [folders]);

  const filteredFolders = useMemo(() => {
    if (!filter.trim()) return flatFolders;
    const q = filter.toLowerCase();
    return flatFolders.filter(f => f.displayName.toLowerCase().includes(q));
  }, [flatFolders, filter]);

  const folderIcon = (type: string): string => {
    const icons: Record<string, string> = {
      inbox: 'inbox', sent: 'send', drafts: 'drafts',
      trash: 'delete', archive: 'archive', spam: 'report',
      outbox: 'outbox',
    };
    return icons[type] || 'folder';
  };

  return (
    <div className="move-dialog__overlay" onClick={onClose}>
      <div className="move-dialog" onClick={e => e.stopPropagation()}>
        <div className="move-dialog__header">
          <h3 className="move-dialog__title">Move to Folder</h3>
          <button className="move-dialog__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="move-dialog__search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Filter folders..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            autoFocus
          />
        </div>
        <div className="move-dialog__list">
          {filteredFolders.map(f => (
            <button
              key={f.id}
              className={`move-dialog__folder ${f.id === currentFolderId ? 'move-dialog__folder--current' : ''}`}
              style={{ paddingLeft: `${12 + f.depth * 16}px` }}
              onClick={() => f.id !== currentFolderId && onMove(f.id)}
              disabled={f.id === currentFolderId}
            >
              <span className="material-symbols-outlined">{folderIcon(f.folderType)}</span>
              <span className="move-dialog__folder-name">{f.displayName}</span>
              {f.id === currentFolderId && (
                <span className="move-dialog__current-label">Current</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MoveToFolderDialog;
