import { promises as fsp } from 'node:fs';
import { dump } from 'js-yaml';
import buffer from '@turf/buffer';
import { Feature, Polygon } from 'geojson';
import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { Tracer, trace } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { RASTER_CONVENTIONS, INFRA_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { SERVICES } from '../common/constants';
import { IConfig, ISeed } from '../common/interfaces';
import { MapproxyConfigClient } from '../clients/mapproxyConfig';
import { BaseCache, Cleanup, Seed, seedsSchema, cleanupsSchema, baseSchema } from '../common/schemas/seeds';
import { Coverage, coveragesSchema } from '../common/schemas/coverages';
import { SeedMode } from '../common/enums';
import { fileExists, isGridExists, isRedisCache, validateDateFormat, zoomComparison } from '../common/validations';
import { runCommand } from '../common/cmd';
import { ExceededMaxRetriesError } from '../common/errors';

let isErroredCmd = false;
@singleton()
export class MapproxySeed {
  private readonly mapproxyYamlDir: string;
  private readonly seedYamlDir: string;
  private readonly geometryCoverageFilePath: string;
  private readonly seedConcurrency: number;
  private readonly mapproxySeedProgressDir: string;
  private readonly yearsOffset: number;
  private readonly abortController: AbortController;
  private readonly mapproxyCmdCommand: string;
  private readonly minInvalidBboxSeedBufferMeters: number;
  private readonly maxRetriesOnInvalidBbox: number;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly mapproxyConfigClient: MapproxyConfigClient
  ) {
    this.mapproxyYamlDir = this.config.get<string>('mapproxy.mapproxyYamlDir');
    this.seedYamlDir = this.config.get<string>('mapproxy.seedYamlDir');
    this.geometryCoverageFilePath = this.config.get<string>('mapproxy.geometryTxtFile');
    this.seedConcurrency = this.config.get<number>('seedConcurrency');
    this.mapproxySeedProgressDir = this.config.get<string>('mapproxy.seedProgressFileDir');
    this.mapproxyCmdCommand = this.config.get<string>('mapproxy_cmd_command');
    this.yearsOffset = this.config.get<number>('refreshBeforeYearsOffset');
    this.minInvalidBboxSeedBufferMeters = this.config.get<number>('minInvalidBboxSeedBufferMeters');
    this.maxRetriesOnInvalidBbox = this.config.get<number>('maxRetriesOnInvalidBbox');
    this.abortController = new AbortController();
  }

  @withSpanAsyncV4
  public async runSeed(task: ISeed, jobId: string, taskId: string): Promise<void> {
    validateDateFormat(task.refreshBefore);
    task.refreshBefore = this.dateToSeedingFormat(this.addTimeBuffer(task.refreshBefore));

    const logObject = {
      jobId,
      taskId,
      layerId: task.layerId,
      grid: task.grid,
      mode: task.mode,
      fromZoom: task.fromZoomLevel,
      toZoom: task.toZoomLevel,
      refreshBefore: task.refreshBefore,
    };
    const logMsg = `processing ${task.mode} for job of ${task.layerId}`;
    this.logger.info({ ...logObject, msg: logMsg });
    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [INFRA_CONVENTIONS.infra.jobManagement.jobId]: jobId,
      [INFRA_CONVENTIONS.infra.jobManagement.taskId]: taskId,
      [RASTER_CONVENTIONS.raster.cacheSeeder.seedMode]: task.mode,
      [RASTER_CONVENTIONS.raster.catalogManager.catalogId]: task.layerId,
      [RASTER_CONVENTIONS.raster.cacheSeeder.grids]: task.grid,
      [RASTER_CONVENTIONS.raster.cacheSeeder.refreshBefore]: task.refreshBefore,
    });

    spanActive?.addEvent(logMsg, logObject);

    try {
      // Pre data validation
      if (!zoomComparison(task.fromZoomLevel, task.toZoomLevel)) {
        throw new Error(`from zoom level value cannot be bigger than to zoom level value`);
      }

      const currentMapproxyConfig = await this.mapproxyConfigClient.getConfig();
      if (!isRedisCache(task.layerId, currentMapproxyConfig as string)) {
        throw new Error(`Cache type should be of type Redis`);
      }

      if (!isGridExists(task.grid, currentMapproxyConfig as string)) {
        const errMsg = `Grid: ${task.grid} not exist on mapproxy config`;
        throw new Error(errMsg);
      }

      await this.writeMapproxyYaml(jobId, taskId, currentMapproxyConfig as string);
      await this.writeGeojsonTxtFile(this.geometryCoverageFilePath, JSON.stringify(task.geometry), jobId, taskId);
      await this.createSeedYamlFile(task, jobId, taskId);
      await this.executeSeed(task, jobId, taskId);
      this.logger.info({ msg: `complete seed (type of ${task.mode}) for job of ${task.layerId}`, jobId, taskId });
    } catch (err) {
      if (err instanceof Error && err.message.match(/mapproxy.grid.GridError: Invalid BBOX/)) {
        await this.handleInvalidBboxError(task, jobId, taskId);
      } else {
        this.logger.error({ msg: `failed seed for job (type of ${task.mode}) of ${task.layerId}`, jobId, taskId, err });
        throw new Error(`failed seed for job of ${task.layerId} with reason: ${(err as Error).message}`);
      }
    }
  }

  //TODO - should be integrated to update job status-progress mechanism
  //     - calculate dynamically the actual percentage
  //     - send update percentage to total percentage on job-task tables

  /**
   * Not implemented - should calculate task progress dynamically and update job-manager progress percentage
   * @param {string} seedLogStr current batch stdout
   * @returns {void}
   */

  public seedProgressFunc(seedLogStr: string): void {
    this.logger.debug(seedLogStr); // print all mapproxy-seed stdout
    if (seedLogStr.match(/- ERROR -/g) && !isErroredCmd) {
      // substr that detect seeding process error on mapproxy-seed util
      // task will fail on case of seeding logic error (for example redis connection)
      isErroredCmd = true;
      const errMsg = seedLogStr.split('- ERROR -')[1];
      this.logger.error(errMsg);
      this.abortController.abort(errMsg);
    } else if (seedLogStr.match(/error in configuration:/g)) {
      // substr that detect some mapproxy configuration errors
      this.abortController.abort(seedLogStr);
      this.logger.error(seedLogStr);
    }
    if (seedLogStr.match(/\((\d)+ tiles\)/g)) {
      this.logger.info(seedLogStr); // print only progress logs
    }
  }

  private addTimeBuffer(dataTimeStr: string): Date {
    const origDateTime = new Date(dataTimeStr);

    const nowUtc = Date.UTC(
      origDateTime.getFullYear(),
      origDateTime.getMonth(),
      origDateTime.getDate(),
      origDateTime.getHours(),
      origDateTime.getMinutes(),
      origDateTime.getSeconds()
    );
    const utcDate = new Date(nowUtc);
    utcDate.setFullYear(utcDate.getFullYear() + this.yearsOffset);

    return utcDate;
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  @withSpanAsyncV4
  private async writeGeojsonTxtFile(path: string, data: string, jobId: string, taskId: string): Promise<void> {
    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [INFRA_CONVENTIONS.infra.jobManagement.jobId]: jobId,
      [INFRA_CONVENTIONS.infra.jobManagement.taskId]: taskId,
      [RASTER_CONVENTIONS.raster.mapproxyApi.mapproxyYamlPath]: path,
    });

    try {
      const logInfoMsg = `Generating geoJson coverage file: ${path}`;
      const logInfoObj = { path, jobId, taskId };
      this.logger.info({ ...logInfoObj, msg: logInfoMsg });
      spanActive?.addEvent(logInfoMsg, logInfoObj);
      await fsp.writeFile(path, data, 'utf8');
    } catch (err) {
      this.logger.error({ msg: 'Failed on generating geometry coverage file', jobId, taskId, err });
      throw new Error('Failed on generating geometry coverage file');
    }
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  @withSpanAsyncV4
  private async createSeedYamlFile(seedOptions: ISeed, jobId: string, taskId: string): Promise<void> {
    const logObj = {
      layerId: seedOptions.layerId,
      jobId,
      taskId,
      seedMode: seedOptions.mode,
      fromZoomLevel: seedOptions.fromZoomLevel,
      toZoomLevel: seedOptions.toZoomLevel,
    };
    const logInfoMsg = `Generating seed.yaml file to ${seedOptions.mode} task`;
    this.logger.info({ ...logObj, msg: logInfoMsg });
    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [INFRA_CONVENTIONS.infra.jobManagement.jobId]: jobId,
      [INFRA_CONVENTIONS.infra.jobManagement.taskId]: taskId,
      [RASTER_CONVENTIONS.raster.catalogManager.catalogId]: seedOptions.layerId,
      [RASTER_CONVENTIONS.raster.cacheSeeder.seedMode]: seedOptions.mode,
    });
    spanActive?.addEvent(logInfoMsg, logObj);

    try {
      // build the base cache object related to seed\clean job
      const coverageName = `${seedOptions.layerId}-coverage`;
      const baseCache = this.getBaseCache(seedOptions, coverageName);

      this.logger.debug({
        msg: `Created base cache object to layer: ${seedOptions.layerId}`,
        layerId: seedOptions.layerId,
        mode: seedOptions.mode,
        cacheBase: baseCache,
        jobId,
        taskId,
      });
      let cacheJson: Seed | Cleanup;

      const mapproxyYamlExists = await fileExists(this.mapproxyYamlDir);
      if (!mapproxyYamlExists) {
        throw new Error(`Mapproxy yaml configuration file not exists: ${this.mapproxyYamlDir}`);
      }

      const geometryCoverageFileExists = await fileExists(this.geometryCoverageFilePath);
      if (!geometryCoverageFileExists) {
        throw new Error(`geometry coverage json file not exists: ${this.geometryCoverageFilePath}`);
      }

      // check if its seed or clean and extend the base
      if (seedOptions.mode === SeedMode.SEED) {
        cacheJson = this.getSeed(baseCache, seedOptions);
      } else {
        cacheJson = this.getCleanup(baseCache, seedOptions);
      }
      this.logger.debug({
        msg: `Created full cache object of type ${seedOptions.mode} to layer: ${seedOptions.layerId}`,
        layerId: seedOptions.layerId,
        mode: seedOptions.mode,
        cacheJson,
        jobId,
        taskId,
      });

      // generate coverage dataSource file from geometry
      const coverage = this.getCoverage(coverageName);
      const jsonCoverages = coveragesSchema.parse(coverage);
      const jsonFullContent = Object.assign(cacheJson, jsonCoverages);

      const yamlSeed = dump(jsonFullContent, { noArrayIndent: true });
      this.logger.debug({
        msg: `Created seed yaml file type ${seedOptions.mode} to layer: ${seedOptions.layerId}`,
        layerId: seedOptions.layerId,
        mode: seedOptions.mode,
        yamlSeed,
        jobId,
        taskId,
      });

      await fsp.writeFile(this.seedYamlDir, yamlSeed);
    } catch (err) {
      this.logger.error({
        msg: `Failed on generating seed yaml file type ${seedOptions.mode} to layer: ${seedOptions.layerId}`,
        layerId: seedOptions.layerId,
        mode: seedOptions.mode,
        jobId,
        taskId,
        err,
      });
      throw new Error(`unable to create seed.yaml file: ${(err as Error).message}`);
    }
  }

  private getCoverage(coverageName: string): Coverage {
    const coverage: Coverage = {
      coverages: {
        [coverageName]: {
          datasource: this.geometryCoverageFilePath,
          srs: 'EPSG:4326',
        },
      },
    };
    return coverage;
  }

  private dateToSeedingFormat(utcDate: Date): string {
    return utcDate.toISOString().replace(/\..+/, '');
  }

  private getBaseCache(seedOptions: ISeed, coverageName: string): BaseCache {
    const baseCache: BaseCache = {
      caches: [seedOptions.layerId],
      coverages: [coverageName],
      grids: [seedOptions.grid],
      levels: {
        from: seedOptions.fromZoomLevel,
        to: seedOptions.toZoomLevel,
      },
    };
    const jsonBaseCache = baseSchema.parse(baseCache);
    return jsonBaseCache;
  }

  private getSeed(cache: BaseCache, seedOptions: ISeed): Seed {
    const seed = {
      seeds: {
        [seedOptions.layerId]: {
          ...cache,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          refresh_before: {
            time: seedOptions.refreshBefore,
          },
        },
      },
    };

    const jsonSeeds = seedsSchema.parse(seed);
    return jsonSeeds;
  }

  private getCleanup(cache: BaseCache, seedOptions: ISeed): Cleanup {
    const cleanup = {
      cleanups: {
        [seedOptions.layerId]: {
          ...cache,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          remove_before: {
            time: seedOptions.refreshBefore,
          },
        },
      },
    };

    const jsonSeeds = cleanupsSchema.parse(cleanup);
    return jsonSeeds;
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  @withSpanAsyncV4
  private async writeMapproxyYaml(jobId: string, taskId: string, currentMapproxyConfig: string): Promise<void> {
    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [INFRA_CONVENTIONS.infra.jobManagement.jobId]: jobId,
      [INFRA_CONVENTIONS.infra.jobManagement.taskId]: taskId,
    });
    try {
      const logInfoMsg = `Generating current mapproxy config yaml to: ${this.mapproxyYamlDir}`;
      const logObj = { jobId, taskId, mapproxyYamlDir: this.mapproxyYamlDir };
      this.logger.info({ ...logObj, msg: logInfoMsg });
      this.logger.debug({ ...logObj, mapproxyYaml: currentMapproxyConfig, msg: `current mapproxy yaml config` });
      spanActive?.addEvent('generate mapproxy yaml', logObj);
      await fsp.writeFile(this.mapproxyYamlDir, currentMapproxyConfig, 'utf8');
    } catch (err) {
      this.logger.error({ msg: `Failed on generating mapproxy current yaml`, jobId, taskId, err });
      throw new Error(`Failed on generating mapproxy current yaml`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  @withSpanAsyncV4
  private async executeSeed(options: ISeed, jobId: string, taskId: string): Promise<void> {
    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [INFRA_CONVENTIONS.infra.jobManagement.jobId]: jobId,
      [INFRA_CONVENTIONS.infra.jobManagement.taskId]: taskId,
      [RASTER_CONVENTIONS.raster.cacheSeeder.seedMode]: options.mode,
      [RASTER_CONVENTIONS.raster.catalogManager.catalogId]: options.layerId,
      [RASTER_CONVENTIONS.raster.cacheSeeder.grids]: options.grid,
      [RASTER_CONVENTIONS.raster.cacheSeeder.refreshBefore]: options.refreshBefore,
    });
    try {
      const flags = [
        '-f', // mapproxy yaml directory
        this.mapproxyYamlDir,
        '-s', // seed yaml directory
        this.seedYamlDir,
        '--concurrency', // number of thread concurrency to seed task
        this.seedConcurrency.toString(),
        '--progress-file', // temp progress file to seed task
        `${this.mapproxySeedProgressDir}_${options.mode}`,
        '--continue', // tell seed to continue from progress file if was interrupted
      ];

      if (options.skipUncached) {
        this.logger.info('requested to skip uncached tiles');
        flags.push('--skip-uncached');
      }
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const cmdStr = `${this.mapproxyCmdCommand} ${flags.join(' ')}`;
      this.logger.info({ msg: 'Execute cli command for seed', command: cmdStr, jobId, taskId });
      spanActive?.addEvent(cmdStr);

      await runCommand(this.mapproxyCmdCommand, flags, { onProgress: this.seedProgressFunc.bind(this), abortSignal: this.abortController.signal });
    } catch (err) {
      this.logger.error({ msg: `failed to generate tiles`, jobId, taskId, err });
      throw err;
    }
  }

  private async handleInvalidBboxError(task: ISeed, jobId: string, taskId: string, attempt = 1): Promise<void> {
    if (attempt > this.maxRetriesOnInvalidBbox) {
      this.logger.error({
        msg: `Exceeded max retries (${this.maxRetriesOnInvalidBbox}) for invalid bbox error, aborting seed operation for task ${taskId}`,
        taskId,
        layerId: task.layerId,
        jobId,
        maxRetries: this.maxRetriesOnInvalidBbox,
      });
      throw new ExceededMaxRetriesError(`Exceeded max retries (${this.maxRetriesOnInvalidBbox}) for invalid bbox error on task ${taskId}`);
    }

    const currentBuffer = this.minInvalidBboxSeedBufferMeters * attempt;

    this.logger.warn({
      msg: `Invalid bbox detected for geometry, applying ${currentBuffer}m buffer and retrying seed operation`,
      taskId,
      layerId: task.layerId,
      bufferMeters: this.minInvalidBboxSeedBufferMeters,
      originalGeometry: task.geometry,
      errorType: 'invalid_bbox',
    });

    try {
      const bufferedPolygon = buffer(task.geometry as Feature<Polygon>, currentBuffer, { units: 'meters' });
      if (bufferedPolygon !== undefined) {
        const bufferedTask = { ...task, geometry: bufferedPolygon };
        await this.writeGeojsonTxtFile(this.geometryCoverageFilePath, JSON.stringify(bufferedPolygon), jobId, taskId);
        await this.executeSeed(bufferedTask, jobId, taskId);
      }
    } catch (err) {
      if (err instanceof Error && err.message.match(/mapproxy.grid.GridError: Invalid BBOX/)) {
        await this.handleInvalidBboxError(task, jobId, taskId, attempt + 1);
      }
    }
  }
}
