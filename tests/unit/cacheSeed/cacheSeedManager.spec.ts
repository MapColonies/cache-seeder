import jsLogger from '@map-colonies/js-logger';
import nock from 'nock';
import { CacheSeedManager } from '../../../src/cacheSeed/cacheSeedManager';
import { configMock, init as initConfig, clear as clearConfig, setValue } from '../../mocks/config';
import { getApp } from '../../../src/app';
import { getTask, getJob } from '../../mockData/jobTaskData';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { QueueClient } from '../../../src/clients/queueClient';
import { MapproxySeed } from '../../../src/mapproxyUtils/mapproxySeed';
import { IMapProxyConfig, IQueueConfig } from '../../../src/common/interfaces';
import { getConfigMock, mapproxyConfigMock } from '../../mocks/clients/mapproxyConfig';

let queueClient: QueueClient;
let mapproxySeed: MapproxySeed;
let dequeueStub: jest.SpyInstance;
let ackStubForTileTasks: jest.SpyInstance;
let rejectStubForTileTasks: jest.SpyInstance;

describe('CacheSeedManager', () => {
  const jobManagerTestUrl = 'http://someJobManager';
  let cacheSeedManager: CacheSeedManager;
  beforeEach(function () {
    initConfig();
    setValue('seedAttempts', 4);
    setValue('queue', { ...configMock.get<IQueueConfig>('queue'), jobManagerBaseUrl: jobManagerTestUrl });
    queueClient = new QueueClient(configMock, jsLogger({ enabled: false }), configMock.get<IQueueConfig>('queue'));

    console.warn = jest.fn();
    getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });
    mapproxySeed = new MapproxySeed(jsLogger({ enabled: false }), configMock);
    cacheSeedManager = new CacheSeedManager(jsLogger({ enabled: false }), configMock, queueClient, mapproxyConfigMock, mapproxySeed);
  });

  afterEach(function () {
    clearConfig();
    resetContainer();
    jest.resetAllMocks();
    nock.cleanAll();
  });
  describe('#HandleSeedTasks', () => {
    it('running seed job for pending task', async function () {
      const task = getTask();
      const job = getJob();

      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue(task);
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}?shouldReturnTasks=false`).reply(200, job); // internal job manager getJob request mocking
      ackStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'ack').mockImplementation(async () => Promise.resolve());
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}/tasks/${task.id}`).reply(200); // internal job manager getJob request mocking
      nock(jobManagerTestUrl).put(`/jobs/${task.jobId}/tasks/${task.id}`).reply(200); // internal job manager getJob request mocking

      const runSeedSpy = jest.spyOn(MapproxySeed.prototype, 'runSeed');
      const runCleanSpy = jest.spyOn(MapproxySeed.prototype, 'runClean');

      getConfigMock.mockResolvedValue({} as unknown as IMapProxyConfig);
      // action
      await cacheSeedManager.handleCacheSeedTask();

      expect(dequeueStub).toHaveBeenCalledTimes(1);
      expect(ackStubForTileTasks).toHaveBeenCalledTimes(1);
      expect(runSeedSpy).toHaveBeenCalledTimes(1);
      expect(runSeedSpy).toHaveBeenCalledWith(task.parameters.seedTasks[0]);
      expect(runCleanSpy).toHaveBeenCalledTimes(1);
      expect(runCleanSpy).toHaveBeenCalledWith(task.parameters.seedTasks[1]);
    });

    it('No Task to run', async function () {
      const task = getTask();
      const job = getJob();

      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue(null);
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}?shouldReturnTasks=false`).reply(200, job); // internal job manager getJob request mocking
      ackStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'ack').mockImplementation(async () => Promise.resolve());

      getConfigMock.mockResolvedValue({} as unknown as IMapProxyConfig);
      // action
      await cacheSeedManager.handleCacheSeedTask();

      expect(dequeueStub).toHaveBeenCalledTimes(1);
      expect(ackStubForTileTasks).toHaveBeenCalledTimes(0);
    });

    it('Reject task and increase attempts count', async function () {
      const task = getTask();
      const job = getJob();
      ackStubForTileTasks = jest
        .spyOn(queueClient.queueHandlerForTileSeedingTasks, 'ack')
        .mockImplementation(async () => Promise.reject('test error'));
      rejectStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'reject').mockImplementation(async () => Promise.resolve());
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue({ ...task, attempts: 4 });
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}?shouldReturnTasks=false`).reply(200, job); // internal job manager getJob request mocking

      getConfigMock.mockResolvedValue({} as unknown as IMapProxyConfig);
      // action
      await cacheSeedManager.handleCacheSeedTask();

      expect(dequeueStub).toHaveBeenCalledTimes(1);
      expect(ackStubForTileTasks).toHaveBeenCalledTimes(1);
      expect(rejectStubForTileTasks).toHaveBeenCalledTimes(1);
      expect(rejectStubForTileTasks).toHaveBeenCalledWith(task.jobId, task.id, true, undefined);
    });

    it('Reject task failed job-task on max attempts count', async function () {
      const task = getTask();
      const job = getJob();
      ackStubForTileTasks = jest
        .spyOn(queueClient.queueHandlerForTileSeedingTasks, 'ack')
        .mockImplementation(async () => Promise.reject('test error'));
      rejectStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'reject').mockImplementation(async () => Promise.resolve());
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue({ ...task, attempts: 6 });
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}?shouldReturnTasks=false`).reply(200, job); // internal job manager getJob request mocking
      nock(jobManagerTestUrl).put(`/jobs/${task.jobId}`).reply(200); // internal job manager updateJob request mocking

      getConfigMock.mockResolvedValue({} as unknown as IMapProxyConfig);
      // action
      await cacheSeedManager.handleCacheSeedTask();

      expect(dequeueStub).toHaveBeenCalledTimes(1);
      expect(ackStubForTileTasks).toHaveBeenCalledTimes(0);
      expect(rejectStubForTileTasks).toHaveBeenCalledTimes(1);
      expect(rejectStubForTileTasks).toHaveBeenCalledWith(task.jobId, task.id, false);
    });
  });
});
