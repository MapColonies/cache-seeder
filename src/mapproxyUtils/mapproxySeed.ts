import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../common/constants';
import { IConfig, ISeedOptions } from '../common/interfaces';

@singleton()
export class MapproxySeed {
  private readonly mapproxyYamlDir: string;
  private readonly seedYamlDir: string;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {
    this.mapproxyYamlDir = this.config.get<string>('mapproxy.mapproxyYamlDir');
    this.seedYamlDir = this.config.get<string>('mapproxy.seedYamlDir');
  }

  //todo - not implemented on skeleton phase - will developed on phase 2
  public async runSeed(task: ISeedOptions): Promise<void> {
    this.logger.info({ msg: `processing seed for job of ${task.layerId}`, seedOptions: task });
    this.logger.debug({ msg: `current mapproxy yaml config`, mapproxyYaml: this.config });

    try {
      await new Promise((resolve) => setTimeout(resolve, this.config.get('queue.dequeueIntervalMs')));
      this.logger.info(`complete seed for job of ${task.layerId}`);
    } catch (err) {
      this.logger.error({ msg: `failed seed for job of ${task.layerId}`, error: (err as Error).message });
    }
  }

  //todo - not implemented on skeleton phase - will developed on phase 2
  public async runClean(task: ISeedOptions): Promise<void> {
    this.logger.info({ msg: `processing clean for job of ${task.layerId}`, seedOptions: task });
    this.logger.debug({ msg: `current mapproxy yaml config`, mapproxyYaml: this.config });

    try {
      await new Promise((resolve) => setTimeout(resolve, this.config.get('queue.dequeueIntervalMs')));
      this.logger.info(`complete clean for job of ${task.layerId}`);
    } catch (err) {
      this.logger.error({ msg: `failed clean for job of ${task.layerId}`, error: (err as Error).message });
    }
  }
}
