import { MapproxyConfigClient } from '../../../src/clients/mapproxyConfig';

const getConfigMock = jest.fn();

const mapproxyConfigMock = {
  getConfig: getConfigMock,
} as unknown as MapproxyConfigClient;

export { getConfigMock, mapproxyConfigMock };
