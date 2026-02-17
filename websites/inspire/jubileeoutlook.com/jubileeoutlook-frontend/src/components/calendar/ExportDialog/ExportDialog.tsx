import React, { useState } from 'react';
import { CalendarEvent } from '../../../types/calendar';
import { downloadICalFile } from '../../../utils/icalExport';
import './ExportDialog.css';

interface ExportDialogProps {
  isOpen: boolean;
  events: CalendarEvent[];
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, events, onClose }) => {
  const [format, setFormat] = useState<'ical' | 'print'>('ical');

  if (!isOpen) return null;

  const handleExport = () => {
    if (format === 'ical') {
      downloadICalFile(events);
    } else {
      window.print();
    }
    onClose();
  };

  // Count unique (non-occurrence) events
  const uniqueCount = events.filter((e) => !e.id.includes('_occ_')).length;

  return (
    <div className="export-dialog__overlay" onClick={onClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="export-dialog__header">
          <h3>Export Calendar</h3>
          <button className="export-dialog__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="export-dialog__body">
          <p className="export-dialog__info">
            {uniqueCount} event{uniqueCount !== 1 ? 's' : ''} will be exported.
          </p>

          <div className="export-dialog__options">
            <label className="export-dialog__option">
              <input
                type="radio"
                name="format"
                checked={format === 'ical'}
                onChange={() => setFormat('ical')}
              />
              <span className="material-symbols-outlined">calendar_month</span>
              <div>
                <strong>iCal (.ics)</strong>
                <span>Import into Outlook, Google Calendar, Apple Calendar</span>
              </div>
            </label>

            <label className="export-dialog__option">
              <input
                type="radio"
                name="format"
                checked={format === 'print'}
                onChange={() => setFormat('print')}
              />
              <span className="material-symbols-outlined">print</span>
              <div>
                <strong>Print / PDF</strong>
                <span>Print the current calendar view</span>
              </div>
            </label>
          </div>
        </div>

        <div className="export-dialog__footer">
          <button className="export-dialog__btn export-dialog__btn--cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="export-dialog__btn export-dialog__btn--export" onClick={handleExport}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
