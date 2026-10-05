import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MouseSensor, TouchSensor } from '@dnd-kit/core';
import { useDragSensors } from './useDragSensors.js';

const HOLD = { activationConstraint: { delay: 400, tolerance: 8 } };

describe('useDragSensors', () => {
  // Mouse + touch, not PointerSensor: a PointerSensor claims touches too, and a phone's pan
  // then sends pointercancel, which would cancel the drag.
  it('uses a mouse sensor and a touch sensor, both after a 400 ms hold within 8 px', () => {
    const { result } = renderHook(() => useDragSensors());

    expect(result.current.map((descriptor) => descriptor.sensor)).toEqual([MouseSensor, TouchSensor]);
    for (const descriptor of result.current) {
      expect(descriptor.options).toEqual(HOLD);
    }
  });
});
