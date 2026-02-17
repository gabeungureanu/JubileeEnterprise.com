import React, { useCallback, useRef, useEffect } from 'react';
import './EventResizeHandle.css';

interface EventResizeHandleProps {
  eventId: string;
  startDateTime: string;
  endDateTime: string;
  hourHeight: number;
  onResize: (eventId: string, newEndTime: Date) => void;
}

const EventResizeHandle: React.FC<EventResizeHandleProps> = ({
  eventId,
  startDateTime,
  endDateTime,
  hourHeight,
  onResize,
}) => {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const currentEnd = useRef(new Date(endDateTime));

  useEffect(() => {
    currentEnd.current = new Date(endDateTime);
  }, [endDateTime]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    startY.current = e.clientY;
    currentEnd.current = new Date(endDateTime);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [endDateTime]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const deltaY = e.clientY - startY.current;
      // Snap to 15-minute intervals
      const deltaMinutes = Math.round((deltaY / hourHeight) * 60 / 15) * 15;
      if (deltaMinutes === 0) return;

      const newEnd = new Date(currentEnd.current);
      newEnd.setMinutes(newEnd.getMinutes() + deltaMinutes);

      // Enforce minimum 15 minutes
      const start = new Date(startDateTime);
      if (newEnd.getTime() - start.getTime() >= 15 * 60 * 1000) {
        onResize(eventId, newEnd);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [eventId, startDateTime, hourHeight, onResize]);

  return (
    <div
      className="event-resize-handle"
      onMouseDown={handleMouseDown}
    />
  );
};

export default EventResizeHandle;
