import type { Logger } from '@map-colonies/js-logger';
import { NotFoundError } from '@map-colonies/error-types';
import { HttpClient } from '@map-colonies/mc-utils';
import type { IHttpRetryConfig } from '@map-colonies/mc-utils';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { inject, injectable } from 'tsyringe';
import { trace } from '@opentelemetry/api';
import type { Tracer } from '@opentelemetry/api';
import { join } from 'lodash';
import type { IConfig, IMapProxyConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { SchemaType } from '../common/enums';

@injectable()
export class MapproxyConfigClient extends HttpClient {
  private readonly getConfigUrl = '/config';
  private readonly mapproxyApiUrl;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) protected override readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer
  ) {
    super(
      logger,
      config.get<string>('mapproxy.mapproxyApiUrl'),
      'mapproxyConfigGetter',
      config.get<IHttpRetryConfig>('httpRetry'),
      config.get<boolean>('httpRetry.disableHttpClientLogs')
    );
    this.mapproxyApiUrl = join([this.config.get<string>('mapproxy.mapproxyApiUrl'), this.getConfigUrl], '');
  }

  @withSpanAsyncV4
  public async getConfig(format: SchemaType = SchemaType.YAML): Promise<IMapProxyConfig | Promise<string>> {
    const spanActive = trace.getActiveSpan();
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const headers = { Accept: format };
    try {
      const logInfoMsg = `Getting mapproxy.yaml configuration from provider request`;
      const logInfoObj = { mapproxyApiUrl: this.mapproxyApiUrl };
      this.logger.info({ ...logInfoObj, msg: logInfoMsg });
      spanActive?.addEvent(logInfoMsg, logInfoObj);

      const mapproxyConfig: IMapProxyConfig | string = await this.get(this.getConfigUrl, undefined, undefined, undefined, headers);
      this.logger.debug({ msg: `Got mapproxy.yaml configuration`, config: mapproxyConfig });
      return mapproxyConfig;
    } catch (err) {
      if (err instanceof NotFoundError) {
        this.logger.error({ msg: 'Failed to find mapproxy config', err });
        throw err;
      } else {
        this.logger.error({ msg: 'Unknown error on getting mapproxy config', err });
        throw err;
      }
    }
  }
}
