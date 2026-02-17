import React, { useState, useEffect, useCallback } from 'react';
import { sharingService, CalendarShare } from '../../../services/calendar/sharingService';
import './SharingDialog.css';

interface SharingDialogProps {
  isOpen: boolean;
  calendarId: string;
  onClose: () => void;
}

const SharingDialog: React.FC<SharingDialogProps> = ({ isOpen, calendarId, onClose }) => {
  const [shares, setShares] = useState<CalendarShare[]>([]);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadShares = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await sharingService.getShares(calendarId);
      setShares(data);
    } finally {
      setIsLoading(false);
    }
  }, [calendarId]);

  useEffect(() => {
    if (isOpen) {
      loadShares();
    }
  }, [isOpen, loadShares]);

  const handleAddShare = async () => {
    if (!email.trim()) {
      setError('Please enter an email address.');
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    const result = await sharingService.createShare(calendarId, email, permission);
    if (result) {
      setEmail('');
      await loadShares();
    } else {
      setError('Failed to share calendar. The sharing API may not be available yet.');
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    const success = await sharingService.deleteShare(shareId);
    if (success) {
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sharing-dialog__overlay" onClick={onClose}>
      <div className="sharing-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sharing-dialog__header">
          <h3>Share Calendar</h3>
          <button className="sharing-dialog__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="sharing-dialog__body">
          <div className="sharing-dialog__add">
            <div className="sharing-dialog__add-row">
              <input
                type="email"
                className="sharing-dialog__email-input"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddShare(); }}
              />
              <select
                className="sharing-dialog__perm-select"
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
              >
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </select>
              <button className="sharing-dialog__add-btn" onClick={handleAddShare}>
                Share
              </button>
            </div>
            {error && <span className="sharing-dialog__error">{error}</span>}
          </div>

          <div className="sharing-dialog__list">
            <h4>Shared with</h4>
            {isLoading ? (
              <div className="sharing-dialog__loading">Loading...</div>
            ) : shares.length === 0 ? (
              <div className="sharing-dialog__empty">
                Not shared with anyone yet.
              </div>
            ) : (
              shares.map((share) => (
                <div key={share.id} className="sharing-dialog__share">
                  <span className="material-symbols-outlined sharing-dialog__share-icon">person</span>
                  <div className="sharing-dialog__share-info">
                    <span className="sharing-dialog__share-email">{share.sharedWithEmail}</span>
                    <span className="sharing-dialog__share-perm">
                      {share.permission === 'view' ? 'Can view' : 'Can edit'}
                    </span>
                  </div>
                  <button
                    className="sharing-dialog__remove-btn"
                    onClick={() => handleRemoveShare(share.id)}
                    title="Remove access"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharingDialog;
