import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest has no globals, so React Testing Library can't auto-clean the DOM between tests.
afterEach(cleanup);
