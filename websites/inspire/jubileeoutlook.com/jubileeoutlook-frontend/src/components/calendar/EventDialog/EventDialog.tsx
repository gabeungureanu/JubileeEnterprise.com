import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent, EventAttachment, ShowAsStatus } from '../../../types/calendar';
import { EventColor } from '../../../types/common';
import { fileService } from '../../../services/calendar/fileService';

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

// Parse freeform time input: accepts "8", "8:30", "8:30 AM", "20:15", "2pm"
function parseTimeInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Pattern: "8", "8am", "8 pm"
  const hourOnly = trimmed.match(/^(\d{1,2})\s*(am|pm)?$/i);
  if (hourOnly) {
    let h = parseInt(hourOnly[1], 10);
    const mer = hourOnly[2]?.toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (h >= 0 && h < 24) return `${String(h).padStart(2, '0')}:00`;
    return null;
  }

  // Pattern: "8:30", "8:30am", "8:30 PM", "20:15"
  const full = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (full) {
    let h = parseInt(full[1], 10);
    const min = parseInt(full[2], 10);
    const mer = full[3]?.toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (h >= 0 && h < 24 && min >= 0 && min < 60) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }

  return null;
}

// Hybrid time picker: dropdown + freeform text input
const TimePicker: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const [isFreeform, setIsFreeform] = useState(false);
  const [textValue, setTextValue] = useState(value);
  const [isInvalid, setIsInvalid] = useState(false);

  useEffect(() => {
    setTextValue(value);
    setIsInvalid(false);
  }, [value]);

  const handleBlur = () => {
    const parsed = parseTimeInput(textValue);
    if (parsed) {
      setIsInvalid(false);
      onChange(parsed);
    } else {
      setIsInvalid(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
  };

  if (isFreeform) {
    return (
      <span className="event-dialog__time-picker">
        <input
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`event-dialog__time-input ${isInvalid ? 'event-dialog__time-input--error' : ''}`}
          placeholder="8:30 AM"
        />
        <button
          type="button"
          className="event-dialog__time-mode-btn"
          onClick={() => setIsFreeform(false)}
          title="Switch to dropdown"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>list</span>
        </button>
      </span>
    );
  }

  // Include current value in slots if it's a custom time not in the 30-min list
  const slots = TIME_SLOTS.includes(value) ? TIME_SLOTS : [...TIME_SLOTS, value].sort();

  return (
    <span className="event-dialog__time-picker">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="event-dialog__time-select"
      >
        {slots.map(t => (
          <option key={t} value={t}>{formatTimeLabel(t)}</option>
        ))}
      </select>
      <button
        type="button"
        className="event-dialog__time-mode-btn"
        onClick={() => setIsFreeform(true)}
        title="Type a custom time"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
      </button>
    </span>
  );
};

