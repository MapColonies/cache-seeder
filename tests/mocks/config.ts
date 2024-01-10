import config from 'config';
import { IConfig } from '../../src/common/interfaces';

let keys: Record<string, unknown> = {};
const getMock = jest.fn();
const hasMock = jest.fn();

const configMock = {
  get: getMock,
  has: hasMock,
} as IConfig;

const init = (): void => {
  getMock.mockImplementation((key: string): unknown => {
    return keys[key] ?? config.get(key);
  });
};
const setValue = (key: string, value: unknown): void => {
  keys[key] = value;
};

const clear = (): void => {
  keys = {};
};
export { configMock, setValue, clear, init };
