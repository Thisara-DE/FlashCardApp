import { useState } from 'react';

// Dragging selected cards onto a pile tab. Hand the three handlers to dnd-kit's DndContext.
//
// - onPickUp(cardId): called when a drag starts. Dragging an unselected card adds it to the
//   selection first, the same as a long press; the drag then carries the whole selection.
// - onDrop(pileId): called when the cards are dropped on another pile's tab.
export function usePileDrag({ selectedKey, isMovePending, onPickUp, onDrop }) {
  // True while cards are being dragged, to show the "N cards" ghost under the pointer.
  const [isDragging, setIsDragging] = useState(false);

  function handleDragStart({ active }) {
    setIsDragging(true);
    onPickUp(active.id);
  }

  function handleDragEnd({ over }) {
    setIsDragging(false);
    // Only the other piles' tabs are drop targets. Dropping anywhere else does nothing, and so does
    // dropping while an earlier move is still running.
    const pileId = over?.data.current?.pileId;
    if (pileId === undefined || pileId === selectedKey || isMovePending) return;
    onDrop(pileId);
  }

  function handleDragCancel() {
    setIsDragging(false);
  }

  return { isDragging, handleDragStart, handleDragEnd, handleDragCancel };
}
