import React from 'react';
import './Ribbon.css';

const CalendarRibbon: React.FC = () => {
  return (
    <div className="ribbon__content">
      <div className="ribbon__group">
        <button className="ribbon__button ribbon__button--primary" title="New Event">
          <span className="material-symbols-outlined">add</span>
          <span className="ribbon__label">New Event</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button className="ribbon__button" title="Today">
          <span className="material-symbols-outlined">today</span>
          <span className="ribbon__label">Today</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group ribbon__view-modes">
        <button className="ribbon__button" title="Day">
          <span className="ribbon__label">Day</span>
        </button>
        <button className="ribbon__button" title="Work Week">
          <span className="ribbon__label">Work Week</span>
        </button>
        <button className="ribbon__button" title="Week">
          <span className="ribbon__label">Week</span>
        </button>
        <button className="ribbon__button" title="Month">
          <span className="ribbon__label">Month</span>
        </button>
      </div>
    </div>
  );
};

export default CalendarRibbon;
