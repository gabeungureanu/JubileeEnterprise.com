import React, { useState } from 'react';
import { CalendarEvent, ShowAsStatus } from '../../../types/calendar';
import { EventColor } from '../../../types/common';
import './EventDialog.css';

const REMINDER_OPTIONS: { label: string; minutes: number }[] = [
  { label: "Don't remind", minutes: -1 },
  { label: 'At time of event', minutes: 0 },
  { label: '5 minutes before', minutes: 5 },
  { label: '15 minutes before', minutes: 15 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 1440 },
  { label: '1 week before', minutes: 10080 },
];

interface EventDialogProps {
  isOpen: boolean;
  event?: CalendarEvent | null;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
}

const EventDialog: React.FC<EventDialogProps> = ({ isOpen, event, onClose, onSave }) => {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [location, setLocation] = useState(event?.location || '');
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay || false);
  const [showAs, setShowAs] = useState<ShowAsStatus>((event?.showAs as ShowAsStatus) || 'busy');
  const [reminderMinutes, setReminderMinutes] = useState(event?.reminderMinutes ?? 15);
  const [eventColor, setEventColor] = useState<EventColor>((event?.eventColor as EventColor) || 'blue');
  const [isPrivate, setIsPrivate] = useState(event?.isPrivate || false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      title,
      description,
      location,
      isAllDay,
      showAs,
      reminderMinutes,
      eventColor,
      isPrivate,
      category: eventColor,
    });
    onClose();
  };

  return (
    <div className="event-dialog__overlay" onClick={onClose}>
      <div className="event-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="event-dialog__header">
          <h3>{event ? 'Edit Event' : 'New Event'}</h3>
          <button className="event-dialog__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="event-dialog__body">
          <div className="event-dialog__field">
            <span className="material-symbols-outlined">title</span>
            <input type="text" placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="event-dialog__field">
            <span className="material-symbols-outlined">location_on</span>
            <input type="text" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="event-dialog__row">
            <label className="event-dialog__toggle">
              <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
              <span>All day</span>
            </label>
            <label className="event-dialog__toggle">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <span>Private</span>
            </label>
          </div>

          <div className="event-dialog__field">
            <span className="material-symbols-outlined">visibility</span>
            <select value={showAs} onChange={(e) => setShowAs(e.target.value as ShowAsStatus)}>
              <option value="free">Free</option>
              <option value="tentative">Tentative</option>
              <option value="busy">Busy</option>
              <option value="outofoffice">Out of Office</option>
              <option value="workingelsewhere">Working Elsewhere</option>
            </select>
          </div>

          <div className="event-dialog__field">
            <span className="material-symbols-outlined">notifications</span>
            <select
              value={String(reminderMinutes)}
              onChange={(e) => setReminderMinutes(Number(e.target.value))}
            >
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.minutes} value={String(opt.minutes)}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="event-dialog__field">
            <span className="material-symbols-outlined">palette</span>
            <select value={eventColor} onChange={(e) => setEventColor(e.target.value as EventColor)}>
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="orange">Orange</option>
              <option value="purple">Purple</option>
              <option value="red">Red</option>
              <option value="yellow">Yellow</option>
            </select>
          </div>

          <div className="event-dialog__field event-dialog__field--area">
            <span className="material-symbols-outlined">description</span>
            <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="event-dialog__footer">
          <button className="event-dialog__btn event-dialog__btn--cancel" onClick={onClose}>Cancel</button>
          <button className="event-dialog__btn event-dialog__btn--save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default EventDialog;
