import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDragNumberOptions {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  sensitivity?: number; // pixels per step
  deferred?: boolean; // Only apply changes on mouse up (for performance)
}

interface UseDragNumberReturn {
  isDragging: boolean;
  displayValue: string;
  localValue: number; // Current value during drag (may differ from actual value when deferred)
  onMouseDown: (e: React.MouseEvent) => void;
  cursorStyle: string;
  isEditing: boolean; // True when user clicked without dragging (for direct input)
  setIsEditing: (editing: boolean) => void;
  commitEdit: (value: number) => void; // Commit a manually entered value
}

const DRAG_THRESHOLD = 3; // pixels before we consider it a drag vs a click

/**
 * Hook for drag-to-edit numeric values (Blender/Unity style)
 * Drag up to increase, drag down to decrease
 * Hold shift for fine control (10x slower)
 *
 * When deferred=true, only applies changes on mouse release (better for performance)
 * Click without drag to enable direct text input
 */
export function useDragNumber({
  value,
  onChange,
  min,
  max,
  step = 0.1,
  sensitivity = 1,
  deferred = false,
}: UseDragNumberOptions): UseDragNumberReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const dragStartY = useRef(0);
  const dragStartX = useRef(0);
  const dragStartValue = useRef(0);
  const hasDragged = useRef(false);
  const mouseDownTarget = useRef<EventTarget | null>(null);

  // Sync local value with external value when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const calculateNewValue = useCallback((e: MouseEvent) => {
    const deltaY = dragStartY.current - e.clientY; // Inverted (up = increase)
    const stepMultiplier = e.shiftKey ? 0.1 : 1; // Shift for fine control
    const pixelsPerStep = sensitivity;

    const totalDelta = deltaY / pixelsPerStep;
    const steps = Math.round(totalDelta / stepMultiplier);
    const newValue = dragStartValue.current + (steps * step * stepMultiplier);

    return Math.max(min, Math.min(max, newValue));
  }, [min, max, step, sensitivity]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Check if we've exceeded the drag threshold
    const deltaX = Math.abs(e.clientX - dragStartX.current);
    const deltaY = Math.abs(e.clientY - dragStartY.current);

    if (!hasDragged.current && (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD)) {
      hasDragged.current = true;
      document.body.style.cursor = 'ns-resize';
    }

    if (!hasDragged.current) return;

    const clampedValue = calculateNewValue(e);

    if (deferred) {
      // Only update local display value, don't trigger onChange
      setLocalValue(clampedValue);
    } else {
      // Immediate mode: update on every move
      onChange(clampedValue);
    }
  }, [calculateNewValue, onChange, deferred]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (hasDragged.current) {
      // Was a drag - commit the final value if deferred
      if (deferred) {
        const finalValue = calculateNewValue(e);
        onChange(finalValue);
      }
    } else {
      // Was a click - enable direct text input mode
      setIsEditing(true);
    }

    setIsDragging(false);
    document.body.style.cursor = '';
    hasDragged.current = false;
  }, [deferred, calculateNewValue, onChange]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't intercept if already in editing mode
    if (isEditing) return;

    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartX.current = e.clientX;
    dragStartValue.current = value;
    hasDragged.current = false;
    mouseDownTarget.current = e.target;
  }, [value, isEditing]);

  const commitEdit = useCallback((newValue: number) => {
    const clamped = Math.max(min, Math.min(max, newValue));
    onChange(clamped);
    setIsEditing(false);
  }, [min, max, onChange]);

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

  // Format display value (use local value for display during deferred drag)
  const displayVal = isDragging && deferred ? localValue : value;
  const displayValue = displayVal.toFixed(
    step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0
  );

  return {
    isDragging,
    displayValue,
    localValue: isDragging && deferred ? localValue : value,
    onMouseDown,
    cursorStyle: isDragging && hasDragged.current ? 'ns-resize' : 'ns-resize',
    isEditing,
    setIsEditing,
    commitEdit,
  };
}
