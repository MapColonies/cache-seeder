import { Logger } from '@map-colonies/js-logger';

const logMock = jest.fn();
const logger = {
  info: logMock,
  debug: logMock,
  warn: logMock,
  error: logMock,
} as unknown as Logger;

export { logMock, logger };
