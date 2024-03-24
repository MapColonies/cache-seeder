import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { OperationStatus, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { asyncCallWithSpan, withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer, trace } from '@opentelemetry/api';
import { SERVICES } from '../common/constants';
import { IConfig, IJobParams, ITaskParams, ISeed } from '../common/interfaces';
import { MapproxySeed } from '../mapproxyUtils/mapproxySeed';
import { QueueClient } from '../clients/queueClient';
import { CacheType, SeedMode } from '../common/enums';
import { getSpanLinkOption } from '../common/tracing';

@singleton()
export class CacheSeedManager {
  private readonly seedAttempts: number;
  private readonly taskType: string;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
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
    let spanOptions = undefined;
    try {
      if (tilesTask.parameters.traceParentContext) {
        spanOptions = getSpanLinkOption(tilesTask.parameters.traceParentContext); // add link to trigging parent trace (overseer)
        spanOptions.attributes = {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'mapcolonies.raster.jobId': tilesTask.jobId,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'mapcolonies.raster.taskId': tilesTask.id,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'mapcolonies.raster.layerId': tilesTask.parameters.catalogId,
        };
      }
    } catch (err) {
      this.logger.warn({ msg: `No trace parent link data exists`, err: (err as Error).message });
    }
    return asyncCallWithSpan(
      async () => {
        const validCacheType = await this.isValidCacheType(tilesTask);
        if (!validCacheType) {
          return validCacheType;
        }

        const job = await this.queueClient.jobsClient.getJob<IJobParams, ITaskParams>(tilesTask.jobId);
        const { jobId, id: taskId, attempts, parameters } = tilesTask;
        const seeds = parameters.seedTasks;

        this.logger.info({
          msg: `Found new seed job: ${jobId}`,
          jobId,
          taskId,
          productId: job.resourceId,
          productVersion: job.version,
          productType: job.productType,
        });

        if (attempts > this.seedAttempts) {
          this.logger.warn({
            msg: `Reached to max attempts and will close task as failed`,
            maxServiceAttempts: this.seedAttempts,
            currentTaskAttemps: attempts,
            jobId,
            taskId,
          });
          await this.queueClient.queueHandlerForTileSeedingTasks.reject(jobId, taskId, false);
          await this.queueClient.queueHandlerForTileSeedingTasks.jobManagerClient.updateJob(jobId, { status: OperationStatus.FAILED });
          return false;
        }
        try {
          await this.runTask(seeds, jobId, taskId);
          await this.queueClient.queueHandlerForTileSeedingTasks.ack(jobId, taskId);
          await this.queueClient.queueHandlerForTileSeedingTasks.jobManagerClient.updateJob(jobId, {
            status: OperationStatus.COMPLETED,
            percentage: 100,
          });
        } catch (error) {
          await this.queueClient.queueHandlerForTileSeedingTasks.reject(jobId, taskId, true, (error as Error).message);
        }

        // complete the current pool
        return Boolean(tilesTask);
      },
      this.tracer,
      'handleCacheSeedTask',
      spanOptions
    );
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  @withSpanAsyncV4
  private async runTask(seedTasks: ISeed[], jobId: string, taskId: string): Promise<void> {
    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'mapcolonies.raster.jobId': jobId,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'mapcolonies.raster.taskId': taskId,
      // eslint-disable-next-line @typescript-eslint/naming-convention
    });
    for (const task of seedTasks) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (task.mode === SeedMode.SEED || task.mode === SeedMode.CLEAN) {
        spanActive?.setAttribute('mapcolonies.raster.jobType', task.mode);
        await this.mapproxySeed.runSeed(task, jobId, taskId);
      } else {
        this.logger.error({
          msg: `Unsupported seeding mode: ${task.mode as string}, should be one of: 'seed' or 'clean'`,
          mode: task.mode,
          layerId: task.layerId,
          jobId,
          taskId,
        });
        throw new Error(`Unsupported seeding mode: ${task.mode as string}, should be one of: 'seed' or 'clean'`);
      }
    }
  }

  private async isValidCacheType(tilesTask: ITaskResponse<ITaskParams>): Promise<boolean> {
    if (tilesTask.parameters.cacheType !== CacheType.REDIS) {
      this.logger.error({
        msg: `Unsupported cache type, only ${CacheType.REDIS} type is valid`,
        jobId: tilesTask.jobId,
        taskId: tilesTask.id,
        cacheType: tilesTask.parameters.cacheType,
      });
      const cacheType = tilesTask.parameters.cacheType;
      await this.queueClient.queueHandlerForTileSeedingTasks.reject(tilesTask.jobId, tilesTask.id, false, `Unsupported cache type ${cacheType}`);
      await this.queueClient.queueHandlerForTileSeedingTasks.jobManagerClient.updateJob(tilesTask.jobId, {
        status: OperationStatus.FAILED,
        reason: `Unsupported cache type ${cacheType}`,
      });
      return false;
    } else {
      return true;
    }
  }
}
