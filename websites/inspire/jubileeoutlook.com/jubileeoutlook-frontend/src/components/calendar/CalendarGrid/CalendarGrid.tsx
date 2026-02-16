import React, { useEffect, useRef } from 'react';
import { CalendarEvent, CalendarViewMode, CalendarDateRange } from '../../../types/calendar';
import './CalendarGrid.css';

interface CalendarGridProps {
  events: CalendarEvent[];
  viewMode: CalendarViewMode;
  dateRange: CalendarDateRange;
  selectedDate?: Date;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
}

const HOUR_HEIGHT = 60; // px per hour (matching WPF)
const TIME_LABELS_WIDTH = 60;

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const suffix = i >= 12 ? 'PM' : 'AM';
  const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { hour24: i, label: `${h12} ${suffix}` };
});

const EVENT_COLORS: Record<string, string> = {
  blue: '#5B9BD5',
  green: '#70AD47',
  orange: '#ED7D31',
  purple: '#9966CC',
  red: '#E74856',
  yellow: '#FFC000',
};

function getEventColor(category: string): string {
  return EVENT_COLORS[category] || EVENT_COLORS.blue;
}

function getEventCssVar(category: string): string {
  const colorMap: Record<string, string> = {
    blue: 'var(--event-blue)',
    green: 'var(--event-green)',
    orange: 'var(--event-orange)',
    purple: 'var(--event-purple)',
    red: 'var(--event-red)',
    yellow: 'var(--event-yellow)',
  };
  return colorMap[category] || 'var(--event-blue)';
}

