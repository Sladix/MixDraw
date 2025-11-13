import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDragNumberOptions {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  sensitivity?: number; // pixels per step
}

interface UseDragNumberReturn {
  isDragging: boolean;
  displayValue: string;
  onMouseDown: (e: React.MouseEvent) => void;
  cursorStyle: string;
}

/**
 * Hook for drag-to-edit numeric values (Blender/Unity style)
 * Drag up to increase, drag down to decrease
 * Hold shift for fine control (10x slower)
 */
export function useDragNumber({
  value,
  onChange,
  min,
  max,
  step = 0.1,
  sensitivity = 1,
}: UseDragNumberOptions): UseDragNumberReturn {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);
  const accumulatedDelta = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const deltaY = dragStartY.current - e.clientY; // Inverted (up = increase)
    const stepMultiplier = e.shiftKey ? 0.1 : 1; // Shift for fine control
    const pixelsPerStep = sensitivity;

    // Accumulate delta and convert to steps
    const totalDelta = deltaY / pixelsPerStep;
    const steps = Math.round(totalDelta / stepMultiplier);
    const newValue = dragStartValue.current + (steps * step * stepMultiplier);

    // Clamp to min/max
    const clampedValue = Math.max(min, Math.min(max, newValue));

    onChange(clampedValue);
  }, [onChange, min, max, step, sensitivity]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    accumulatedDelta.current = 0;
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = value;
    accumulatedDelta.current = 0;

    // Set cursor globally
    document.body.style.cursor = 'ns-resize';
  }, [value]);

  // Setup global listeners when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Format display value
  const displayValue = value.toFixed(
    step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0
  );

  return {
    isDragging,
    displayValue,
    onMouseDown,
    cursorStyle: isDragging ? 'ns-resize' : 'ns-resize',
  };
}
