import { Logger } from '@map-colonies/js-logger';
import { NotFoundError } from '@map-colonies/error-types';
import { HttpClient, IHttpRetryConfig } from '@map-colonies/mc-utils';
import { inject, injectable } from 'tsyringe';
import { IConfig, IMapProxyConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { SchemaType } from '../common/enums';

@injectable()
export class MapproxyConfigClient extends HttpClient {
  private readonly getConfigUr = '/config';

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) protected readonly logger: Logger) {
    super(
      logger,
      config.get<string>('mapproxy.mapproxyApiUrl'),
      'mapproxyConfigGetter',
      config.get<IHttpRetryConfig>('server.httpRetry'),
      config.get<boolean>('server.httpRetry.disableHttpClientLogs')
    );
  }

  public async getConfig(format: SchemaType = SchemaType.YAML): Promise<IMapProxyConfig> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const headers = { Accept: format };
    try {
      this.logger.info({ msg: `Send mapproxy.yaml configuration from provider request` });
      const mapproxyConfig: IMapProxyConfig = await this.get(this.getConfigUr, undefined, undefined, undefined, headers);
      this.logger.debug({ msg: `got mapproxy.yaml configuration`, config: mapproxyConfig });
      return mapproxyConfig;
    } catch (err) {
      if (err instanceof NotFoundError) {
        this.logger.error('Failed to find mapproxy config');
        throw err;
      } else {
        this.logger.error('Unknown error on getting mapproxy config');
        throw err;
      }
    }
  }
}
