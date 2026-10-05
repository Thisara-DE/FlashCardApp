import { describe, expect, it } from 'vitest';
import { ApiError } from './api/request.js';
import { createQueryClient, shouldRetryQuery } from './queryClient.js';

const apiError = (status) => new ApiError({ status, code: 'X', message: 'x' });

describe('shouldRetryQuery', () => {
  it('never retries a 404, because the thing asked for is gone', () => {
    expect(shouldRetryQuery(0, apiError(404))).toBe(false);
  });

  it('retries other failures up to 3 times', () => {
    expect(shouldRetryQuery(0, apiError(500))).toBe(true);
    expect(shouldRetryQuery(2, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetryQuery(3, apiError(500))).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('uses shouldRetryQuery for queries', () => {
    expect(createQueryClient().getDefaultOptions().queries.retry).toBe(shouldRetryQuery);
  });
});
