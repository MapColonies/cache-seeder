import { readFileSync, promises as fsp } from 'node:fs';
import jsLogger from '@map-colonies/js-logger';
import nock from 'nock';
import * as turfBufferModule from '@turf/buffer';
import { IHttpRetryConfig } from '@map-colonies/mc-utils';
import { configMock, init as initConfig, clear as clearConfig, setValue } from '../../mocks/config';
import { getApp } from '../../../src/app';
import { getTask } from '../../mockData/testStaticData';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { MapproxySeed } from '../../../src/mapproxyUtils/mapproxySeed';
import { IQueueConfig } from '../../../src/common/interfaces';
import { MapproxyConfigClient } from '../../../src/clients/mapproxyConfig';
import { tracerMock } from '../../mocks/tracer';

let mapproxySeed: MapproxySeed;
let mapproxyConfigClient: MapproxyConfigClient;

describe('#MapproxySeed', () => {
  const jobManagerTestUrl = 'http://someJobManager';
  const mapproxyTestUrl = 'http://test';
  let writeFileStub: jest.SpyInstance;

  beforeEach(function () {
    initConfig();
    setValue('mapproxy.mapproxyApiUrl', mapproxyTestUrl);
    setValue('seedAttempts', 4);
    setValue('queue', { ...configMock.get<IQueueConfig>('queue'), jobManagerBaseUrl: jobManagerTestUrl });
    setValue('server.httpRetry', { ...configMock.get<IHttpRetryConfig>('server.httpRetry'), delay: 0 });
    mapproxyConfigClient = new MapproxyConfigClient(configMock, jsLogger({ enabled: false }), tracerMock);
    console.warn = jest.fn();

    getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });

    mapproxySeed = new MapproxySeed(jsLogger({ enabled: false }), configMock, tracerMock, mapproxyConfigClient);
  });

  afterEach(function () {
    clearConfig();
    resetContainer();
    jest.resetAllMocks();
    nock.cleanAll();
  });

  describe('#HandleSeedTasks', () => {
    it('Should retry task with buffered bbox after seed failed on grid error', async function () {
      const task = getTask();
      const mockYamlFile = 'tests/mockData/mockConfig.yaml';
      const yamlContent = readFileSync(mockYamlFile, { encoding: 'utf8' });
      nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
      const writeMapproxyYamlSpy = jest
        .spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml')
        .mockImplementation(undefined);
      const createSeedYamlFileSpy = jest
        .spyOn(MapproxySeed.prototype as unknown as { createSeedYamlFile: jest.Mock }, 'createSeedYamlFile')
        .mockImplementation(undefined);
      const writeGeojsonTxtFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeGeojsonTxtFile: jest.Mock }, 'writeGeojsonTxtFile');
      const executeSeedSpy = jest
        .spyOn(MapproxySeed.prototype as unknown as { executeSeed: jest.Mock }, 'executeSeed')
        .mockRejectedValueOnce(new Error('Command failed with error [mapproxy.grid.GridError: Invalid BBOX]'))
        .mockResolvedValueOnce(undefined);
      writeFileStub = jest.spyOn(fsp, 'writeFile').mockImplementation(async () => undefined);
      const bufferSpy = jest.spyOn(turfBufferModule, 'default');

      await mapproxySeed.runSeed(task.parameters.seedTasks[0], task.jobId, task.id);

      expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(1);
      expect(createSeedYamlFileSpy).toHaveBeenCalledTimes(1);
      expect(writeGeojsonTxtFileSpy).toHaveBeenCalledTimes(2);
      expect(executeSeedSpy).toHaveBeenCalledTimes(2);
      expect(bufferSpy).toHaveBeenCalledTimes(1);
      expect(nock.isDone()).toBeTruthy();
    });
  });
});
