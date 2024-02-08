import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import { getErrorHandlerMiddleware } from '@map-colonies/error-express-handler';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import httpLogger from '@map-colonies/express-access-log-middleware';
import { defaultMetricsMiddleware, getTraceContexHeaderMiddleware } from '@map-colonies/telemetry';
import { SERVICES } from './common/constants';
import { IConfig } from './common/interfaces';

@injectable()
export class ServerBuilder {
  private readonly serverInstance: express.Application;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.serverInstance = express();
  }

  public build(): express.Application {
    this.registerPreRoutesMiddleware();
    this.registerPostRoutesMiddleware();

    return this.serverInstance;
  }

  private registerPreRoutesMiddleware(): void {
    this.serverInstance.use('/metrics', defaultMetricsMiddleware());
    this.serverInstance.use(httpLogger({ logger: this.logger, ignorePaths: ['/metrics'] }));

    if (this.config.get<boolean>('server.response.compression.enabled')) {
      this.serverInstance.use(compression(this.config.get<compression.CompressionFilter>('server.response.compression.options')));
    }

    this.serverInstance.use(bodyParser.json(this.config.get<bodyParser.Options>('server.request.payload')));
    this.serverInstance.use(getTraceContexHeaderMiddleware());
  }

  private registerPostRoutesMiddleware(): void {
    this.serverInstance.use(getErrorHandlerMiddleware());
  }
}
