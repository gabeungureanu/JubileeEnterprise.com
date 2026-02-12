import React from 'react';
import { CalendarEvent, CalendarViewMode, CalendarDateRange } from '../../../types/calendar';
import './CalendarGrid.css';

interface CalendarGridProps {
  events: CalendarEvent[];
  viewMode: CalendarViewMode;
  dateRange: CalendarDateRange;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  events,
  viewMode,
  dateRange,
  onEventClick,
  onDateClick,
}) => {
  const getEventColor = (category: string): string => {
    const colorMap: Record<string, string> = {
      blue: 'var(--event-blue)',
      green: 'var(--event-green)',
      orange: 'var(--event-orange)',
      purple: 'var(--event-purple)',
      red: 'var(--event-red)',
      yellow: 'var(--event-yellow)',
    };
    return colorMap[category] || 'var(--event-blue)';
  };

  const renderMonthView = () => {
    const days: Date[] = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    // Pad to start of week
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
            const isToday = day.toDateString() === new Date().toDateString();
            const isCurrentMonth = day.getMonth() === dateRange.start.getMonth();
            const dayEvents = events.filter((e) => {
              const eventDate = new Date(e.startDateTime);
              return eventDate.toDateString() === day.toDateString();
            });

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
                      style={{ borderLeftColor: getEventColor(evt.category) }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                    >
                      <span className="text-ellipsis">{evt.title}</span>
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

  return (
    <div className="calendar-grid">
      {viewMode === 'month' && renderMonthView()}
      {(viewMode === 'day' || viewMode === 'week' || viewMode === 'workWeek') && (
        <div className="calendar-grid__placeholder">
          <span className="material-symbols-outlined">calendar_view_{viewMode === 'day' ? 'day' : 'week'}</span>
          <p>{viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} view</p>
        </div>
      )}
    </div>
  );
};

export default CalendarGrid;
