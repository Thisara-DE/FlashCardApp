import { PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

// A drag starts after the same 400 ms hold (moving at most 8 px) that selects a card.
const DRAG_ACTIVATION = { activationConstraint: { delay: 400, tolerance: 8 } };

// The sensors for dragging cards onto pile tabs: mouse/pen (pointer) and touch.
// There is deliberately no keyboard sensor: Enter and Space flip a card, and Move to… is the
// keyboard path. (dnd-kit's defaults would add one and start a drag on any pointer down.)
export function useDragSensors() {
  return useSensors(useSensor(PointerSensor, DRAG_ACTIVATION), useSensor(TouchSensor, DRAG_ACTIVATION));
}
