import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest has no globals, so React Testing Library can't auto-clean the DOM between tests.
afterEach(cleanup);

// jsdom doesn't implement <dialog>.showModal()/close(), so we fake the parts our code uses:
// showModal() marks the dialog open and close() closes it and fires the 'close' event.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
