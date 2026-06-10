/* eslint-disable import-x/no-named-as-default-member */
import { readFileSync } from 'node:fs';
import nock from 'nock';
import { NotFoundError, InternalServerError } from '@map-colonies/error-types';
import { logger } from '../../mocks/logger';
import { init as initMockConfig, configMock, setValue, clear as clearMockConfig } from '../../mocks/config';
import { MapproxyConfigClient } from '../../../src/clients/mapproxyConfig';
import { registerDependencies } from '../../../src/common/dependencyRegistration';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { tracerMock } from '../../mocks/tracer';

let mapproxyConfigClient: MapproxyConfigClient;
const mapproxyTestUrl = 'http://test';
describe('MapproxyConfigClient', () => {
  beforeEach(function () {
    initMockConfig();
    setValue('mapproxy.mapproxyApiUrl', mapproxyTestUrl);

    console.warn = jest.fn();
    registerDependencies(getContainerConfig());

    mapproxyConfigClient = new MapproxyConfigClient(configMock, logger, tracerMock);
  });
  afterEach(function () {
    clearMockConfig();
    resetContainer();
    jest.resetAllMocks();
    nock.cleanAll();
  });
  describe('MapproxyConfigClient', () => {
    it('should return yaml mapproxy config as Yaml', async function () {
      const mockYamlFile = 'tests/mockData/mockConfig.yaml';
      const yamlContent = readFileSync(mockYamlFile, { encoding: 'utf8' });
      nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
      const result = await mapproxyConfigClient.getConfig();
      expect(result).toStrictEqual(yamlContent);
    });

    it('should return error for not found mapproxy config', async function () {
      nock(mapproxyTestUrl).get(`/config`).reply(404);

      const action = async () => {
        await mapproxyConfigClient.getConfig();
      };
      await expect(action).rejects.toThrow(NotFoundError);
    });

    it('should return error for unknown error mapproxy config', async function () {
      nock(mapproxyTestUrl).get(`/config`).reply(500, 'Internal Server Error');

      const action = async () => {
        await mapproxyConfigClient.getConfig();
      };
      await expect(action).rejects.toThrow(InternalServerError);
    });
  });
});
