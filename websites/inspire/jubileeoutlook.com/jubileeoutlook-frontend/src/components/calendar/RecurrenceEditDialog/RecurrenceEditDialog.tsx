import React from 'react';
import './RecurrenceEditDialog.css';

export type RecurrenceAction = 'series' | 'occurrence' | 'cancel';

interface RecurrenceEditDialogProps {
  isOpen: boolean;
  mode: 'edit' | 'delete';
  onAction: (action: RecurrenceAction) => void;
}

const RecurrenceEditDialog: React.FC<RecurrenceEditDialogProps> = ({ isOpen, mode, onAction }) => {
  if (!isOpen) return null;

  const isDelete = mode === 'delete';

  return (
    <div className="recurrence-dialog__overlay" onClick={() => onAction('cancel')}>
      <div className="recurrence-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="recurrence-dialog__icon">
          <span className="material-symbols-outlined">
            {isDelete ? 'delete' : 'edit'}
          </span>
        </div>
        <h3 className="recurrence-dialog__title">This is a recurring event</h3>
        <p className="recurrence-dialog__subtitle">
          {isDelete
            ? 'Would you like to delete just this occurrence or the entire series?'
            : 'Would you like to edit just this occurrence or the entire series?'}
        </p>
        <div className="recurrence-dialog__actions">
          <button
            className="recurrence-dialog__btn recurrence-dialog__btn--secondary"
            onClick={() => onAction('occurrence')}
          >
            {isDelete ? 'This event' : 'This event'}
          </button>
          <button
            className="recurrence-dialog__btn recurrence-dialog__btn--primary"
            onClick={() => onAction('series')}
          >
            {isDelete ? 'All events in series' : 'All events in series'}
          </button>
        </div>
        <button className="recurrence-dialog__cancel" onClick={() => onAction('cancel')}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default RecurrenceEditDialog;
