import React, { useState } from 'react';
import './MiniCalendar.css';

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ selectedDate, onDateSelect }) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const getDaysInMonth = (year: number, month: number): Date[] => {
    const days: Date[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();

    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push(d);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    while (days.length % 7 !== 0) {
      days.push(new Date(year, month + 1, days.length - lastDay.getDate() - startPad + 1));
    }

    return days;
  };

  const days = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  return (
    <div className="mini-calendar">
      <div className="mini-calendar__header">
        <button className="mini-calendar__nav" onClick={prevMonth}>
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <span className="mini-calendar__title">
          {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button className="mini-calendar__nav" onClick={nextMonth}>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      <div className="mini-calendar__weekdays">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="mini-calendar__weekday">{d}</span>
        ))}
      </div>
      <div className="mini-calendar__days">
        {days.map((day, i) => {
          const isToday = day.toDateString() === new Date().toDateString();
          const isSelected = day.toDateString() === selectedDate.toDateString();
          const isCurrentMonth = day.getMonth() === viewDate.getMonth();
          return (
            <button
              key={i}
              className={`mini-calendar__day ${isToday ? 'mini-calendar__day--today' : ''} ${
                isSelected ? 'mini-calendar__day--selected' : ''
              } ${!isCurrentMonth ? 'mini-calendar__day--other' : ''}`}
              onClick={() => onDateSelect(day)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MiniCalendar;
