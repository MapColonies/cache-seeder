import { promises as fsp } from 'node:fs';
import { $ } from 'zx';
import { dump } from 'js-yaml';
import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../common/constants';
import { IConfig, ISeed } from '../common/interfaces';
import { MapproxyConfigClient } from '../clients/mapproxyConfig';
/* eslint-disable @typescript-eslint/naming-convention */
import { BaseCache, Cleanup, Seed, seedsSchema, cleanupsSchema, baseSchema } from '../common/schemas/seeds';
import { Coverage, coveragesSchema } from '../common/schemas/coverages';
import { SeedMode } from '../common/enums';
import { fileExists, isValidDateFormat, zoomComparison } from '../common/validations';

$.verbose = false;

@singleton()
export class MapproxySeed {
  private readonly mapproxyYamlDir: string;
  private readonly seedYamlDir: string;
  private readonly geometryCoverageFilePath: string;
  private readonly seedConcurrency: number;
  private readonly mapproxySeedProgressDir: string;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    private readonly mapproxyConfigClient: MapproxyConfigClient
  ) {
    this.mapproxyYamlDir = this.config.get<string>('mapproxy.mapproxyYamlDir');
    this.seedYamlDir = this.config.get<string>('mapproxy.seedYamlDir');
    this.geometryCoverageFilePath = this.config.get<string>('mapproxy.geometryTxtFile');
    this.seedConcurrency = 5;
    this.mapproxySeedProgressDir = this.config.get<string>('mapproxy.seedProgressFileDir');
  }

  public async runSeed(task: ISeed, jobId: string, taskId: string): Promise<void> {
    this.logger.info({
      msg: `processing ${task.mode} for job of ${task.layerId}`,
      jobId,
      taskId,
      layerId: task.layerId,
      grid: task.grid,
      mode: task.mode,
      fromZoom: task.fromZoomLevel,
      toZoom: task.toZoomLevel,
      refreshBefore: task.refreshBefore,
    });

    try {
      // Pre data validation
      if (!zoomComparison(task.fromZoomLevel, task.toZoomLevel)) {
        throw new Error(`from zoom level value cannot be bigger than to zoom level value`);
      }

      if (!isValidDateFormat(task.refreshBefore)) {
        throw new Error(`Date string must be 'ISO_8601' format: yyyy-MM-dd'T'HH:mm:ss, for example: 2023-11-07T12:35:00`);
      }

      await this.writeMapproxyYaml(jobId, taskId);
      await this.writeGeojsonTxtFile(this.geometryCoverageFilePath, JSON.stringify(task.geometry), jobId, taskId);
      await this.createSeedYamlFile(task, jobId, taskId);
      await this.executeSeed(task, jobId, taskId);
      this.logger.info({ msg: `complete seed (type of ${task.mode}) for job of ${task.layerId}`, jobId, taskId });
    } catch (err) {
      this.logger.error({ msg: `failed seed for job (type of ${task.mode}) of ${task.layerId}`, jobId, taskId, err });
      throw new Error(`failed seed for job of ${task.layerId} with reason: ${(err as Error).message}`);
    }
  }

  private async writeGeojsonTxtFile(path: string, data: string, jobId: string, taskId: string): Promise<void> {
    try {
      this.logger.info({ msg: `Generating geoJson coverage file: ${path}`, jobId, taskId });
      await fsp.writeFile(path, data, 'utf8');
    } catch (err) {
      this.logger.error({ msg: 'Failed on generating geometry coverage file', jobId, taskId, err });
      throw new Error('Failed on generating geometry coverage file');
    }
  }

  private async createSeedYamlFile(seedOptions: ISeed, jobId: string, taskId: string): Promise<void> {
    this.logger.info({
      msg: `Generating seed.yaml file to ${seedOptions.mode} task`,
      layerId: seedOptions.layerId,
      mode: seedOptions.mode,
      jobId,
      taskId,
    });
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
          remove_before: {
            time: seedOptions.refreshBefore,
          },
        },
      },
    };

    const jsonSeeds = cleanupsSchema.parse(cleanup);
    return jsonSeeds;
  }

  private async writeMapproxyYaml(jobId: string, taskId: string): Promise<void> {
    try {
      this.logger.info({ msg: `Generating current mapproxy config yaml to: ${this.mapproxyYamlDir}`, jobId, taskId });
      const currentMapproxyConfig = await this.mapproxyConfigClient.getConfig();
      this.logger.debug({ msg: `current mapproxy yaml config`, mapproxyYaml: currentMapproxyConfig, jobId, taskId });
      await fsp.writeFile(this.mapproxyYamlDir, currentMapproxyConfig as string, 'utf8');
    } catch (err) {
      this.logger.error({ msg: `Failed on generating mapproxy current yaml`, jobId, taskId, err });
      throw new Error(`Failed on generating mapproxy current yaml`);
    }
  }

  private async executeSeed(options: ISeed, jobId: string, taskId: string): Promise<void> {
    try {
      const flags = [
        '-f', // mapproxy yaml directory
        this.mapproxyYamlDir,
        '-s', // seed yaml directory
        this.seedYamlDir,
        '--concurrency', // number of thread concurrency to seed task
        this.seedConcurrency,
        '--progress-file', // temp progress file to seed task
        `${this.mapproxySeedProgressDir}_${options.mode}`,
        '--continue', // tell seed to continue from progress file if was interrupted
      ];

      if (options.skipUncached) {
        this.logger.info('requested to skip uncached tiles');
        flags.push('--skip-uncached');
      }
      const cmd = $`mapproxy-seed ${flags}`;
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      for await (const chunk of cmd.stdout) {
        // todo - implement on next phase progressPercentage calculate logic
        const str: string = (chunk as Buffer).toString('utf8');
        this.logger.debug(str);
      }
    } catch (err) {
      this.logger.error({ msg: `failed to generate tiles`, jobId, taskId, err });
      throw err;
    }
  }
}
