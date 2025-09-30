import { setTimeout as setTimeoutPromise } from 'timers/promises';
import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { ITaskResponse } from '@map-colonies/mc-priority-queue';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { INFRA_CONVENTIONS, RASTER_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { SpanOptions, SpanStatusCode, Tracer, trace } from '@opentelemetry/api';
import { SERVICES } from '../common/constants';
import { IConfig, IJobParams, ITaskParams, ISeed } from '../common/interfaces';
import { MapproxySeed } from '../mapproxyUtils/mapproxySeed';
import { QueueClient } from '../clients/queueClient';
import { CacheType, SeedMode } from '../common/enums';
import { getSpanLinkOption } from '../common/tracing';
import { JobTrackerClient } from '../clients/jobTrackerClient';
import { ExceededMaxRetriesError } from '../common/errors';

@singleton()
export class CacheSeedManager {
  private readonly seedAttempts: number;
  private readonly jobType: string;
  private readonly taskType: string;
  private readonly msToSeconds: number;
  private readonly gracefulReloadMaxSeconds: number;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly queueClient: QueueClient,
    private readonly mapproxySeed: MapproxySeed,
    private readonly jobTrackerClient: JobTrackerClient
  ) {
    this.seedAttempts = this.config.get<number>('seedAttempts');
    this.jobType = this.config.get<string>('queue.jobType');
    this.taskType = this.config.get<string>('queue.tilesTaskType');
    this.gracefulReloadMaxSeconds = this.config.get<number>('gracefulReloadMaxSeconds');
    this.msToSeconds = 1000;
  }

  public async handleCacheSeedTask(): Promise<boolean> {
    this.logger.debug('Running search for seed jobs');
    const tilesTask = await this.queueClient.queueHandlerForTileSeedingTasks.dequeue<ITaskParams>(this.jobType, this.taskType);
    if (!tilesTask) {
      return Boolean(tilesTask);
    }

    const spanOptions = this.getInitialSpanOption(tilesTask);
    return this.tracer.startActiveSpan('handleCacheSeedTask', spanOptions, async (span) => {
      try {
        const shouldNotWait = await this.run(tilesTask);
        span.setStatus({ code: shouldNotWait ? SpanStatusCode.OK : SpanStatusCode.ERROR });
        return shouldNotWait;
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.recordException(err as Error);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  public async delay(seconds: number): Promise<void> {
    this.logger.info(`waiting before executing by gracefulReloadRandomSeconds delay for - ${seconds} - seconds `);
    await setTimeoutPromise(seconds * this.msToSeconds);
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  @withSpanAsyncV4
  private async runTask(seedTasks: ISeed[], jobId: string, taskId: string): Promise<void> {
    const spanActive = trace.getActiveSpan();

    spanActive?.setAttributes({
      [INFRA_CONVENTIONS.infra.jobManagement.jobId]: jobId,
      [INFRA_CONVENTIONS.infra.jobManagement.taskId]: taskId,
    });
    for (const task of seedTasks) {
      const logObj = { mode: task.mode, layerId: task.layerId, jobId, taskId };
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (task.mode === SeedMode.SEED || task.mode === SeedMode.CLEAN) {
        spanActive?.setAttribute(RASTER_CONVENTIONS.raster.cacheSeeder.seedMode, task.mode);
        spanActive?.addEvent('seedTask', logObj);
        await this.mapproxySeed.runSeed(task, jobId, taskId);
      } else {
        const logErrMsg = `Unsupported seeding mode: ${task.mode as string}, should be one of: 'seed' or 'clean'`;
        this.logger.error(logObj, logErrMsg);
        throw new Error(logErrMsg);
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
      await this.jobTrackerClient.notify(tilesTask.id);
      return false;
    } else {
      return true;
    }
  }

  /**
   * This function parse seedTask and generate SpanOption object to be passed, attach Link object to Span parent if exists, and metadata attributes
   * @param tilesTask seed task to be executed
   * @returns SpanOption object with attributes and optional links array
   */
  private getInitialSpanOption(tilesTask: ITaskResponse<ITaskParams>): SpanOptions {
    const spanOptions: SpanOptions = {
      attributes: {
        [INFRA_CONVENTIONS.infra.jobManagement.jobId]: tilesTask.jobId,
        [INFRA_CONVENTIONS.infra.jobManagement.taskId]: tilesTask.id,
        [RASTER_CONVENTIONS.raster.mapproxyApi.cacheName]: tilesTask.parameters.seedTasks[0].layerId,
        [RASTER_CONVENTIONS.raster.catalogManager.catalogId]: tilesTask.parameters.catalogId,
      },
    };
    try {
      if (tilesTask.parameters.traceParentContext) {
        const spanLinks = getSpanLinkOption(tilesTask.parameters.traceParentContext); // add link to trigging parent trace (overseer)
        spanOptions.links = spanLinks;
      }
    } catch (err) {
      const logWarnMsg = `No trace parent link data exists`;
      const logObj = { jobId: tilesTask.jobId, taskId: tilesTask.id, layerId: tilesTask.parameters.catalogId, err };
      this.logger.warn({ ...logObj, msg: logWarnMsg });
    }
    return spanOptions;
  }

  private async run(tilesTask: ITaskResponse<ITaskParams>): Promise<boolean> {
    const validCacheType = await this.isValidCacheType(tilesTask);
    if (!validCacheType) {
      return validCacheType;
    }

    const job = await this.queueClient.jobsClient.getJob<IJobParams, ITaskParams>(tilesTask.jobId);
    const { jobId, id: taskId, attempts, parameters } = tilesTask;
    const seeds = parameters.seedTasks;

    const logInfoMsg = `Found new seed job: ${jobId}`;
    const logObj = { jobId, taskId, productId: job.resourceId, productVersion: job.version, productType: job.productType };

    this.logger.info({ ...logObj, msg: logInfoMsg });
    trace.getActiveSpan()?.addEvent(logInfoMsg, logObj);

    if (attempts > this.seedAttempts) {
      const logWarnMsg = `Reached to max attempts and will close task as failed`;
      const logWarnObj = { maxServiceAttempts: this.seedAttempts, currentTaskAttemps: attempts, jobId, taskId };
      this.logger.warn(logWarnObj, logWarnMsg);
      trace.getActiveSpan()?.addEvent(logWarnMsg, logWarnObj);

      await this.queueClient.queueHandlerForTileSeedingTasks.reject(jobId, taskId, false);
      await this.jobTrackerClient.notify(taskId);
      return false;
    }

    try {
      await this.delay(this.gracefulReloadMaxSeconds);
      await this.runTask(seeds, jobId, taskId);
      await this.queueClient.queueHandlerForTileSeedingTasks.ack(jobId, taskId);
      await this.jobTrackerClient.notify(taskId);
    } catch (err) {
      if (err instanceof ExceededMaxRetriesError) {
        const errorObj = { jobId, taskId, msg: err.message, err };
        this.logger.error(errorObj);
        await this.queueClient.queueHandlerForTileSeedingTasks.reject(jobId, taskId, false, err.message);
      } else {
        const errorObj = { jobId, taskId, msg: 'Reject task and increase attempts', err };
        this.logger.error(errorObj);
        await this.queueClient.queueHandlerForTileSeedingTasks.reject(jobId, taskId, true, (err as Error).message);
      }
      trace.getActiveSpan()?.recordException(err as Error);
      return false;
    }

    // complete the current pool
    return Boolean(tilesTask);
  }
}
