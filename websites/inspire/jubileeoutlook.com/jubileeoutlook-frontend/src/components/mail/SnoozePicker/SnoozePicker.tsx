import React, { useState, useEffect, useCallback } from 'react';
import './SnoozePicker.css';

interface SnoozePickerProps {
  onSnooze: (snoozeUntil: Date) => void;
  onClose: () => void;
}

function addHours(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

function tomorrow9am(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function nextMonday9am(): Date {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

function nextWeek9am(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d;
}

const PRESETS = [
  { label: 'Later today', icon: 'schedule', getDate: () => addHours(3) },
  { label: 'Tomorrow', icon: 'today', getDate: tomorrow9am },
  { label: 'Next Monday', icon: 'date_range', getDate: nextMonday9am },
  { label: 'Next week', icon: 'calendar_month', getDate: nextWeek9am },
];

const SnoozePicker: React.FC<SnoozePickerProps> = ({ onSnooze, onClose }) => {
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleCustomSnooze = () => {
    if (!customDate) return;
    const [year, month, day] = customDate.split('-').map(Number);
    const [hour, minute] = customTime.split(':').map(Number);
    const d = new Date(year, month - 1, day, hour, minute);
    if (d.getTime() <= Date.now()) return;
    onSnooze(d);
  };

  return (
    <div className="snooze-picker__overlay" onClick={handleOverlayClick}>
      <div className="snooze-picker__dialog">
        <div className="snooze-picker__header">
          <span className="material-symbols-outlined">snooze</span>
          <h3 className="snooze-picker__title">Snooze until...</h3>
          <button className="snooze-picker__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="snooze-picker__presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              className="snooze-picker__preset-btn"
              onClick={() => onSnooze(preset.getDate())}
            >
              <span className="material-symbols-outlined">{preset.icon}</span>
              <span className="snooze-picker__preset-label">{preset.label}</span>
              <span className="snooze-picker__preset-time">
                {preset.getDate().toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </button>
          ))}
        </div>

        <div className="snooze-picker__divider" />

        <div className="snooze-picker__custom">
          <span className="snooze-picker__custom-label">Pick a date & time</span>
          <div className="snooze-picker__custom-row">
            <input
              type="date"
              className="snooze-picker__input"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <input
              type="time"
              className="snooze-picker__input"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
            />
            <button
              className="snooze-picker__custom-btn"
              onClick={handleCustomSnooze}
              disabled={!customDate}
            >
              Snooze
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SnoozePicker;
