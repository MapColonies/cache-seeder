// this import must be called before the first import of tsyringe
import 'reflect-metadata';
import { createServer } from 'http';
import { createTerminus } from '@godaddy/terminus';
import { Logger } from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import config from 'config';
import { DEFAULT_SERVER_PORT, SERVICES } from './common/constants';
import { CacheSeedManager } from './cacheSeed/cacheSeedManager';

import { getApp } from './app';

const port: number = config.get<number>('server.port') || DEFAULT_SERVER_PORT;

const app = getApp();

const logger = container.resolve<Logger>(SERVICES.LOGGER);
const stubHealthCheck = async (): Promise<void> => Promise.resolve();
const cacheSeedManager = container.resolve(CacheSeedManager);
// eslint-disable-next-line @typescript-eslint/naming-convention
const server = createTerminus(createServer(app), { healthChecks: { '/liveness': stubHealthCheck, onSignal: container.resolve('onSignal') } });

server.listen(port, () => {
  logger.info(`app started on port ${port}`);
});

const mainLoop = async (): Promise<void> => {
  const isRunning = true;
  const dequeueIntervalMs = config.get<number>('queue.dequeueIntervalMs');
  logger.info(`Start seeder worker's main polling loop`);
  //eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (isRunning) {
    try {
      const taskProcessed = await cacheSeedManager.handleCacheSeedTask();
      if (!taskProcessed) {
        await new Promise((resolve) => setTimeout(resolve, dequeueIntervalMs));
      }
    } catch (error) {
      logger.fatal(`mainLoop: Error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      await new Promise((resolve) => setTimeout(resolve, dequeueIntervalMs));
    }
  }
};

void mainLoop();
