import { trace, metrics as OtelMetrics } from '@opentelemetry/api';
import { container } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { configMock, getMock, hasMock, init as initConfig } from '../mocks/config';
import { SERVICES, SERVICE_NAME } from '../../src/common/constants';
import { tracing } from '../../src/common/tracing';
import { InjectionObject } from '../../src/common/dependencyRegistration';
import { IQueueConfig } from '../../src/common/interfaces';

const queueConfig = configMock.get<IQueueConfig>('queue');
// tracing.start();
const tracer = trace.getTracer('testTracer');
function getContainerConfig(): InjectionObject<unknown>[] {
  initConfig();
  return [
    { token: SERVICES.CONFIG, provider: { useValue: configMock } },
    { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
    { token: SERVICES.QUEUE_CONFIG, provider: { useValue: queueConfig } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METER, provider: { useValue: OtelMetrics.getMeterProvider().getMeter(SERVICE_NAME) } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([tracing.stop()]);
          },
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
