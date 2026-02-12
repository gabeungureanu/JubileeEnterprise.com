import React, { useState } from 'react';
import { CalendarEvent, ShowAsStatus, ReminderOption } from '../../../types/calendar';
import { EventColor } from '../../../types/common';
import './EventDialog.css';

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
  const [showAs, setShowAs] = useState<ShowAsStatus>(event?.showAs || 'busy');
  const [reminder, setReminder] = useState<ReminderOption>(event?.reminder || '15min');
  const [category, setCategory] = useState<EventColor>(event?.category || 'blue');
  const [isPrivate, setIsPrivate] = useState(event?.isPrivate || false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ title, description, location, isAllDay, showAs, reminder, category, isPrivate });
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
              <option value="outOfOffice">Out of Office</option>
              <option value="workingElsewhere">Working Elsewhere</option>
            </select>
          </div>

          <div className="event-dialog__field">
            <span className="material-symbols-outlined">notifications</span>
            <select value={reminder} onChange={(e) => setReminder(e.target.value as ReminderOption)}>
              <option value="none">Don't remind</option>
              <option value="atTime">At time of event</option>
              <option value="5min">5 minutes before</option>
              <option value="15min">15 minutes before</option>
              <option value="30min">30 minutes before</option>
              <option value="1hour">1 hour before</option>
              <option value="1day">1 day before</option>
              <option value="1week">1 week before</option>
            </select>
          </div>

          <div className="event-dialog__field">
            <span className="material-symbols-outlined">palette</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as EventColor)}>
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
