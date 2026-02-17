import React, { useState } from 'react';
import { CalendarEvent } from '../../../types/calendar';
import './ReminderPopup.css';

const SNOOZE_OPTIONS = [
  { label: '5 minutes', minutes: 5 },
  { label: '10 minutes', minutes: 10 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

interface ReminderPopupProps {
  event: CalendarEvent;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
}

function getTimeUntilEvent(event: CalendarEvent): string {
  const now = new Date();
  const start = new Date(event.startDateTime);
  const diffMs = start.getTime() - now.getTime();

  if (diffMs <= 0) return 'Starting now';

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Less than a minute';
  if (diffMin === 1) return 'In 1 minute';
  if (diffMin < 60) return `In ${diffMin} minutes`;

  const diffHours = Math.floor(diffMin / 60);
  const remainingMin = diffMin % 60;
  if (diffHours === 1) return remainingMin > 0 ? `In 1 hour ${remainingMin} min` : 'In 1 hour';
  return remainingMin > 0 ? `In ${diffHours} hours ${remainingMin} min` : `In ${diffHours} hours`;
}

const ReminderPopup: React.FC<ReminderPopupProps> = ({ event, onDismiss, onSnooze }) => {
  const [snoozeMinutes, setSnoozeMinutes] = useState(5);

  const eventTime = new Date(event.startDateTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="reminder-popup">
      <div className="reminder-popup__header">
        <span className="material-symbols-outlined reminder-popup__bell">notifications_active</span>
        <span className="reminder-popup__heading">Reminder</span>
        <button className="reminder-popup__close" onClick={onDismiss}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="reminder-popup__body">
        <h4 className="reminder-popup__title">{event.isPrivate ? 'Private' : event.title}</h4>
        <div className="reminder-popup__details">
          <span className="material-symbols-outlined">schedule</span>
          <span>{eventTime} - {getTimeUntilEvent(event)}</span>
        </div>
        {event.location && (
          <div className="reminder-popup__details">
            <span className="material-symbols-outlined">location_on</span>
            <span>{event.location}</span>
          </div>
        )}
      </div>
      <div className="reminder-popup__actions">
        <div className="reminder-popup__snooze-row">
          <select
            value={snoozeMinutes}
            onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
            className="reminder-popup__snooze-select"
          >
            {SNOOZE_OPTIONS.map(opt => (
              <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>
            ))}
          </select>
          <button
            className="reminder-popup__btn reminder-popup__btn--snooze"
            onClick={() => onSnooze(snoozeMinutes)}
          >
            Snooze
          </button>
        </div>
        <button className="reminder-popup__btn reminder-popup__btn--dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ReminderPopup;
