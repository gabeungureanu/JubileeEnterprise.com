import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import CalendarRibbon from '../../components/layout/Ribbon/CalendarRibbon';
import MiniCalendar from '../../components/calendar/MiniCalendar';
import MyCalendars, { CalendarFolder } from '../../components/calendar/MyCalendars';
import CalendarGrid from '../../components/calendar/CalendarGrid';
import EventDialog from '../../components/calendar/EventDialog';
import ReminderPopup from '../../components/calendar/ReminderPopup';
import { CalendarEvent, CalendarEventDto, CalendarViewMode, CalendarDateRange } from '../../types/calendar';
import { calendarService } from '../../services/calendar/calendarService';
import { expandRecurringEvents } from '../../utils/calendarUtils';
import { reminderService, ReminderTrigger } from '../../services/calendar/reminderService';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import './CalendarPage.css';

// Simple event cache: 5-minute TTL per date-range key
const CACHE_TTL_MS = 5 * 60 * 1000;
const eventCache = new Map<string, { events: CalendarEvent[]; timestamp: number }>();

function getCacheKey(start: Date, end: Date): string {
  return `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}_${end.getFullYear()}-${end.getMonth()}-${end.getDate()}`;
}

const CalendarPage: React.FC = () => {
  const { isFolderPaneVisible } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Event dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Reminder queue — stays visible until user dismisses or snoozes each one
  const [reminderQueue, setReminderQueue] = useState<CalendarEvent[]>([]);

  // Calendar visibility filter state
  const [calendarFilters, setCalendarFilters] = useState<CalendarFolder[]>([]);

  // Calculate date range based on view mode and selected date
  const getDateRange = useCallback((date: Date, mode: CalendarViewMode): CalendarDateRange => {
    const d = new Date(date);
    switch (mode) {
      case 'day':
        return {
          start: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        };
      case 'workWeek': {
        const day = d.getDay();
        // Monday = 1, so offset to get to Monday
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const monday = new Date(d);
        monday.setDate(d.getDate() + mondayOffset);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        return {
          start: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()),
          end: new Date(friday.getFullYear(), friday.getMonth(), friday.getDate(), 23, 59, 59),
        };
      }
      case 'week': {
        const dayOfWeek = d.getDay();
        const sunday = new Date(d);
        sunday.setDate(d.getDate() - dayOfWeek);
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);
        return {
          start: new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate()),
          end: new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate(), 23, 59, 59),
        };
      }
      case 'month':
      default:
        return {
          start: new Date(d.getFullYear(), d.getMonth(), 1),
          end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
        };
    }
  }, []);

  const dateRange = getDateRange(selectedDate, viewMode);

  // Fetch events whenever date range changes (with 5-min cache)
  const fetchEvents = useCallback(async (forceRefresh = false) => {
    const range = getDateRange(selectedDate, viewMode);
    const key = getCacheKey(range.start, range.end);

    // Check cache unless forced
    if (!forceRefresh) {
      const cached = eventCache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setEvents(cached.events);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      const fetched = await calendarService.getEvents(range.start, range.end);
      const expanded = expandRecurringEvents(fetched, range.start, range.end);
      eventCache.set(key, { events: expanded, timestamp: Date.now() });
      setEvents(expanded);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      setError('Failed to load events. Please try again.');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, viewMode, getDateRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Start/stop reminder service
  useEffect(() => {
    const handleReminder = (trigger: ReminderTrigger) => {
      setReminderQueue(prev => {
        // Don't add duplicates
        if (prev.some(e => e.id === trigger.event.id)) return prev;
        return [...prev, trigger.event];
      });
    };
    reminderService.start(handleReminder);
    return () => {
      reminderService.stop();
    };
  }, []);

  // Feed events to reminder service whenever they change
  useEffect(() => {
    reminderService.updateEvents(events);
  }, [events]);

  // --- Filter pipeline: calendar visibility ---
  const filteredEvents = useMemo(() => {
    let result = events;

    // Calendar visibility filter
    const visibleCalendars = calendarFilters.filter((c) => c.isVisible).map((c) => c.name);
    if (visibleCalendars.length > 0 && visibleCalendars.length < calendarFilters.length) {
      result = result.filter((e) => {
        const calName = (e as any).calendarName || 'My Calendar';
        return visibleCalendars.includes(calName);
      });
    }

    return result;
  }, [events, calendarFilters]);

  // Reminder handlers — remove from queue only when user explicitly acts
  const handleReminderDismiss = (eventId: string) => {
    reminderService.dismiss(eventId);
    setReminderQueue(prev => prev.filter(e => e.id !== eventId));
  };

  const handleReminderSnooze = (eventId: string, minutes: number) => {
    reminderService.snooze(eventId, minutes);
    setReminderQueue(prev => prev.filter(e => e.id !== eventId));
  };

  // Navigation based on view mode
  const navigatePrevious = () => {
    const prev = new Date(selectedDate);
    switch (viewMode) {
      case 'day':
        prev.setDate(prev.getDate() - 1);
        break;
      case 'workWeek':
      case 'week':
        prev.setDate(prev.getDate() - 7);
        break;
      case 'month':
        prev.setMonth(prev.getMonth() - 1);
        break;
    }
    setSelectedDate(prev);
  };

  const navigateNext = () => {
    const next = new Date(selectedDate);
    switch (viewMode) {
      case 'day':
        next.setDate(next.getDate() + 1);
        break;
      case 'workWeek':
      case 'week':
        next.setDate(next.getDate() + 7);
        break;
      case 'month':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    setSelectedDate(next);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Format the header title based on view mode
  const getHeaderTitle = (): string => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const weekDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    switch (viewMode) {
      case 'day':
        return `${weekDayNames[selectedDate.getDay()]}, ${monthNames[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`;
      case 'workWeek':
      case 'week': {
        const range = getDateRange(selectedDate, viewMode);
        const startMonth = monthNames[range.start.getMonth()];
        const endMonth = monthNames[range.end.getMonth()];
        if (startMonth === endMonth) {
          return `${startMonth} ${range.start.getDate()} - ${range.end.getDate()}, ${range.start.getFullYear()}`;
        }
        return `${startMonth} ${range.start.getDate()} - ${endMonth} ${range.end.getDate()}, ${range.end.getFullYear()}`;
      }
      case 'month':
      default:
        return `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    }
  };

  // Event dialog handlers
  const handleNewEvent = () => {
    setEditingEvent(null);
    setIsDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsDialogOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === 'month') {
      setViewMode('day');
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingEvent(null);
  };

  const handleEventSave = async (eventData: Partial<CalendarEvent>) => {
    try {
      // Map frontend CalendarEvent fields to API DTO format
      const dto: Partial<CalendarEventDto> = {
        subject: eventData.title,
        description: eventData.description,
        location: eventData.location,
        start_time: eventData.startDateTime,
        end_time: eventData.endDateTime,
        is_all_day: eventData.isAllDay,
        is_private: eventData.isPrivate,
        is_in_person: eventData.isInPerson,
        status: eventData.showAs,
        category: eventData.category,
        event_color: eventData.eventColor,
        reminder_minutes: eventData.reminderMinutes,
        attendees: eventData.attendees,
        is_recurring: eventData.isRecurring,
        recurrence_type: eventData.recurrenceType,
        recurrence_interval: eventData.recurrenceInterval,
        recurrence_end_date: eventData.recurrenceEndDate,
        recurrence_occurrences: eventData.recurrenceOccurrences,
        recurrence_days_of_week: eventData.recurrenceDaysOfWeek,
        attachments: eventData.attachments?.map(att => ({
          fileName: att.fileName,
          fileSize: att.fileSize,
          url: att.fileUrl,
          filePath: att.fileUrl,
        })),
      };

      if (editingEvent) {
        await calendarService.updateEvent(editingEvent.id, dto);
      } else {
        await calendarService.createEvent(dto);
      }
      await fetchEvents(true);
    } catch (err) {
      console.error('Failed to save event:', err);
      setError('Failed to save event. Please try again.');
    }
  };

  const handleEventDelete = async (eventId: string) => {
    const deleted = await calendarService.deleteEvent(eventId);
    if (!deleted) {
      throw new Error('Event may not exist or was already deleted.');
    }
    // Close dialog only after successful delete
    setIsDialogOpen(false);
    setEditingEvent(null);
    await fetchEvents(true);
  };

  // Drag & drop handler
  const handleEventDrop = async (eventId: string, newStart: Date) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const originalStart = new Date(event.startDateTime);
    const originalEnd = new Date(event.endDateTime);
    const duration = originalEnd.getTime() - originalStart.getTime();
    const newEnd = new Date(newStart.getTime() + duration);

    try {
      await calendarService.updateEvent(eventId, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      });
      await fetchEvents(true);
    } catch (err) {
      console.error('Failed to move event:', err);
      setError('Failed to move event.');
    }
  };

  // Resize handler
  const handleEventResize = async (eventId: string, newEndTime: Date) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const start = new Date(event.startDateTime);
    if (newEndTime.getTime() - start.getTime() < 15 * 60 * 1000) return; // min 15 min

    try {
      await calendarService.updateEvent(eventId, {
        end_time: newEndTime.toISOString(),
      });
      await fetchEvents(true);
    } catch (err) {
      console.error('Failed to resize event:', err);
      setError('Failed to resize event.');
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewEvent: handleNewEvent,
    onToday: goToToday,
    onPrevious: navigatePrevious,
    onNext: navigateNext,
    onViewDay: () => setViewMode('day'),
    onViewWorkWeek: () => setViewMode('workWeek'),
    onViewWeek: () => setViewMode('week'),
    onViewMonth: () => setViewMode('month'),
    onFocusSearch: () => {},
    onCloseDialog: () => { if (isDialogOpen) handleDialogClose(); },
  }, !isDialogOpen || true);

  return (
    <div className="calendar-page">
      <div className="ribbon">
        <CalendarRibbon
          onNewEvent={handleNewEvent}
          onToday={goToToday}
          onViewModeChange={setViewMode}
          activeViewMode={viewMode}
        />
      </div>
      <div className="calendar-page__content">
        {isFolderPaneVisible && (
          <div className="calendar-page__sidebar">
            <MiniCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            <MyCalendars onVisibilityChange={setCalendarFilters} />
          </div>
        )}
        <div className="calendar-page__main">
          <div className="calendar-page__header">
            <div className="calendar-page__nav">
              <button className="calendar-page__nav-btn" onClick={navigatePrevious}>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button className="calendar-page__nav-btn" onClick={navigateNext}>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
              <h2 className="calendar-page__date-title">{getHeaderTitle()}</h2>
              <button className="calendar-page__today-btn" onClick={goToToday}>Today</button>
            </div>
            <div className="calendar-page__view-modes">
              {(['day', 'workWeek', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`calendar-page__view-btn ${viewMode === mode ? 'calendar-page__view-btn--active' : ''}`}
                  onClick={() => setViewMode(mode)}
                >
                  {mode === 'workWeek' ? 'Work Week' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="calendar-page__error">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          )}

          {isLoading && (
            <div className="calendar-page__loading">
              <div className="calendar-page__spinner" />
            </div>
          )}

          <CalendarGrid
            events={filteredEvents}
            viewMode={viewMode}
            dateRange={dateRange}
            selectedDate={selectedDate}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
          />
        </div>
      </div>

      <EventDialog
        isOpen={isDialogOpen}
        event={editingEvent}
        defaultDate={selectedDate}
        onClose={handleDialogClose}
        onSave={handleEventSave}
        onDelete={editingEvent ? handleEventDelete : undefined}
      />

      {reminderQueue.map((event, index) => (
        <ReminderPopup
          key={event.id}
          event={event}
          stackIndex={index}
          onDismiss={() => handleReminderDismiss(event.id)}
          onSnooze={(minutes) => handleReminderSnooze(event.id, minutes)}
        />
      ))}

    </div>
  );
};

export default CalendarPage;
