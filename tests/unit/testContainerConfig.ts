import { trace } from '@opentelemetry/api';
import { container } from 'tsyringe';
import { Registry } from 'prom-client';
import { configMock, getMock, hasMock, init as initConfig } from '../mocks/config';
import { logger } from '../mocks/logger';
import { SERVICES } from '../../src/common/constants';
import type { InjectionObject } from '../../src/common/dependencyRegistration';
import type { IQueueConfig } from '../../src/common/interfaces';

const tracer = trace.getTracer('testTracer');
function getContainerConfig(): InjectionObject<unknown>[] {
  initConfig();
  const queueConfig = configMock.get<IQueueConfig>('queue');
  return [
    { token: SERVICES.CONFIG, provider: { useValue: configMock } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.QUEUE_CONFIG, provider: { useValue: queueConfig } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METRICS, provider: { useValue: new Registry() } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => Promise.resolve(),
        },
      },
    },
  ];
}
const resetContainer = (clearInstances = true): void => {
  if (clearInstances) {
    container.clearInstances();
  }

  getMock.mockReset();
  hasMock.mockReset();
};

export { getContainerConfig, resetContainer };
