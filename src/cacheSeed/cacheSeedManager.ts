import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { IJobResponse } from '@map-colonies/mc-priority-queue';
import { SERVICES } from '../common/constants';
import { IConfig, IJobParams, ITaskParams } from '../common/interfaces';
import { MapproxySeed } from '../mapproxyUtils/mapproxySeed';
import { QueueClient } from '../clients/queueClient';


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
    const mockJob = {id: 'testId'} as unknown as IJobResponse<IJobParams,ITaskParams>
    await this.mapproxySeed.runSeed(mockJob)
    console.log('eeeeeeeeeee')
    const delay = 5000 // todo - temp
    // await new Promise((resolve) => setTimeout(resolve, delay))
    return false
  }
}
