import { Logger } from '@map-colonies/js-logger';
import { NotFoundError } from '@map-colonies/error-types';
import { HttpClient, IHttpRetryConfig } from '@map-colonies/mc-utils';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { IConfig, IMapProxyConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { SchemaType } from '../common/enums';

@injectable()
export class MapproxyConfigClient extends HttpClient {
  private readonly getConfigUr = '/config';

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) protected readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer
  ) {
    super(
      logger,
      config.get<string>('mapproxy.mapproxyApiUrl'),
      'mapproxyConfigGetter',
      config.get<IHttpRetryConfig>('server.httpRetry'),
      config.get<boolean>('server.httpRetry.disableHttpClientLogs')
    );
  }

  @withSpanAsyncV4
  public async getConfig(format: SchemaType = SchemaType.YAML): Promise<IMapProxyConfig | Promise<string>> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const headers = { Accept: format };
    try {
      this.logger.info({ msg: `Getting mapproxy.yaml configuration from provider request` });
      const mapproxyConfig: IMapProxyConfig | string = await this.get(this.getConfigUr, undefined, undefined, undefined, headers);

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
