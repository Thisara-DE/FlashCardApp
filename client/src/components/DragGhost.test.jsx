import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DragGhost from './DragGhost.jsx';

describe('DragGhost', () => {
  it('says how many cards are being dragged', () => {
    render(<DragGhost count={2} />);

    expect(screen.getByText('2 cards')).toBeInTheDocument();
  });

  it('uses the singular for one card', () => {
    render(<DragGhost count={1} />);

    expect(screen.getByText('1 card')).toBeInTheDocument();
  });

  it('is hidden from screen readers (the move is announced after the drop instead)', () => {
    const { container } = render(<DragGhost count={2} />);

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
