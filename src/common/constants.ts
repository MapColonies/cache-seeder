import { readPackageJsonSync } from '@map-colonies/read-pkg';

const packageJsonData = readPackageJsonSync();
export const SERVICE_NAME = packageJsonData.name ?? 'unknown_service';
export const SERVICE_VERSION = packageJsonData.version ?? 'unknown_version';
export const DEFAULT_SERVER_PORT = 80;
export const NODE_VERSION = process.versions.node;

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METRICS: Symbol('Metrics'),
  QUEUE_CONFIG: Symbol('QueueConfig'),
} satisfies Record<string, symbol>;
/* eslint-enable @typescript-eslint/naming-convention */
