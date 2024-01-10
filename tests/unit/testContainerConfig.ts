import config from 'config';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger from '@map-colonies/js-logger';
import { SERVICES } from '../../src/common/constants';
import { tracing } from '../../src/common/tracing';
import { InjectionObject, registerDependencies } from '../../src/common/dependencyRegistration';
import { IQueueConfig } from '../../src/common/interfaces';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const logger = jsLogger({ enabled: false });
  const queueConfig = config.get<IQueueConfig>('queue');

  tracing.start();
  const tracer = trace.getTracer('app');

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.QUEUE_CONFIG, provider: { useValue: queueConfig } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
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

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
