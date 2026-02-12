import React from 'react';
import { CalendarEvent } from '../../../types/calendar';
import './ReminderPopup.css';

interface ReminderPopupProps {
  event: CalendarEvent;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
}

const ReminderPopup: React.FC<ReminderPopupProps> = ({ event, onDismiss, onSnooze }) => {
  return (
    <div className="reminder-popup">
      <div className="reminder-popup__icon">
        <span className="material-symbols-outlined">notifications_active</span>
      </div>
      <div className="reminder-popup__content">
        <h4 className="reminder-popup__title">{event.title}</h4>
        <p className="reminder-popup__time">
          {new Date(event.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {event.location && ` - ${event.location}`}
        </p>
      </div>
      <div className="reminder-popup__actions">
        <button className="reminder-popup__btn" onClick={() => onSnooze(5)}>Snooze</button>
        <button className="reminder-popup__btn reminder-popup__btn--dismiss" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
};

export default ReminderPopup;
