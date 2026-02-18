import React from 'react';
import { CalendarViewMode } from '../../../types/calendar';
import './Ribbon.css';

interface CalendarRibbonProps {
  onNewEvent?: () => void;
  onToday?: () => void;
  onViewModeChange?: (mode: CalendarViewMode) => void;
  activeViewMode?: CalendarViewMode;
}

const CalendarRibbon: React.FC<CalendarRibbonProps> = ({
  onNewEvent,
  onToday,
  onViewModeChange,
  activeViewMode = 'month',
}) => {
  return (
    <div className="ribbon__content">
      <div className="ribbon__group">
        <button className="ribbon__button ribbon__button--primary" title="New Event" onClick={() => onNewEvent?.()}>
          <span className="material-symbols-outlined">add</span>
          <span className="ribbon__label">New Event</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button className="ribbon__button" title="Today" onClick={() => onToday?.()}>
          <span className="material-symbols-outlined">today</span>
          <span className="ribbon__label">Today</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group ribbon__view-modes">
        {([
          { mode: 'day' as CalendarViewMode, label: 'Day' },
          { mode: 'workWeek' as CalendarViewMode, label: 'Work Week' },
          { mode: 'week' as CalendarViewMode, label: 'Week' },
          { mode: 'month' as CalendarViewMode, label: 'Month' },
        ]).map(({ mode, label }) => (
          <button
            key={mode}
            className={`ribbon__button ${activeViewMode === mode ? 'ribbon__button--active' : ''}`}
            title={label}
            onClick={() => onViewModeChange?.(mode)}
          >
            <span className="ribbon__label">{label}</span>
          </button>
        ))}
      </div>

    </div>
  );
};

export default CalendarRibbon;
