// Thrown for any non-OK API response, so callers can branch on status/code/details.
export class ApiError extends Error {
  constructor({ status, code, message, details = {} }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// One place for the JSON header, 204 handling and error parsing.
// Network failures (fetch rejecting) are deliberately not caught: they propagate as-is.
export async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    // The body may be an HTML error page from a proxy, so parsing can fail.
    const body = await response.json().catch(() => null);
    const error = body?.error ?? {};
    throw new ApiError({
      status: response.status,
      code: error.code ?? 'UNKNOWN_ERROR',
      message: error.message ?? 'Request failed',
      details: error.details ?? {},
    });
  }

  return response.json();
}
