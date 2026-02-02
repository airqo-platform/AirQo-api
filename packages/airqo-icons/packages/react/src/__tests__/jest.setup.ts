// Jest setup file for React icon testing
import '@testing-library/jest-dom';

// Mock console warnings for cleaner test output
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('React.createRef') ||
        args[0].includes('forwardRef') ||
        args[0].includes('Invalid DOM property'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };

  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Invalid DOM property') ||
        args[0].includes('clip-path') ||
        args[0].includes('clipPath'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});
