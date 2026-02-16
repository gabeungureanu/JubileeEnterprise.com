import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import CalendarRibbon from '../../components/layout/Ribbon/CalendarRibbon';
import MiniCalendar from '../../components/calendar/MiniCalendar';
import CalendarGrid from '../../components/calendar/CalendarGrid';
import EventDialog from '../../components/calendar/EventDialog';
import { CalendarEvent, CalendarEventDto, CalendarViewMode, CalendarDateRange } from '../../types/calendar';
import { calendarService } from '../../services/calendar/calendarService';
import './CalendarPage.css';

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

  // Fetch events whenever date range changes
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const range = getDateRange(selectedDate, viewMode);
      const fetched = await calendarService.getEvents(range.start, range.end);
      setEvents(fetched);
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
      };

      if (editingEvent) {
        await calendarService.updateEvent(editingEvent.id, dto);
      } else {
        await calendarService.createEvent(dto);
      }
      await fetchEvents();
    } catch (err) {
      console.error('Failed to save event:', err);
      setError('Failed to save event. Please try again.');
    }
  };

  const handleEventDelete = async (eventId: string) => {
    try {
      await calendarService.deleteEvent(eventId);
      await fetchEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
      setError('Failed to delete event. Please try again.');
    }
  };

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
            events={events}
            viewMode={viewMode}
            dateRange={dateRange}
            selectedDate={selectedDate}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
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
    </div>
  );
};

export default CalendarPage;
