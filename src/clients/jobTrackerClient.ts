import { HttpClient } from '@map-colonies/mc-utils';
import type { IHttpRetryConfig } from '@map-colonies/mc-utils';
import { inject, injectable } from 'tsyringe';
import type { Logger } from '@map-colonies/js-logger';
import type { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { SERVICES } from '../common/constants';
import type { IConfig } from '../common/interfaces';

@injectable()
export class JobTrackerClient extends HttpClient {
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) protected override readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer
  ) {
    const serviceName = 'JobTracker';
    const baseUrl = config.get<string>('servicesUrl.jobTracker');
    const httpRetryConfig = config.get<IHttpRetryConfig>('httpRetry');
    const disableHttpClientLogs = config.get<boolean>('httpRetry.disableHttpClientLogs');
    super(logger, baseUrl, serviceName, httpRetryConfig, disableHttpClientLogs);
  }

  @withSpanAsyncV4
  public async notify(taskId: string): Promise<void> {
    const notifyUrl = `/tasks/${taskId}/notify`;
    await this.post(notifyUrl);
  }
}
