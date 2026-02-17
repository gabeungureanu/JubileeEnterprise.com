import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent, ShowAsStatus } from '../../../types/calendar';
import { EventColor } from '../../../types/common';
import './EventDialog.css';

// --- Constants matching WPF NewEventViewModel ---

const SHOW_AS_OPTIONS: { value: ShowAsStatus; label: string; color: string }[] = [
  { value: 'free', label: 'Free', color: '#FFFFFF' },
  { value: 'workingelsewhere', label: 'Working elsewhere', color: '#9370DB' },
  { value: 'tentative', label: 'Tentative', color: '#6495ED' },
  { value: 'busy', label: 'Busy', color: '#DC143C' },
  { value: 'outofoffice', label: 'Out of office', color: '#9B30FF' },
];

const REMINDER_OPTIONS: { label: string; minutes: number }[] = [
  { label: "Don't remind me", minutes: -1 },
  { label: 'At time of event', minutes: 0 },
  { label: '5 minutes before', minutes: 5 },
  { label: '15 minutes before', minutes: 15 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '12 hours before', minutes: 720 },
  { label: '1 day before', minutes: 1440 },
  { label: '1 week before', minutes: 10080 },
];

const CATEGORY_OPTIONS: { value: EventColor; label: string; color: string }[] = [
  { value: 'blue', label: 'Blue category', color: '#5B9BD5' },
  { value: 'green', label: 'Green category', color: '#70AD47' },
  { value: 'orange', label: 'Orange category', color: '#ED7D31' },
  { value: 'purple', label: 'Purple category', color: '#9966CC' },
  { value: 'red', label: 'Red category', color: '#E74856' },
  { value: 'yellow', label: 'Yellow category', color: '#FFC000' },
];

const RECURRENCE_TYPES = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
const RECURRENCE_END_OPTIONS = ['Never', 'On date', 'After occurrences'];
const DAYS_OF_WEEK = [
  { key: 'Sun', label: 'S' },
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
  { key: 'Sat', label: 'S' },
];

// Generate 48 half-hour time slots
const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    TIME_SLOTS.push(`${hh}:${mm}`);
  }
}

