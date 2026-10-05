import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/request.js';

const MAX_RETRIES = 3;

// React Query retries failed loads (3 times by default, waiting 1 s, 2 s, 4 s). A 404 means the
// thing asked for is gone (e.g. the cards of a pile that was just deleted), so retrying only adds
// delay: deleting a pile would keep its dialog busy while the old pile's cards were retried.
export function shouldRetryQuery(failureCount, error) {
  if (error instanceof ApiError && error.status === 404) return false;
  return failureCount < MAX_RETRIES;
}

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery } } });
}
