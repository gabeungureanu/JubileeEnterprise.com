import React, { useState, useEffect } from 'react';
import './MyCalendars.css';

export interface CalendarFolder {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
}

const STORAGE_KEY = 'jubilee_calendar_filters';

const DEFAULT_CALENDARS: CalendarFolder[] = [
  { id: 'my-calendar', name: 'My Calendar', color: '#0078D4', isVisible: true },
  { id: 'work', name: 'Work', color: '#D13438', isVisible: true },
  { id: 'personal', name: 'Personal', color: '#107C10', isVisible: true },
  { id: 'holidays', name: 'Holidays', color: '#FFBD59', isVisible: false },
];

function loadCalendars(): CalendarFolder[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_CALENDARS;
}

interface MyCalendarsProps {
  onVisibilityChange?: (calendars: CalendarFolder[]) => void;
}

const MyCalendars: React.FC<MyCalendarsProps> = ({ onVisibilityChange }) => {
  const [calendars, setCalendars] = useState<CalendarFolder[]>(loadCalendars);

  // Notify parent of initial state on mount
  useEffect(() => {
    onVisibilityChange?.(calendars);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVisibility = (id: string) => {
    const updated = calendars.map((cal) =>
      cal.id === id ? { ...cal, isVisible: !cal.isVisible } : cal
    );
    setCalendars(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
    onVisibilityChange?.(updated);
  };

  return (
    <div className="my-calendars">
      <h3 className="my-calendars__heading">My Calendars</h3>
      <div className="my-calendars__list">
        {calendars.map((cal) => (
          <button
            key={cal.id}
            className="my-calendars__item"
            onClick={() => toggleVisibility(cal.id)}
          >
            <span
              className={`my-calendars__checkbox ${cal.isVisible ? 'my-calendars__checkbox--checked' : ''}`}
              style={{ borderColor: cal.color, backgroundColor: cal.isVisible ? cal.color : 'transparent' }}
            >
              {cal.isVisible && (
                <span className="material-symbols-outlined">check</span>
              )}
            </span>
            <span
              className="my-calendars__dot"
              style={{ backgroundColor: cal.color }}
            />
            <span className="my-calendars__name">{cal.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MyCalendars;
