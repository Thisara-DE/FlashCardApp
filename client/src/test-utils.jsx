import PropTypes from 'prop-types';
import { DndContext } from '@dnd-kit/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { useDragSensors } from './hooks/useDragSensors.js';

// A fresh client per render keeps cache state from leaking between tests;
// retries are off so failed requests surface immediately.
// The DndContext lets components that use dnd-kit hooks (draggable cards, droppable tabs) render
// on their own, the way they do inside App.
// The providers go in `wrapper` (not around `ui`), so `rerender` keeps them.
export function renderWithClient(ui, options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Providers({ children }) {
    // App's sensors, not dnd-kit's defaults (which would start a drag on every click).
    const sensors = useDragSensors();
    return (
      <QueryClientProvider client={queryClient}>
        <DndContext sensors={sensors}>{children}</DndContext>
      </QueryClientProvider>
    );
  }

  Providers.propTypes = {
    children: PropTypes.node,
  };

  return render(ui, { ...options, wrapper: Providers });
}
