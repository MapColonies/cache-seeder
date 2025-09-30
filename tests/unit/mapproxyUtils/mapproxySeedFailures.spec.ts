import { readFileSync, promises as fsp } from 'node:fs';
import jsLogger from '@map-colonies/js-logger';
import nock from 'nock';
import * as turfBufferModule from '@turf/buffer';
import { IHttpRetryConfig } from '@map-colonies/mc-utils';
import * as cmd from '../../../src/common/cmd';
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
  let accessStub: jest.SpyInstance;

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
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  describe('#HandleSeedTasks', () => {
    describe('#FailedSeedTasks', () => {
      it('running single seed task with broken CLI', async function () {
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
        const cmdSeedErrMsg = 'some running mapproxy-seed error';
        const runCommandStub = jest.spyOn(cmd, 'runCommand').mockRejectedValue(new Error(cmdSeedErrMsg));
        const executeSeedSpy = jest.spyOn(MapproxySeed.prototype as unknown as { executeSeed: jest.Mock }, 'executeSeed');
        const bufferSpy = jest.spyOn(turfBufferModule, 'default');

        writeFileStub = jest.spyOn(fsp, 'writeFile').mockImplementation(async () => undefined);
        accessStub = jest.spyOn(fsp, 'access').mockImplementation(async () => undefined);

        const action = async () => {
          await mapproxySeed.runSeed(task.parameters.seedTasks[0], task.jobId, task.id);
        };

        await expect(action).rejects.toThrow(`failed seed for job of test with reason: ${cmdSeedErrMsg}`);
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
        expect(runCommandStub).toHaveBeenCalledTimes(1);
        expect(bufferSpy).not.toHaveBeenCalled();
        expect(runCommandStub).toHaveBeenCalledWith(
          configMock.get<string>('mapproxy_cmd_command'),
          [
            '-f',
            `${configMock.get('mapproxy.mapproxyYamlDir')}`,
            '-s',
            `${configMock.get('mapproxy.seedYamlDir')}`,
            '--concurrency',
            '5',
            '--progress-file',
            `${configMock.get('mapproxy.seedProgressFileDir')}_${task.parameters.seedTasks[0].mode}`,
            '--continue',
            '--skip-uncached',
          ],
          expect.anything()
        );
      });
    });

    describe('#FailuresSeedTasks', () => {
      it('Failed on run main seed function (writeMapproxyYaml)', async function () {
        const task = getTask();
        const mockYamlFile = 'tests/mockData/mockConfig.yaml';
        const yamlContent = readFileSync(mockYamlFile, { encoding: 'utf8' });
        nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
        const writeMapproxyYamlSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml');
        writeFileStub = jest.spyOn(fsp, 'writeFile').mockRejectedValueOnce(new Error());
        accessStub = jest.spyOn(fsp, 'access').mockImplementation(async () => undefined);

        const action = async () => {
          await mapproxySeed.runSeed(task.parameters.seedTasks[0], task.jobId, task.id);
        };

        await expect(action).rejects.toThrow('failed seed for job of test with reason: Failed on generating mapproxy current yaml');
        expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(1);
        expect(writeFileStub).toHaveBeenNthCalledWith(1, configMock.get('mapproxy.mapproxyYamlDir'), yamlContent, 'utf8');
        expect(writeFileStub).toHaveBeenCalledTimes(1);
      });

      it('Failed on run main seed function (writeGeojsonTxtFile)', async function () {
        const task = getTask();
        const mockYamlFile = 'tests/mockData/mockConfig.yaml';
        const yamlContent = readFileSync(mockYamlFile, { encoding: 'utf8' });
        nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
        const writeMapproxyYamlSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml');
        const writeGeojsonTxtFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeGeojsonTxtFile: jest.Mock }, 'writeGeojsonTxtFile');

        writeFileStub = jest.spyOn(fsp, 'writeFile').mockResolvedValueOnce(undefined);
        writeFileStub = jest.spyOn(fsp, 'writeFile').mockRejectedValueOnce(new Error());
        accessStub = jest.spyOn(fsp, 'access').mockImplementation(async () => undefined);

        const action = async () => {
          await mapproxySeed.runSeed(task.parameters.seedTasks[0], task.jobId, task.id);
        };

        await expect(action).rejects.toThrow('failed seed for job of test with reason: Failed on generating geometry coverage file');
        expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(1);
        expect(writeFileStub).toHaveBeenCalledTimes(2);
        expect(writeFileStub).toHaveBeenNthCalledWith(1, configMock.get('mapproxy.mapproxyYamlDir'), yamlContent, 'utf8');
        expect(writeGeojsonTxtFileSpy).toHaveBeenCalledTimes(1);
        expect(writeFileStub).toHaveBeenNthCalledWith(
          2,
          configMock.get('mapproxy.geometryTxtFile'),
          JSON.stringify(task.parameters.seedTasks[0].geometry),
          'utf8'
        );
      });
    });

    describe('#FailuresDataValidation', () => {
      it('Failed on bad zoom ranges', async function () {
        const task = getTask();
        const writeMapproxyYamlSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml');
        const writeGeojsonTxtFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeGeojsonTxtFile: jest.Mock }, 'writeGeojsonTxtFile');
        const createSeedYamlFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { createSeedYamlFile: jest.Mock }, 'createSeedYamlFile');
        const executeSeedSpy = jest.spyOn(MapproxySeed.prototype as unknown as { executeSeed: jest.Mock }, 'executeSeed');
        const bufferSpy = jest.spyOn(turfBufferModule, 'default');

        const action = async () => {
          await mapproxySeed.runSeed({ ...task.parameters.seedTasks[0], toZoomLevel: 1, fromZoomLevel: 20 }, task.jobId, task.id);
        };

        await expect(action).rejects.toThrow(`from zoom level value cannot be bigger than to zoom level value`);
        expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(0);
        expect(writeGeojsonTxtFileSpy).toHaveBeenCalledTimes(0);
        expect(createSeedYamlFileSpy).toHaveBeenCalledTimes(0);
        expect(executeSeedSpy).toHaveBeenCalledTimes(0);
        expect(bufferSpy).not.toHaveBeenCalled();
      });

      it('Failed on bad date format (not ISO_8601)', async function () {
        const task = getTask();
        const writeMapproxyYamlSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml');
        const writeGeojsonTxtFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeGeojsonTxtFile: jest.Mock }, 'writeGeojsonTxtFile');
        const createSeedYamlFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { createSeedYamlFile: jest.Mock }, 'createSeedYamlFile');
        const executeSeedSpy = jest.spyOn(MapproxySeed.prototype as unknown as { executeSeed: jest.Mock }, 'executeSeed');
        const bufferSpy = jest.spyOn(turfBufferModule, 'default');

        const action = async () => {
          await mapproxySeed.runSeed({ ...task.parameters.seedTasks[0], refreshBefore: 'badDate' }, task.jobId, task.id);
        };

        await expect(action).rejects.toThrow(`Date string must be 'ISO_8601' format: yyyy-MM-dd'T'HH:mm:ss, for example: 2023-11-07T12:35:00`);
        expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(0);
        expect(writeGeojsonTxtFileSpy).toHaveBeenCalledTimes(0);
        expect(createSeedYamlFileSpy).toHaveBeenCalledTimes(0);
        expect(executeSeedSpy).toHaveBeenCalledTimes(0);
        expect(bufferSpy).not.toHaveBeenCalled();
      });

      it('Failed on not exists file (mapproxyYaml)', async function () {
        const task = getTask();
        const mockYamlFile = 'tests/mockData/mockConfig.yaml';
        const yamlContent = readFileSync(mockYamlFile, { encoding: 'utf8' });
        nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
        const writeMapproxyYamlSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml');
        const writeGeojsonTxtFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeGeojsonTxtFile: jest.Mock }, 'writeGeojsonTxtFile');
        const createSeedYamlFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { createSeedYamlFile: jest.Mock }, 'createSeedYamlFile');

        writeFileStub = jest.spyOn(fsp, 'writeFile').mockImplementation(async () => undefined);
        accessStub = jest.spyOn(fsp, 'access').mockRejectedValueOnce(new Error('Unknown error'));
        const bufferSpy = jest.spyOn(turfBufferModule, 'default');

        const action = async () => {
          await mapproxySeed.runSeed(task.parameters.seedTasks[0], task.jobId, task.id);
        };

        await expect(action).rejects.toThrow(
          'failed seed for job of test with reason: unable to create seed.yaml file: Mapproxy yaml configuration file not exists: /mapproxy/mapproxy.yaml'
        );

        expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(1);
        expect(writeFileStub).toHaveBeenCalledTimes(2);
        expect(writeFileStub).toHaveBeenNthCalledWith(1, configMock.get('mapproxy.mapproxyYamlDir'), yamlContent, 'utf8');
        expect(writeGeojsonTxtFileSpy).toHaveBeenCalledTimes(1);
        expect(writeFileStub).toHaveBeenNthCalledWith(
          2,
          configMock.get('mapproxy.geometryTxtFile'),
          JSON.stringify(task.parameters.seedTasks[0].geometry),
          'utf8'
        );
        expect(createSeedYamlFileSpy).toHaveBeenCalledTimes(1);
        expect(accessStub).toHaveBeenCalledTimes(1);
        expect(bufferSpy).not.toHaveBeenCalled();
      });

      it('Failed on not valid cache type on mapproxyYaml (not redis)', async function () {
        const task = getTask();
        const mockYamlFile = 'tests/mockData/mockBadConfig.yaml';
        const yamlContent = readFileSync(mockYamlFile, { encoding: 'utf8' });
        nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
        const writeMapproxyYamlSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml');

        writeFileStub = jest.spyOn(fsp, 'writeFile').mockImplementation(async () => undefined);
        accessStub = jest.spyOn(fsp, 'access').mockImplementation(async () => undefined);
        const bufferSpy = jest.spyOn(turfBufferModule, 'default');

        const action = async () => {
          await mapproxySeed.runSeed(task.parameters.seedTasks[0], task.jobId, task.id);
        };

        await expect(action).rejects.toThrow(`failed seed for job of test with reason: Cache type should be of type Redis`);
        expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(0);
        expect(writeFileStub).toHaveBeenCalledTimes(0);
        expect(bufferSpy).not.toHaveBeenCalled();
      });

      it('Failed on not exists file (geometryCoverageFileJson)', async function () {
        const task = getTask();
        const mockYamlFile = 'tests/mockData/mockConfig.yaml';
        const yamlContent = readFileSync(mockYamlFile, { encoding: 'utf8' });
        nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
        const writeMapproxyYamlSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml');
        const writeGeojsonTxtFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeGeojsonTxtFile: jest.Mock }, 'writeGeojsonTxtFile');
        const createSeedYamlFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { createSeedYamlFile: jest.Mock }, 'createSeedYamlFile');

        writeFileStub = jest.spyOn(fsp, 'writeFile').mockImplementation(async () => undefined);
        accessStub = jest.spyOn(fsp, 'access').mockResolvedValueOnce(undefined);
        accessStub = jest.spyOn(fsp, 'access').mockRejectedValueOnce(new Error('Unknown error'));
        const bufferSpy = jest.spyOn(turfBufferModule, 'default');

        const action = async () => {
          await mapproxySeed.runSeed(task.parameters.seedTasks[0], task.jobId, task.id);
        };

        await expect(action).rejects.toThrow(
          `failed seed for job of test with reason: unable to create seed.yaml file: geometry coverage json file not exists: /mapproxy/coverage.json`
        );

        expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(1);
        expect(writeFileStub).toHaveBeenCalledTimes(2);
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
        expect(bufferSpy).not.toHaveBeenCalled();
      });

      it('Failed on not exists grid', async function () {
        const task = getTask();
        const badGridTask = { ...task.parameters.seedTasks[0], grid: 'badGrid' };
        const mockYamlFile = 'tests/mockData/mockConfig.yaml';
        const yamlContent = readFileSync(mockYamlFile, { encoding: 'utf8' });
        nock(mapproxyTestUrl).get(`/config`).reply(200, yamlContent);
        const writeMapproxyYamlSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeMapproxyYaml: jest.Mock }, 'writeMapproxyYaml');
        const writeGeojsonTxtFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { writeGeojsonTxtFile: jest.Mock }, 'writeGeojsonTxtFile');
        const createSeedYamlFileSpy = jest.spyOn(MapproxySeed.prototype as unknown as { createSeedYamlFile: jest.Mock }, 'createSeedYamlFile');

        writeFileStub = jest.spyOn(fsp, 'writeFile').mockImplementation(async () => undefined);
        accessStub = jest.spyOn(fsp, 'access').mockResolvedValueOnce(undefined);
        accessStub = jest.spyOn(fsp, 'access').mockRejectedValueOnce(new Error('Unknown error'));
        const bufferSpy = jest.spyOn(turfBufferModule, 'default');

        const action = async () => {
          await mapproxySeed.runSeed(badGridTask, task.jobId, task.id);
        };

        await expect(action).rejects.toThrow(`failed seed for job of test with reason: Grid: badGrid not exist on mapproxy config`);

        expect(writeMapproxyYamlSpy).toHaveBeenCalledTimes(0);
        expect(writeFileStub).toHaveBeenCalledTimes(0);
        expect(writeGeojsonTxtFileSpy).toHaveBeenCalledTimes(0);
        expect(createSeedYamlFileSpy).toHaveBeenCalledTimes(0);
        expect(bufferSpy).not.toHaveBeenCalled();
      });
    });
  });
});
