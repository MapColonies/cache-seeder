export enum SeedMode {
  SEED = 'seed',
  CLEAN = 'clean',
}

export enum SchemaType { // TODO: use MIMETypes
  JSON = 'application/json',
  YAML = 'application/yaml',
}

export enum CacheType {
  S3 = 's3',
  REDIS = 'redis',
  GPKG = 'geopackage',
}
