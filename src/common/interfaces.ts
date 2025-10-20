/* eslint-disable @typescript-eslint/naming-convention */
import { GeoJSON } from 'geojson';
import { CacheType, SeedMode } from './enums';

type JSONValue = string | number | boolean | JSONObject | JSONArray;
interface JSONArray extends Array<JSONValue> {}

export interface JSONObject {
  [x: string]: JSONValue;
}

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
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
  type: CacheType;
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
  services: JSONObject;
  layers: IMapProxyLayer[];
  caches: IMapProxyCache;
  grids: JSONObject;
  globals: IMapProxyGlobalConfig;
}

export interface ISeed {
  mode: SeedMode;
  grid: string;
  fromZoomLevel: number;
  toZoomLevel: number;
  geometry: GeoJSON;
  skipUncached: boolean;
  layerId: string; // cache name as configured in mapproxy
  refreshBefore: string;
}

export interface ITaskParams {
  seedTasks: ISeed[];
  catalogId: string;
  traceParentContext?: ITraceParentContext;
  cacheType: CacheType;
}

export interface ITraceParentContext {
  traceparent?: string;
  tracestate?: string;
}
