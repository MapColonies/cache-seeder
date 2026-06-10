// this import must be called before the first import of tsyringe
import 'reflect-metadata';
import { createServer } from 'node:http';
import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import { createTerminus } from '@godaddy/terminus';
import type { Logger } from '@map-colonies/js-logger';
import { DEFAULT_SERVER_PORT, SERVICES } from './common/constants';
import { CacheSeedManager } from './cacheSeed/cacheSeedManager';
import { getApp } from './app';
import type { IConfig } from './common/interfaces';

void getApp()
  .then(([app, container]) => {
    const logger = container.resolve<Logger>(SERVICES.LOGGER);
    const config = container.resolve<IConfig>(SERVICES.CONFIG);
    const cacheSeedManager = container.resolve(CacheSeedManager);
    const port = config.get<number>('server.port') || DEFAULT_SERVER_PORT;
    const stubHealthCheck = async (): Promise<void> => Promise.resolve();
    const server = createTerminus(createServer(app), { healthChecks: { '/liveness': stubHealthCheck }, onSignal: container.resolve('onSignal') });

    server.listen(port, () => {
      logger.info(`app started on port ${port}`);
    });

    const mainLoop = async (): Promise<void> => {
      const isRunning = true;
      const dequeueIntervalMs = config.get<number>('queue.dequeueIntervalMs');
      logger.info(`Start seeder worker's main polling loop`);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (isRunning) {
        try {
          const taskProcessed = await cacheSeedManager.handleCacheSeedTask();
          if (!taskProcessed) {
            await setTimeoutPromise(dequeueIntervalMs);
          }
        } catch (err) {
          logger.fatal(`mainLoop: Error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
          await setTimeoutPromise(dequeueIntervalMs);
        }
      }
    };

    void mainLoop();
  })
  .catch((error: Error) => {
    console.error('failed initializing the worker');
    console.error(error);
    process.exit(1);
  });
