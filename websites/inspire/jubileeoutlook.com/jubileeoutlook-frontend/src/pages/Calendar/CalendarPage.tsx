import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import MiniCalendar from '../../components/calendar/MiniCalendar';
import CalendarGrid from '../../components/calendar/CalendarGrid';
import { CalendarEvent, CalendarViewMode, CalendarDateRange } from '../../types/calendar';
import './CalendarPage.css';

const CalendarPage: React.FC = () => {
  const { isFolderPaneVisible } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [events] = useState<CalendarEvent[]>([]);

  const getMonthRange = (date: Date): CalendarDateRange => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start, end };
  };

  const dateRange = getMonthRange(selectedDate);

  const navigatePrevious = () => {
    const prev = new Date(selectedDate);
    prev.setMonth(prev.getMonth() - 1);
    setSelectedDate(prev);
  };

  const navigateNext = () => {
    const next = new Date(selectedDate);
    next.setMonth(next.getMonth() + 1);
    setSelectedDate(next);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="calendar-page">
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
            <h2 className="calendar-page__date-title">
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </h2>
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
        <CalendarGrid
          events={events}
          viewMode={viewMode}
          dateRange={dateRange}
          onEventClick={() => {}}
          onDateClick={(date) => setSelectedDate(date)}
        />
      </div>
    </div>
  );
};

export default CalendarPage;
