import React, { useEffect, useRef, useState } from 'react';
import { CalendarEvent, CalendarViewMode, CalendarDateRange } from '../../../types/calendar';
import EventResizeHandle from '../EventResizeHandle/EventResizeHandle';
import './CalendarGrid.css';

interface CalendarGridProps {
  events: CalendarEvent[];
  viewMode: CalendarViewMode;
  dateRange: CalendarDateRange;
  selectedDate?: Date;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onEventDrop?: (eventId: string, newStart: Date) => void;
  onEventResize?: (eventId: string, newEndTime: Date) => void;
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

// --- Overlap detection for side-by-side event layout ---
interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
}

function detectOverlaps(events: CalendarEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];

  // Calculate positions and sort by start time
  const items = events.map((evt) => {
    const start = new Date(evt.startDateTime);
    const end = new Date(evt.endDateTime);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const duration = Math.max(endMin - startMin, 15);
    return {
      event: evt,
      startMin,
      endMin: startMin + duration,
      top: (startMin / 60) * HOUR_HEIGHT,
      height: (duration / 60) * HOUR_HEIGHT,
    };
  }).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Group overlapping events into clusters
  const clusters: typeof items[] = [];
  let currentCluster = [items[0]];

  for (let i = 1; i < items.length; i++) {
    const clusterEnd = Math.max(...currentCluster.map((c) => c.endMin));
    if (items[i].startMin < clusterEnd) {
      currentCluster.push(items[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [items[i]];
    }
  }
  clusters.push(currentCluster);

  // Assign columns within each cluster
  const result: PositionedEvent[] = [];
  for (const cluster of clusters) {
    const columns: typeof items[] = [];

    for (const item of cluster) {
      // Find first column where this event doesn't overlap
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1];
        if (item.startMin >= lastInCol.endMin) {
          columns[col].push(item);
          result.push({
            event: item.event,
            top: item.top,
            height: item.height,
            column: col,
            totalColumns: 0, // filled in below
          });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([item]);
        result.push({
          event: item.event,
          top: item.top,
          height: item.height,
          column: columns.length - 1,
          totalColumns: 0,
        });
      }
    }

    // Set totalColumns for all events in this cluster
    const totalCols = columns.length;
    for (let i = result.length - cluster.length; i < result.length; i++) {
      result[i].totalColumns = totalCols;
    }
  }

  return result;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  events,
  viewMode,
  dateRange,
  selectedDate,
  onEventClick,
  onDateClick,
  onEventDrop,
  onEventResize,
}) => {
  const timeGridRef = useRef<HTMLDivElement>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  // Tick state to re-render current time indicator every minute
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    if (viewMode === 'month') return;
    const id = setInterval(() => setTimeTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [viewMode]);

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

  // --- Drag & Drop handlers ---
  const handleDragStart = (e: React.DragEvent, evt: CalendarEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      eventId: evt.id,
      startDateTime: evt.startDateTime,
    }));
  };

  const handleDragOver = (e: React.DragEvent, colIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colIndex);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, col: Date) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!onEventDrop) return;

    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
      const { eventId } = JSON.parse(raw);
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top + (timeGridRef.current?.scrollTop || 0);
      const totalMinutes = (y / HOUR_HEIGHT) * 60;
      // Snap to 15-minute intervals
      const snapped = Math.round(totalMinutes / 15) * 15;
      const hour = Math.floor(snapped / 60);
      const minute = snapped % 60;

      const newStart = new Date(col);
      newStart.setHours(Math.min(hour, 23), minute, 0, 0);
      onEventDrop(eventId, newStart);
    } catch {
      /* ignore invalid drag data */
    }
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
                const positioned = detectOverlaps(timedEvts);

                return (
                  <div
                    key={colIndex}
                    className={`calendar-grid__time-column ${isToday ? 'calendar-grid__time-column--today' : ''} ${
                      dragOverCol === colIndex ? 'calendar-grid__time-column--drag-over' : ''
                    }`}
                    onDragOver={(e) => handleDragOver(e, colIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col)}
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

                    {/* Events with overlap column layout */}
                    {positioned.map((pos) => {
                      const columnWidth = 100 / pos.totalColumns;
                      return (
                        <div
                          key={pos.event.id}
                          className="calendar-grid__time-event"
                          draggable
                          onDragStart={(e) => handleDragStart(e, pos.event)}
                          style={{
                            top: pos.top,
                            height: pos.height,
                            left: `${pos.column * columnWidth}%`,
                            width: `${columnWidth - 1}%`,
                            backgroundColor: getEventColor(pos.event.category),
                          }}
                          onClick={(e) => { e.stopPropagation(); onEventClick(pos.event); }}
                        >
                          <span className="calendar-grid__time-event-title">
                            {pos.event.isPrivate ? 'Private' : pos.event.title}
                          </span>
                          <span className="calendar-grid__time-event-time">
                            {formatTime12h(new Date(pos.event.startDateTime))} - {formatTime12h(new Date(pos.event.endDateTime))}
                          </span>
                          {pos.event.location && (
                            <span className="calendar-grid__time-event-location">
                              {pos.event.location}
                            </span>
                          )}
                          {onEventResize && (
                            <EventResizeHandle
                              eventId={pos.event.id}
                              startDateTime={pos.event.startDateTime}
                              endDateTime={pos.event.endDateTime}
                              hourHeight={HOUR_HEIGHT}
                              onResize={onEventResize}
                            />
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
