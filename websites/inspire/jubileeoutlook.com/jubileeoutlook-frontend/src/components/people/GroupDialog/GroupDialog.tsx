import React, { useState, useEffect } from 'react';
import { ContactGroup } from '../../../types/contacts';
import './GroupDialog.css';

interface GroupDialogProps {
  isOpen: boolean;
  group?: ContactGroup | null;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}

const GroupDialog: React.FC<GroupDialogProps> = ({ isOpen, group, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(group?.name || '');
      setDescription(group?.description || '');
      setError('');
      setSaving(false);
    }
  }, [isOpen, group]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(name.trim(), description.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save group.');
      setSaving(false);
    }
  };

  return (
    <div className="group-dialog__overlay" onClick={onClose}>
      <div className="group-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="group-dialog__header">
          <h3>{group ? 'Rename Group' : 'New Group'}</h3>
          <button className="group-dialog__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="group-dialog__body">
          {error && (
            <div className="group-dialog__error">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}
          <div className="group-dialog__field">
            <label>Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              autoFocus
            />
          </div>
          <div className="group-dialog__field">
            <label>Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
            />
          </div>
        </div>
        <div className="group-dialog__footer">
          <button className="group-dialog__btn group-dialog__btn--cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="group-dialog__btn group-dialog__btn--save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupDialog;
