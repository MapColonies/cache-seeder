import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { SERVICES } from '../common/constants';
import { IConfig, IJobParams, ITaskSeedOptions, ITaskParams } from '../common/interfaces';
import { MapproxySeed } from '../mapproxyUtils/mapproxySeed';
import { QueueClient } from '../clients/queueClient';
import { CacheType, SeedMode } from '../common/enums';

@singleton()
export class CacheSeedManager {
  private readonly seedAttempts: number;
  private readonly taskType: string;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    private readonly queueClient: QueueClient,
    private readonly mapproxySeed: MapproxySeed
  ) {
    this.seedAttempts = this.config.get<number>('seedAttempts');
    this.taskType = this.config.get<string>('queue.tilesTaskType');
  }

  public async handleCacheSeedTask(): Promise<boolean> {
    this.logger.debug('Running search for seed jobs');
    const tilesTask = await this.queueClient.queueHandlerForTileSeedingTasks.dequeue<ITaskParams>(this.taskType);
    if (!tilesTask) {
      return Boolean(tilesTask);
    }

    if (tilesTask.parameters.cacheType !== CacheType.REDIS) {
      this.logger.error(`Unsupported cache type, only ${CacheType.REDIS} type is valid`);
      const cacheType = tilesTask.parameters.cacheType;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      await this.queueClient.queueHandlerForTileSeedingTasks.reject(tilesTask.jobId, tilesTask.id, false, `Unsupported cache type ${cacheType}`);
      await this.queueClient.queueHandlerForTileSeedingTasks.jobManagerClient.updateJob(tilesTask.jobId, {
        status: OperationStatus.FAILED,
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        reason: `Unsupported cache type ${cacheType}`,
      });
      return false;
    }
    const job = await this.queueClient.jobsClient.getJob<IJobParams, ITaskParams>(tilesTask.jobId);
    const jobId = tilesTask.jobId;
    const taskId = tilesTask.id;
    const attempts = tilesTask.attempts;
    const seeds = tilesTask.parameters.seedTasks;
    this.logger.info({
      msg: `Found new seed job: ${jobId}`,
      jobId,
      taskId,
      productId: job.resourceId,
      productVersion: job.version,
      productType: job.productType,
    });

    if (attempts <= this.seedAttempts) {
      try {
        await this.runTask(seeds);
        await this.queueClient.queueHandlerForTileSeedingTasks.ack(jobId, taskId);
        await this.queueClient.queueHandlerForTileSeedingTasks.jobManagerClient.updateJob(jobId, {
          status: OperationStatus.COMPLETED,
          percentage: 100,
        });
      } catch (error) {
        await this.queueClient.queueHandlerForTileSeedingTasks.reject(jobId, taskId, true, (error as Error).message);
      }
    } else {
      this.logger.warn({ msg: `Reached to max attempts and will close task as failed`, maxAttempts: this.seedAttempts });
      await this.queueClient.queueHandlerForTileSeedingTasks.reject(jobId, taskId, false);
      await this.queueClient.queueHandlerForTileSeedingTasks.jobManagerClient.updateJob(jobId, { status: OperationStatus.FAILED });
    }

    return Boolean(tilesTask);
  }

  private async runTask(seedTasks: ITaskSeedOptions[]): Promise<void> {
    for (const task of seedTasks) {
      if (task.mode === SeedMode.SEED) {
        await this.mapproxySeed.runSeed(task); // todo - I will consider on phase to pass other ready to run object
      } else {
        await this.mapproxySeed.runClean(task);
      }
    }
  }
}
