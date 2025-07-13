import { promises, constants } from 'node:fs';
import { load } from 'js-yaml';
import { ICacheSource, IMapProxyConfig } from './interfaces';
import { CacheType } from './enums';

export const zoomComparison = (fromZoom: number, toZoom: number): boolean => {
  const valid = fromZoom <= toZoom;
  return valid;
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await promises.access(filePath, constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
};

export const validateDateFormat = (dateString: string): boolean => {
  const convertedDate = new Date(dateString);
  if (isNaN(convertedDate.getTime())) {
    throw new Error(`Date string must be 'ISO_8601' format: yyyy-MM-dd'T'HH:mm:ss, for example: 2023-11-07T12:35:00`);
  }
  return true;
};

export const isRedisCache = (cacheName: string, mapproxyConfigYaml: string): boolean => {
  const mapproxyConfigJson = load(mapproxyConfigYaml) as IMapProxyConfig;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const cache = mapproxyConfigJson.caches[cacheName].cache as ICacheSource;
  const isRedisCache = cache.type === CacheType.REDIS;
  return isRedisCache;
};

export const isGridExists = (gridName: string, mapproxyConfigYaml: string): boolean => {
  const mapproxyConfigJson = load(mapproxyConfigYaml) as IMapProxyConfig;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const gridsNames = Object.keys(mapproxyConfigJson.grids);
  const isGridExists = gridsNames.includes(gridName);
  return isGridExists;
};
