import { TaskHandler as QueueHandler, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { inject, singleton } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { IHttpRetryConfig } from '@map-colonies/mc-utils';
import { IConfig, IQueueConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@singleton()
export class QueueClient {
  public readonly queueHandlerForTileSeedingTasks: QueueHandler;
  public readonly jobsClient: JobManagerClient;

  public constructor(
    @inject(SERVICES.CONFIG) config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.QUEUE_CONFIG) private readonly queueConfig: IQueueConfig
  ) {
    this.queueHandlerForTileSeedingTasks = new QueueHandler(
      logger,
      this.queueConfig.jobType,
      this.queueConfig.jobManagerBaseUrl,
      this.queueConfig.heartbeat.heartbeatManagerBaseUrl,
      this.queueConfig.heartbeat.heartbeatIntervalMs,
      this.queueConfig.dequeueIntervalMs
    );
    this.jobsClient = new JobManagerClient(
      logger,
      this.queueConfig.jobType,
      this.queueConfig.jobManagerBaseUrl,
      config.get<IHttpRetryConfig>('server.httpRetry')
    );
  }
}
