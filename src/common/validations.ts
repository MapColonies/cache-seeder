import { promises, constants } from 'node:fs';
import moment from 'moment';
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

export const isValidDateFormat = (dateString: string): boolean => {
  const isValidDateFormat = moment(dateString, moment.ISO_8601, true).isValid();
  return isValidDateFormat;
};

export const isRedisCache = (cacheName: string, mapproxyConfigYaml: string): boolean => {
  const mapproxyConfigJson = load(mapproxyConfigYaml) as IMapProxyConfig;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const cache = mapproxyConfigJson.caches[cacheName].cache as ICacheSource;
  const isValidRedisCache = cache.type === CacheType.REDIS;
  return isValidRedisCache;
};
