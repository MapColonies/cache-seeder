import config from 'config';
import { get, has } from 'lodash';
import { IConfig } from '../../src/common/interfaces';

let mockConfig: Record<string, unknown> = {};
const getMock = jest.fn();
const hasMock = jest.fn();

const configMock = {
  get: getMock,
  has: hasMock,
} as IConfig;

const init = (): void => {
  getMock.mockImplementation((key: string): unknown => {
    return mockConfig[key] ?? config.get(key);
  });
};

const setValue = (key: string | Record<string, unknown>, value?: unknown): void => {
  if (typeof key === 'string') {
    mockConfig[key] = value;
  } else {
    mockConfig = { ...mockConfig, ...key };
  }
};

const clear = (): void => {
  mockConfig = {};
};

const setConfigValues = (values: Record<string, unknown>): void => {
  getMock.mockImplementation((key: string) => {
    const value = get(values, key) ?? config.get(key);
    return value;
  });
  hasMock.mockImplementation((key: string) => has(values, key) || config.has(key));
};

const registerDefaultConfig = (): void => {
  const config = {
    telemetry: {
      logger: {
        level: 'info',
        prettyPrint: false,
      },
    },
    server: {
      port: '8081',
      request: {
        payload: {
          limit: '1mb',
        },
      },
      response: {
        compression: {
          enabled: true,
          options: null,
        },
      },
      httpRetry: {
        attempts: 5,
        delay: 'exponential',
        shouldResetTimeout: true,
        disableHttpClientLogs: true,
      },
    },
    queue: {
      jobManagerBaseUrl: 'http://test2',
      heartbeat: {
        heartbeatManagerBaseUrl: 'http://test1',
        heartbeatIntervalMs: 300,
      },
      dequeueIntervalMs: 1000,
      jobType: 'TilesSeeding',
      tilesTaskType: 'TilesSeeding',
    },
    mapproxy: {
      mapproxyApiUrl: 'http://localhost:8083',
      mapproxyYamlDir: '/mapproxy/mapproxy.yaml',
      seedYamlDir: '/mapproxy/seed.yaml',
      geometryTxtFile: '/mapproxy/coverage.json',
      seedProgressFileDir: '/mapproxy/mapproxy_seed_progress',
    },
    gracefulReloadMaxSeconds: 0,
    refreshBeforeYearsOffset: 1,
    seedAttempts: 5,
    servicesUrl: {
      jobTracker: 'http://localhost:8090',
    },
    invalidBboxSeedBufferMeters: 600,
  };
  setConfigValues(config);
};

export { getMock, hasMock, configMock, setValue, clear, init, setConfigValues, registerDefaultConfig };
