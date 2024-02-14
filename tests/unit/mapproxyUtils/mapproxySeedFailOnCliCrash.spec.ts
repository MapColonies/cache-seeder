import { readFileSync, promises as fsp } from 'node:fs';
import jsLogger from '@map-colonies/js-logger';
import nock from 'nock';
import { IHttpRetryConfig } from '@map-colonies/mc-utils';
import { configMock, init as initConfig, clear as clearConfig, setValue } from '../../mocks/config';
import { getApp } from '../../../src/app';
import { getTask } from '../../mockData/testStaticData';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { MapproxySeed } from '../../../src/mapproxyUtils/mapproxySeed';
import { IQueueConfig } from '../../../src/common/interfaces';
import { MapproxyConfigClient } from '../../../src/clients/mapproxyConfig';
import { $ } from 'zx';

let mapproxyConfigClient: MapproxyConfigClient;
let mapproxySeed: MapproxySeed;

$.prefix = 'bad_cli_command_internal_';

describe('#MapproxySeed', () => {
  const jobManagerTestUrl = 'http://someJobManager';
  const mapproxyTestUrl = 'http://test';
  let writeFileStub: jest.SpyInstance;
  let accessStub: jest.SpyInstance;

  beforeEach(function () {
    initConfig();
    setValue('mapproxy.mapproxyApiUrl', mapproxyTestUrl);
    setValue('seedAttempts', 4);
    setValue('queue', { ...configMock.get<IQueueConfig>('queue'), jobManagerBaseUrl: jobManagerTestUrl });
    setValue('server.httpRetry', { ...configMock.get<IHttpRetryConfig>('server.httpRetry'), delay: 0 });
    mapproxyConfigClient = new MapproxyConfigClient(configMock, jsLogger({ enabled: false }));

    console.warn = jest.fn();
    getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });
    mapproxySeed = new MapproxySeed(jsLogger({ enabled: false }), configMock, mapproxyConfigClient);
  });

  afterEach(function () {
    clearConfig();
    resetContainer();
    jest.resetAllMocks();
    nock.cleanAll();
  });

  describe('#HandleSeedTasks', () => {
    it.only('running single seed task with bad command - internal process error', async function () {
      const task = getTask();
      const mockYamlFile = 'tests/mockData/mockConfig.yaml';
      const yamlContent = readFileSync(mockYamlFile, { encoding: 'utf8' });
      nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
      const mockSeedYaml = 'tests/mockData/seedYaml.yaml';
      const seedYamlContent = readFileSync(mockSeedYaml, { encoding: 'utf8' });
      nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
      const writeMapproxyYamlSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml');
      const writeGeojsonTxtFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeGeojsonTxtFile: jest.Mock }, 'writeGeojsonTxtFile');
      const createSeedYamlFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { createSeedYamlFile: jest.Mock }, 'createSeedYamlFile');
      const getSeedSpy = jest.spyOn(MapproxySeed.prototype as unknown as { getSeed: jest.Mock }, 'getSeed');
      const getCleanupSpy = jest.spyOn(MapproxySeed.prototype as unknown as { getCleanup: jest.Mock }, 'getCleanup');
      const executeSeedSpy = jest.spyOn(MapproxySeed.prototype as unknown as { executeSeed: jest.Mock }, 'executeSeed');
      const seedProgressFuncSpy = jest.spyOn(MapproxySeed.prototype as unknown as { seedProgressFunc: jest.Mock }, 'seedProgressFunc');
      writeFileStub = jest.spyOn(fsp, 'writeFile').mockImplementation(async () => undefined);
      accessStub = jest.spyOn(fsp, 'access').mockImplementation(async () => undefined);

      const action = async () => {
        await mapproxySeed.runSeed(task.parameters.seedTasks[0], task.jobId, task.id);
      };

      await expect(action).rejects.toThrow(
        `failed seed for job of test with reason: /bin/bash: bad_cli_command_internal_mapproxy-seed: command not found`
      );

      expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(1);
      expect(writeFileStub).toHaveBeenCalledTimes(3);
      expect(writeFileStub).toHaveBeenNthCalledWith(1, configMock.get('mapproxy.mapproxyYamlDir'), yamlContent, 'utf8');
      expect(writeGeojsonTxtFileSpy).toHaveBeenCalledTimes(1);
      expect(writeFileStub).toHaveBeenNthCalledWith(
        2,
        configMock.get('mapproxy.geometryTxtFile'),
        JSON.stringify(task.parameters.seedTasks[0].geometry),
        'utf8'
      );
      expect(createSeedYamlFileSpy).toHaveBeenCalledTimes(1);
      expect(accessStub).toHaveBeenCalledTimes(2);
      expect(getSeedSpy).toHaveBeenCalledTimes(1);
      expect(getCleanupSpy).toHaveBeenCalledTimes(0);
      expect(writeFileStub).toHaveBeenNthCalledWith(3, configMock.get('mapproxy.seedYamlDir'), seedYamlContent);
      expect(executeSeedSpy).toHaveBeenCalledTimes(1);
      expect(seedProgressFuncSpy).toHaveBeenCalledTimes(0);
    });
  });
});
