import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { IJobResponse } from '@map-colonies/mc-priority-queue';
import { SERVICES } from '../common/constants';
import { IConfig, IJobParams, ITaskParams } from '../common/interfaces';

@singleton()
export class MapproxySeed {
  private readonly mapproxyYamlDir: string;
  private readonly seedYamlDir: string;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
  ) {
    this.mapproxyYamlDir = this.config.get<string>('mapproxy.mapproxyYamlDir');
    this.seedYamlDir = this.config.get<string>('mapproxy.seedYamlDir');
  }

  public async runSeed(job: IJobResponse<IJobParams,ITaskParams>): Promise<boolean> {
    this.logger.info(`processing seed for job of ${job.id}`, this.config)
    await new Promise((resolve) => setTimeout(resolve, this.config.get('queue.dequeueIntervalMs')))
    
    return false
  }
}
