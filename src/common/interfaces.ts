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
  heartbeatManagerBaseUrl: string;
  dequeueIntervalMs: number;
  heartbeatIntervalMs: number;
  jobType: string;
  tilesTaskType: string;
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

export interface ISeedOptions {
  mode: SeedMode;
  layerId: string; // cache name as configured in mapproxy
  grid: string;
  fromZoomLevel: number;
  toZoomLevel: number;
  refreshBefore: string;
  geometry: GeoJSON;
  skipUncached: boolean;
}

export interface ITaskParams {
  seedTasks: ISeedOptions[];
  catalogId: string;
  jobId: string;
  spanId: string;
  cacheType: CacheType;
}