function formatTimeLabel(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${suffix}`;
}

const LAST_TIMES_KEY = 'jubilee_event_last_times';

function getLastUsedTimes(): { start: string; end: string } {
  try {
    const stored = localStorage.getItem(LAST_TIMES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.start && parsed.end) return parsed;
    }
  } catch { /* ignore */ }
  return { start: '08:00', end: '08:30' };
}

function saveLastUsedTimes(start: string, end: string): void {
  try {
    localStorage.setItem(LAST_TIMES_KEY, JSON.stringify({ start, end }));
  } catch { /* ignore */ }
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
  const m = String(d.getMinutes()).padStart(2, '0');
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

  // Attachment state
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<EventAttachment | null>(null);

  // Timezone state
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

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
      setAttachments(event.attachments || []);
      setTimezone(event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    } else {
      const lastTimes = getLastUsedTimes();
      setTitle('');
      setAttendees('');
      setEventDate(formatDateForInput(defaultDate || new Date()));
      setStartTime(lastTimes.start);
      setEndTime(lastTimes.end);
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
      setAttachments([]);
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
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

  // Attachment handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await fileService.uploadFile(file);
        setAttachments(prev => [...prev, attachment]);
      }
    } catch (err) {
      setValidationError('Failed to upload file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isImageFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  };

  const isPdfFile = (fileName: string): boolean => {
    return fileName.toLowerCase().endsWith('.pdf');
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = attachments.find(a => a.id === id);
    if (attachment) {
      fileService.deleteFile(attachment.fileUrl);
    }
    setAttachments(prev => prev.filter(a => a.id !== id));
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

    // Remember times for next new event
    if (!isAllDay) {
      saveLastUsedTimes(startTime, endTime);
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
      attachments,
      timezone,
    } as Partial<CalendarEvent>);
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
                    <TimePicker value={startTime} onChange={setStartTime} />
                    <span className="event-dialog__time-sep">to</span>
                    <TimePicker value={endTime} onChange={setEndTime} />
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
                  placeholder="Add notes or links"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Timezone */}
              <div className="event-dialog__field">
                <span className="material-symbols-outlined">public</span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="event-dialog__timezone-select"
                >
                  <option value="America/New_York">Eastern Time (US)</option>
                  <option value="America/Chicago">Central Time (US)</option>
                  <option value="America/Denver">Mountain Time (US)</option>
                  <option value="America/Los_Angeles">Pacific Time (US)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Paris (CET/CEST)</option>
                  <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                  <option value="Australia/Sydney">Sydney (AEST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              {/* Attachments */}
              <div className="event-dialog__field">
                <span className="material-symbols-outlined">attach_file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="event-dialog__attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Add attachment'}
                </button>
              </div>

              {attachments.length > 0 && (
                <div className="event-dialog__attachments">
                  {attachments.map(att => (
                    <div key={att.id} className="event-dialog__attachment">
                      <span className="material-symbols-outlined event-dialog__attachment-icon">
                        {fileService.getFileIcon(att.fileName)}
                      </span>
                      {att.fileUrl ? (
                        <button
                          type="button"
                          className="event-dialog__attachment-name event-dialog__attachment-link"
                          title="View attachment"
                          onClick={() => setPreviewAttachment(att)}
                        >
                          {att.fileName}
                        </button>
                      ) : (
                        <span className="event-dialog__attachment-name">{att.fileName}</span>
                      )}
                      <span className="event-dialog__attachment-size">
                        {fileService.formatFileSize(att.fileSize)}
                      </span>
                      <button
                        type="button"
                        className="event-dialog__attachment-remove"
                        onClick={() => handleRemoveAttachment(att.id)}
                        title="Remove attachment"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div className="attachment-preview__overlay" onClick={() => setPreviewAttachment(null)}>
          <div className="attachment-preview" onClick={(e) => e.stopPropagation()}>
            <div className="attachment-preview__header">
              <span className="material-symbols-outlined attachment-preview__icon">
                {fileService.getFileIcon(previewAttachment.fileName)}
              </span>
              <span className="attachment-preview__title">{previewAttachment.fileName}</span>
              <span className="attachment-preview__size">
                {fileService.formatFileSize(previewAttachment.fileSize)}
              </span>
              <a
                href={previewAttachment.fileUrl}
                download={previewAttachment.fileName}
                className="attachment-preview__download"
                title="Download"
              >
                <span className="material-symbols-outlined">download</span>
              </a>
              <button className="attachment-preview__close" onClick={() => setPreviewAttachment(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="attachment-preview__body">
              {isImageFile(previewAttachment.fileName) ? (
                <img
                  src={previewAttachment.fileUrl}
                  alt={previewAttachment.fileName}
                  className="attachment-preview__image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.querySelector('.attachment-preview__error')?.classList.add('attachment-preview__error--visible');
                  }}
                />
              ) : isPdfFile(previewAttachment.fileName) ? (
                <iframe
                  src={previewAttachment.fileUrl}
                  title={previewAttachment.fileName}
                  className="attachment-preview__pdf"
                />
              ) : (
                <div className="attachment-preview__generic">
                  <span className="material-symbols-outlined attachment-preview__generic-icon">
                    {fileService.getFileIcon(previewAttachment.fileName)}
                  </span>
                  <p>Preview not available for this file type.</p>
                </div>
              )}
              <div className="attachment-preview__error">
                <span className="material-symbols-outlined">error</span>
                <p>Unable to load file. It may have been moved or deleted.</p>
                <a
                  href={previewAttachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="attachment-preview__error-link"
                >
                  Try opening directly
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDialog;
