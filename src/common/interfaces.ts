/* eslint-disable @typescript-eslint/naming-convention */

import { GeoJSON } from 'geojson';
import { JsonObject } from 'swagger-ui-express';
import { CacheType, SeedMode } from './enums';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

export interface IQueueConfig {
  jobManagerBaseUrl: string;
  heartbeat: IHeartbeatConfig;
  dequeueIntervalMs: number;
  jobType: string;
  tilesTaskType: string;
}

export interface IHeartbeatConfig {
  heartbeatManagerBaseUrl: string;
  heartbeatIntervalMs: number;
}

export interface IJobParams {
  layerName: string;
}

export interface IMapProxyLayer {
  name: string;
  title?: string;
  sources: string[];
}

export interface ICacheSource {
  type: string;
}

export interface IMapProxyCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  sources: string[];
  grids: string[];
  format: string;
  upscale_tiles: number;
  cache: ICacheSource;
  minimize_meta_request: boolean;
}

export interface IMapProxyGlobalConfig {
  cache: {
    s3: {
      endpoint_url: string;
      bucket_name: string;
    };
  };
}

export interface IMapProxyConfig {
  services: JsonObject;
  layers: IMapProxyLayer[];
  caches: IMapProxyCache;
  grids: JsonObject;
  globals: IMapProxyGlobalConfig;
}

export interface ISeedBase {
  mode: SeedMode;
  grid: string;
  fromZoomLevel: number;
  toZoomLevel: number;
  geometry: GeoJSON;
  skipUncached: boolean;
  layerId: string; // cache name as configured in mapproxy
}

export interface ITaskSeedOptions extends ISeedBase {
  refreshBefore: string;
}

export interface ITaskSeedCleanOptions extends ISeedBase {
  remove_before: string;
}

export interface ITaskParams {
  seedTasks: ITaskSeedOptions[];
  catalogId: string;
  spanId: string;
  cacheType: CacheType;
}