function formatTime12h(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  events,
  viewMode,
  dateRange,
  selectedDate,
  onEventClick,
  onDateClick,
}) => {
  const timeGridRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current hour on mount (for time grid views)
  useEffect(() => {
    if (viewMode !== 'month' && timeGridRef.current) {
      const now = new Date();
      const scrollTop = Math.max(0, (now.getHours() - 1) * HOUR_HEIGHT);
      timeGridRef.current.scrollTop = scrollTop;
    }
  }, [viewMode]);

  // Get events for a specific day
  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((e) => {
      const eventDate = new Date(e.startDateTime);
      return isSameDay(eventDate, day);
    });
  };

  // Get all-day events for a specific day
  const getAllDayEvents = (day: Date): CalendarEvent[] => {
    return events.filter((e) => {
      if (!e.isAllDay) return false;
      const eventDate = new Date(e.startDateTime);
      return isSameDay(eventDate, day);
    });
  };

  // Get timed events (non all-day) for a specific day
  const getTimedEvents = (day: Date): CalendarEvent[] => {
    return events.filter((e) => {
      if (e.isAllDay) return false;
      const eventDate = new Date(e.startDateTime);
      return isSameDay(eventDate, day);
    });
  };

  // Calculate event position on time grid
  const getEventPosition = (event: CalendarEvent): { top: number; height: number } => {
    const start = new Date(event.startDateTime);
    const end = new Date(event.endDateTime);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const duration = Math.max(endMinutes - startMinutes, 15); // minimum 15 min
    return {
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: (duration / 60) * HOUR_HEIGHT,
    };
  };

  // Get columns for the current view
  const getViewColumns = (): Date[] => {
    const columns: Date[] = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      columns.push(new Date(d));
    }
    return columns;
  };

  // Current time indicator position
  const getCurrentTimeTop = (): number => {
    const now = new Date();
    return ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;
  };

  // Check if today falls within the current date range
  const isTodayVisible = (): boolean => {
    const today = new Date();
    return today >= dateRange.start && today <= dateRange.end;
  };

  // Get today's column index (for week views)
  const getTodayColumnIndex = (): number => {
    const today = new Date();
    const columns = getViewColumns();
    return columns.findIndex(d => isSameDay(d, today));
  };

  // Format column header
  const formatColumnHeader = (date: Date): { dayName: string; dayNumber: string } => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return {
      dayName: days[date.getDay()],
      dayNumber: String(date.getDate()),
    };
  };

  // --- MONTH VIEW ---
  const renderMonthView = () => {
    const days: Date[] = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    const startDay = start.getDay();
    const padStart = new Date(start);
    padStart.setDate(padStart.getDate() - startDay);

    for (let d = new Date(padStart); d <= end || days.length % 7 !== 0; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="calendar-grid__month">
        <div className="calendar-grid__weekdays">
          {weekDays.map((day) => (
            <div key={day} className="calendar-grid__weekday">{day}</div>
          ))}
        </div>
        <div className="calendar-grid__days">
          {days.map((day, i) => {
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = day.getMonth() === dateRange.start.getMonth();
            const dayEvents = getEventsForDay(day);

            return (
              <div
                key={i}
                className={`calendar-grid__day ${isToday ? 'calendar-grid__day--today' : ''} ${
                  !isCurrentMonth ? 'calendar-grid__day--other' : ''
                }`}
                onClick={() => onDateClick(day)}
              >
                <span className="calendar-grid__day-number">{day.getDate()}</span>
                <div className="calendar-grid__day-events">
                  {dayEvents.slice(0, 3).map((evt) => (
                    <div
                      key={evt.id}
                      className="calendar-grid__event-chip"
                      style={{ borderLeftColor: getEventCssVar(evt.category) }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                    >
                      <span className="text-ellipsis">
                        {evt.isPrivate ? 'Private' : evt.title}
                      </span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="calendar-grid__more">+{dayEvents.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- TIME GRID VIEW (Day / Week / WorkWeek) ---
  const renderTimeGridView = () => {
    const columns = getViewColumns();
    const todayIndex = getTodayColumnIndex();

    return (
      <div className="calendar-grid__time-view">
        {/* Column headers */}
        <div className="calendar-grid__time-header">
          <div className="calendar-grid__time-gutter" />
          {columns.map((col, i) => {
            const header = formatColumnHeader(col);
            const isToday = isSameDay(col, new Date());
            return (
              <div
                key={i}
                className={`calendar-grid__col-header ${isToday ? 'calendar-grid__col-header--today' : ''}`}
                onClick={() => onDateClick(col)}
              >
                <span className="calendar-grid__col-day">{header.dayName}</span>
                <span className={`calendar-grid__col-number ${isToday ? 'calendar-grid__col-number--today' : ''}`}>
                  {header.dayNumber}
                </span>
              </div>
            );
          })}
        </div>

        {/* All-day events row */}
        {columns.some(col => getAllDayEvents(col).length > 0) && (
          <div className="calendar-grid__allday-row">
            <div className="calendar-grid__time-gutter">
              <span className="calendar-grid__allday-label">All day</span>
            </div>
            {columns.map((col, i) => {
              const allDayEvts = getAllDayEvents(col);
              return (
                <div key={i} className="calendar-grid__allday-cell">
                  {allDayEvts.map(evt => (
                    <div
                      key={evt.id}
                      className="calendar-grid__allday-event"
                      style={{ backgroundColor: getEventColor(evt.category) }}
                      onClick={() => onEventClick(evt)}
                    >
                      {evt.isPrivate ? 'Private' : evt.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Scrollable time grid */}
        <div className="calendar-grid__time-body" ref={timeGridRef}>
          <div className="calendar-grid__time-canvas">
            {/* Time labels column */}
            <div className="calendar-grid__time-labels">
              {HOURS.map(({ hour24, label }) => (
                <div key={hour24} className="calendar-grid__time-slot" style={{ height: HOUR_HEIGHT }}>
                  <span className="calendar-grid__time-label">{label}</span>
                </div>
              ))}
            </div>

            {/* Day columns with events */}
            <div className="calendar-grid__time-columns">
              {columns.map((col, colIndex) => {
                const timedEvts = getTimedEvents(col);
                const isToday = isSameDay(col, new Date());

                return (
                  <div
                    key={colIndex}
                    className={`calendar-grid__time-column ${isToday ? 'calendar-grid__time-column--today' : ''}`}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const hour = Math.floor(y / HOUR_HEIGHT);
                      const clickedDate = new Date(col);
                      clickedDate.setHours(hour, 0, 0, 0);
                      onDateClick(clickedDate);
                    }}
                  >
                    {/* Hour grid lines */}
                    {HOURS.map(({ hour24 }) => (
                      <div
                        key={hour24}
                        className="calendar-grid__hour-line"
                        style={{ top: hour24 * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Events */}
                    {timedEvts.map(evt => {
                      const pos = getEventPosition(evt);
                      return (
                        <div
                          key={evt.id}
                          className="calendar-grid__time-event"
                          style={{
                            top: pos.top,
                            height: pos.height,
                            backgroundColor: getEventColor(evt.category),
                          }}
                          onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                        >
                          <span className="calendar-grid__time-event-title">
                            {evt.isPrivate ? 'Private' : evt.title}
                          </span>
                          <span className="calendar-grid__time-event-time">
                            {formatTime12h(new Date(evt.startDateTime))} - {formatTime12h(new Date(evt.endDateTime))}
                          </span>
                          {evt.location && (
                            <span className="calendar-grid__time-event-location">
                              {evt.location}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Current time indicator */}
                    {isToday && (
                      <div
                        className="calendar-grid__current-time"
                        style={{ top: getCurrentTimeTop() }}
                      >
                        <div className="calendar-grid__current-time-dot" />
                        <div className="calendar-grid__current-time-line" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="calendar-grid">
      {viewMode === 'month' && renderMonthView()}
      {viewMode !== 'month' && renderTimeGridView()}
    </div>
  );
};

export default CalendarGrid;
