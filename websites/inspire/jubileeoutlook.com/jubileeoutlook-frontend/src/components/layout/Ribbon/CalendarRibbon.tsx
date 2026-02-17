import React from 'react';
import { CalendarViewMode } from '../../../types/calendar';
import './Ribbon.css';

interface CalendarRibbonProps {
  onNewEvent?: () => void;
  onToday?: () => void;
  onViewModeChange?: (mode: CalendarViewMode) => void;
  activeViewMode?: CalendarViewMode;
  onExport?: () => void;
  onTemplates?: () => void;
  onShare?: () => void;
}

const CalendarRibbon: React.FC<CalendarRibbonProps> = ({
  onNewEvent,
  onToday,
  onViewModeChange,
  activeViewMode = 'month',
  onExport,
  onTemplates,
  onShare,
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

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button className="ribbon__button" title="Templates (Ctrl+T)" onClick={() => onTemplates?.()}>
          <span className="material-symbols-outlined">note_stack</span>
          <span className="ribbon__label">Templates</span>
        </button>
        <button className="ribbon__button" title="Export" onClick={() => onExport?.()}>
          <span className="material-symbols-outlined">download</span>
          <span className="ribbon__label">Export</span>
        </button>
        <button className="ribbon__button" title="Share" onClick={() => onShare?.()}>
          <span className="material-symbols-outlined">share</span>
          <span className="ribbon__label">Share</span>
        </button>
      </div>
    </div>
  );
};

export default CalendarRibbon;