function formatTimeLabel(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${suffix}`;
}

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTimeFromISO(isoStr: string): string {
  const d = new Date(isoStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = d.getMinutes() < 30 ? '00' : '30';
  return `${h}:${m}`;
}

function getRecurrenceSuffix(type: string): string {
  switch (type) {
    case 'Daily': return 'day(s)';
    case 'Weekly': return 'week(s)';
    case 'Monthly': return 'month(s)';
    case 'Yearly': return 'year(s)';
    default: return 'day(s)';
  }
}

interface EventDialogProps {
  isOpen: boolean;
  event?: CalendarEvent | null;
  defaultDate?: Date;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
  onDelete?: (eventId: string) => Promise<void> | void;
}

const EventDialog: React.FC<EventDialogProps> = ({ isOpen, event, defaultDate, onClose, onSave, onDelete }) => {
  // Form state
  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:30');
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [isInPerson, setIsInPerson] = useState(true);
  const [description, setDescription] = useState('');
  const [showAs, setShowAs] = useState<ShowAsStatus>('busy');
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [eventColor, setEventColor] = useState<EventColor>('blue');
  const [isPrivate, setIsPrivate] = useState(false);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('Daily');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndOption, setRecurrenceEndOption] = useState('Never');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState(10);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const [validationError, setValidationError] = useState('');
  const previewGridRef = useRef<HTMLDivElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    if (event) {
      setTitle(event.title || '');
      setAttendees((event.attendees || []).join('; '));
      setEventDate(formatDateForInput(new Date(event.startDateTime)));
      setStartTime(getTimeFromISO(event.startDateTime));
      setEndTime(getTimeFromISO(event.endDateTime));
      setIsAllDay(event.isAllDay || false);
      setLocation(event.location || '');
      setIsInPerson(event.isInPerson ?? true);
      setDescription(event.description || '');
      setShowAs((event.showAs as ShowAsStatus) || 'busy');
      setReminderMinutes(event.reminderMinutes ?? 15);
      setEventColor((event.eventColor as EventColor) || 'blue');
      setIsPrivate(event.isPrivate || false);
      setIsRecurring(event.isRecurring || false);
      setRecurrenceType(
        event.recurrenceType
          ? event.recurrenceType.charAt(0).toUpperCase() + event.recurrenceType.slice(1)
          : 'Daily'
      );
      setRecurrenceInterval(event.recurrenceInterval || 1);
      setSelectedDays(event.recurrenceDaysOfWeek || []);
      if (event.recurrenceEndDate) {
        setRecurrenceEndOption('On date');
        setRecurrenceEndDate(formatDateForInput(new Date(event.recurrenceEndDate)));
      } else if (event.recurrenceOccurrences) {
        setRecurrenceEndOption('After occurrences');
        setRecurrenceOccurrences(event.recurrenceOccurrences);
      } else {
        setRecurrenceEndOption('Never');
      }
    } else {
      setTitle('');
      setAttendees('');
      setEventDate(formatDateForInput(defaultDate || new Date()));
      setStartTime('08:00');
      setEndTime('08:30');
      setIsAllDay(false);
      setLocation('');
      setIsInPerson(true);
      setDescription('');
      setShowAs('busy');
      setReminderMinutes(15);
      setEventColor('blue');
      setIsPrivate(false);
      setIsRecurring(false);
      setRecurrenceType('Daily');
      setRecurrenceInterval(1);
      setRecurrenceEndOption('Never');
      setRecurrenceEndDate('');
      setRecurrenceOccurrences(10);
      setSelectedDays([]);
    }
    setValidationError('');
  }, [isOpen, event, defaultDate]);

  // Auto-scroll preview to event time
  useEffect(() => {
    if (isOpen && previewGridRef.current && !isAllDay) {
      const [h] = startTime.split(':').map(Number);
      const scrollTop = Math.max(0, (h - 1) * 40);
      previewGridRef.current.scrollTop = scrollTop;
    }
  }, [isOpen, startTime, isAllDay]);

  if (!isOpen) return null;

  const isEditMode = !!event;

  // Calculate preview event position (40px per hour)
  const getPreviewTopPx = (): number => {
    const [h, m] = startTime.split(':').map(Number);
    return (h * 40) + (m / 60 * 40) + 10;
  };

  const getPreviewHeightPx = (): number => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max((diff / 60) * 40, 20);
  };

  const formatPreviewDate = (): string => {
    const d = new Date(eventDate + 'T00:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${d.getFullYear()}, ${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
  };

  const navigatePreviewDay = (offset: number) => {
    const d = new Date(eventDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    setEventDate(formatDateForInput(d));
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    if (!title.trim()) {
      setValidationError('Please add a title for your event.');
      return;
    }

    const startDateTime = isAllDay
      ? new Date(`${eventDate}T00:00:00`).toISOString()
      : new Date(`${eventDate}T${startTime}:00`).toISOString();
    const endDateTime = isAllDay
      ? new Date(`${eventDate}T23:59:59`).toISOString()
      : new Date(`${eventDate}T${endTime}:00`).toISOString();

    if (!isAllDay && endDateTime <= startDateTime) {
      setValidationError('End time must be after start time.');
      return;
    }

    const attendeeList = attendees
      .split(/[;,]/)
      .map(a => a.trim())
      .filter(a => a.length > 0);

    let finalRecurrenceEndDate: string | null = null;
    let finalRecurrenceOccurrences: number | null = null;
    if (isRecurring) {
      if (recurrenceEndOption === 'On date' && recurrenceEndDate) {
        finalRecurrenceEndDate = new Date(recurrenceEndDate + 'T23:59:59').toISOString();
      } else if (recurrenceEndOption === 'After occurrences') {
        finalRecurrenceOccurrences = recurrenceOccurrences;
      }
    }

    onSave({
      title,
      description,
      location,
      startDateTime,
      endDateTime,
      isAllDay,
      isPrivate,
      isInPerson,
      showAs,
      reminderMinutes,
      eventColor,
      category: eventColor,
      attendees: attendeeList,
      organizer: '',
      isRecurring,
      recurrenceType: isRecurring ? recurrenceType.toLowerCase() : '',
      recurrenceInterval: isRecurring ? recurrenceInterval : 0,
      recurrenceEndDate: finalRecurrenceEndDate,
      recurrenceOccurrences: finalRecurrenceOccurrences,
      recurrenceDaysOfWeek: isRecurring && recurrenceType === 'Weekly' ? selectedDays : [],
    });
    onClose();
  };

  const handleDelete = async () => {
    if (event && onDelete) {
      try {
        await onDelete(event.id);
        // Parent (CalendarPage) handles closing the dialog after successful delete
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete event.';
        setValidationError(message);
      }
    }
  };

  // Preview hours
  const previewHours = Array.from({ length: 24 }, (_, i) => {
    const suffix = i >= 12 ? 'PM' : 'AM';
    const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    return `${h12} ${suffix}`;
  });

  return (
    <div className="event-dialog__overlay" onClick={onClose}>
      <div className="event-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Title Bar */}
        <div className="event-dialog__header">
          <h3>{isEditMode ? 'Edit event' : 'New event'}</h3>
          <button className="event-dialog__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab */}
        <div className="event-dialog__tab">Event</div>

        <div className="event-dialog__content">
          {/* Left Panel - Form */}
          <div className="event-dialog__form">
            {/* Toolbar Row */}
            <div className="event-dialog__toolbar">
              <div className="event-dialog__toolbar-item">
                <select
                  value={showAs}
                  onChange={(e) => setShowAs(e.target.value as ShowAsStatus)}
                  className="event-dialog__toolbar-select"
                >
                  {SHOW_AS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="event-dialog__toolbar-item">
                <span className="material-symbols-outlined event-dialog__toolbar-icon">notifications</span>
                <select
                  value={String(reminderMinutes)}
                  onChange={(e) => setReminderMinutes(Number(e.target.value))}
                  className="event-dialog__toolbar-select"
                >
                  {REMINDER_OPTIONS.map(opt => (
                    <option key={opt.minutes} value={String(opt.minutes)}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="event-dialog__toolbar-item">
                <span
                  className="event-dialog__color-dot"
                  style={{ backgroundColor: CATEGORY_OPTIONS.find(c => c.value === eventColor)?.color || '#5B9BD5' }}
                />
                <select
                  value={eventColor}
                  onChange={(e) => setEventColor(e.target.value as EventColor)}
                  className="event-dialog__toolbar-select"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <button
                className={`event-dialog__toolbar-toggle ${isPrivate ? 'event-dialog__toolbar-toggle--active' : ''}`}
                onClick={() => setIsPrivate(!isPrivate)}
                title="Private"
              >
                <span className="material-symbols-outlined">{isPrivate ? 'lock' : 'lock_open'}</span>
                <span>Private</span>
              </button>

              <div className="event-dialog__toolbar-actions">
                <button className="event-dialog__btn event-dialog__btn--save" onClick={handleSave}>
                  Save
                </button>
                {isEditMode && onDelete && (
                  <button className="event-dialog__btn event-dialog__btn--delete" onClick={handleDelete}>
                    <span className="material-symbols-outlined">delete</span>
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="event-dialog__validation">
                <span className="material-symbols-outlined">error</span>
                {validationError}
              </div>
            )}

            {/* Form Fields */}
            <div className="event-dialog__fields">
              {/* Title */}
              <div className="event-dialog__field">
                <span className="material-symbols-outlined">event</span>
                <input
                  type="text"
                  placeholder="Add a title"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setValidationError(''); }}
                  className="event-dialog__input--title"
                  autoFocus
                />
              </div>

              {/* Attendees */}
              <div className="event-dialog__field">
                <span className="material-symbols-outlined">group</span>
                <input
                  type="text"
                  placeholder="Invite attendees"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                />
                <span className="event-dialog__optional">Optional</span>
              </div>

              {/* Date & Time */}
              <div className="event-dialog__field event-dialog__field--datetime">
                <span className="material-symbols-outlined">schedule</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="event-dialog__date-input"
                />
                {!isAllDay && (
                  <>
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="event-dialog__time-select"
                    >
                      {TIME_SLOTS.map(t => (
                        <option key={`s-${t}`} value={t}>{formatTimeLabel(t)}</option>
                      ))}
                    </select>
                    <span className="event-dialog__time-sep">to</span>
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="event-dialog__time-select"
                    >
                      {TIME_SLOTS.map(t => (
                        <option key={`e-${t}`} value={t}>{formatTimeLabel(t)}</option>
                      ))}
                    </select>
                  </>
                )}
                <label className="event-dialog__allday-toggle">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                  />
                  <span>All day</span>
                </label>
              </div>

              {/* Location */}
              <div className="event-dialog__field">
                <span className="material-symbols-outlined">location_on</span>
                <input
                  type="text"
                  placeholder="Search for a location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <label className="event-dialog__inperson-toggle">
                  <input
                    type="checkbox"
                    checked={isInPerson}
                    onChange={(e) => setIsInPerson(e.target.checked)}
                  />
                  <span>In-person</span>
                </label>
              </div>

              {/* Recurrence Toggle */}
              <div className="event-dialog__field">
                <span className="material-symbols-outlined">repeat</span>
                <button
                  className={`event-dialog__recurrence-toggle ${isRecurring ? 'event-dialog__recurrence-toggle--active' : ''}`}
                  onClick={() => setIsRecurring(!isRecurring)}
                >
                  Make recurring
                </button>
              </div>

              {/* Recurrence Options */}
              {isRecurring && (
                <div className="event-dialog__recurrence">
                  <div className="event-dialog__recurrence-row">
                    <span className="event-dialog__recurrence-label">Repeat</span>
                    <select
                      value={recurrenceType}
                      onChange={(e) => setRecurrenceType(e.target.value)}
                      className="event-dialog__recurrence-select"
                    >
                      {RECURRENCE_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="event-dialog__recurrence-row">
                    <span className="event-dialog__recurrence-label">Every</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                      className="event-dialog__recurrence-number"
                    />
                    <span className="event-dialog__recurrence-suffix">
                      {getRecurrenceSuffix(recurrenceType)}
                    </span>
                  </div>

                  {recurrenceType === 'Weekly' && (
                    <div className="event-dialog__recurrence-row">
                      <span className="event-dialog__recurrence-label">On days</span>
                      <div className="event-dialog__days-picker">
                        {DAYS_OF_WEEK.map((day, i) => (
                          <button
                            key={`${day.key}-${i}`}
                            className={`event-dialog__day-btn ${selectedDays.includes(day.key) ? 'event-dialog__day-btn--active' : ''}`}
                            onClick={() => toggleDay(day.key)}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="event-dialog__recurrence-row">
                    <span className="event-dialog__recurrence-label">Ends</span>
                    <select
                      value={recurrenceEndOption}
                      onChange={(e) => setRecurrenceEndOption(e.target.value)}
                      className="event-dialog__recurrence-select"
                    >
                      {RECURRENCE_END_OPTIONS.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  {recurrenceEndOption === 'On date' && (
                    <div className="event-dialog__recurrence-row event-dialog__recurrence-row--indent">
                      <input
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        className="event-dialog__recurrence-date"
                      />
                    </div>
                  )}

                  {recurrenceEndOption === 'After occurrences' && (
                    <div className="event-dialog__recurrence-row event-dialog__recurrence-row--indent">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={recurrenceOccurrences}
                        onChange={(e) => setRecurrenceOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                        className="event-dialog__recurrence-number"
                      />
                      <span className="event-dialog__recurrence-suffix">occurrence(s)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="event-dialog__field event-dialog__field--area">
                <span className="material-symbols-outlined">notes</span>
                <textarea
                  placeholder="Add notes, links, or attachments"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Right Panel - Calendar Preview */}
          <div className="event-dialog__preview">
            <div className="event-dialog__preview-header">
              <button
                className="event-dialog__preview-nav"
                onClick={() => navigatePreviewDay(-1)}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="event-dialog__preview-date">{formatPreviewDate()}</span>
              <button
                className="event-dialog__preview-nav"
                onClick={() => navigatePreviewDay(1)}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <div className="event-dialog__preview-grid" ref={previewGridRef}>
              <div className="event-dialog__preview-times">
                {previewHours.map((label, i) => (
                  <div key={i} className="event-dialog__preview-hour">
                    <span className="event-dialog__preview-hour-label">{label}</span>
                    <div className="event-dialog__preview-hour-line" />
                  </div>
                ))}
              </div>
              {!isAllDay && (
                <div
                  className="event-dialog__preview-event"
                  style={{
                    top: `${getPreviewTopPx()}px`,
                    height: `${getPreviewHeightPx()}px`,
                    backgroundColor: CATEGORY_OPTIONS.find(c => c.value === eventColor)?.color || '#5B9BD5',
                  }}
                >
                  <span className="event-dialog__preview-event-time">
                    {formatTimeLabel(startTime)} - {formatTimeLabel(endTime)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDialog;
