import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, resolvePileKey, useSelectedPile } from './useSelectedPile.js';

const data = {
  piles: [
    { id: 4, name: 'A' },
    { id: 7, name: 'B' },
  ],
  unsortedCount: 0,
};

describe('resolvePileKey', () => {
  it('keeps a stored pile that exists', () => {
    expect(resolvePileKey(7, data)).toBe(7);
  });

  it.each([99, null, 'abc', -1])('falls back to the first pile for %j', (key) => {
    expect(resolvePileKey(key, data)).toBe(4);
  });

  it('keeps unsorted only while it has cards', () => {
    expect(resolvePileKey('unsorted', { ...data, unsortedCount: 2 })).toBe('unsorted');
    expect(resolvePileKey('unsorted', data)).toBe(4);
  });

  it('returns null with no piles or no data', () => {
    expect(resolvePileKey(4, { piles: [], unsortedCount: 0 })).toBeNull();
    expect(resolvePileKey(4, undefined)).toBeNull();
  });
});

describe('useSelectedPile', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads and writes localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '7');
    const { result } = renderHook(() => useSelectedPile(data));
    expect(result.current[0]).toBe(7);

    act(() => result.current[1](4));

    expect(localStorage.getItem(STORAGE_KEY)).toBe('4');
    expect(result.current[0]).toBe(4);
  });

  it('restores the unsorted key', () => {
    localStorage.setItem(STORAGE_KEY, 'unsorted');
    const { result } = renderHook(() => useSelectedPile({ ...data, unsortedCount: 1 }));
    expect(result.current[0]).toBe('unsorted');
  });

  it('does not write the fallback back to storage', () => {
    localStorage.setItem(STORAGE_KEY, '99');
    renderHook(() => useSelectedPile(data));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('99');
  });

  it.each(['{', '-1', '1.5'])('ignores a corrupt stored value %j', (raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(renderHook(() => useSelectedPile(data)).result.current[0]).toBe(4);
  });

  it('still works when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useSelectedPile(data));
    expect(result.current[0]).toBe(4);

    act(() => result.current[1](7));

    expect(result.current[0]).toBe(7);
  });
});
