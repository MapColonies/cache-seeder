/// <reference types="jest-extended" />

import { setTimeout as setTimeoutPromises } from 'timers/promises';
import jsLogger from '@map-colonies/js-logger';
import nock from 'nock';
import { IHttpRetryConfig } from '@map-colonies/mc-utils';
import { trace } from '@opentelemetry/api';
import { CacheSeedManager } from '../../../src/cacheSeed/cacheSeedManager';
import { configMock, init as initConfig, clear as clearConfig, setValue } from '../../mocks/config';
import { getApp } from '../../../src/app';
import { getTask, getJob } from '../../mockData/testStaticData';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { QueueClient } from '../../../src/clients/queueClient';
import { MapproxySeed } from '../../../src/mapproxyUtils/mapproxySeed';
import { IQueueConfig } from '../../../src/common/interfaces';
import { MapproxyConfigClient } from '../../../src/clients/mapproxyConfig';
import { tracing } from '../../../src/common/tracing';
import { SERVICE_NAME } from '../../../src/common/constants';
import { JobTrackerClient } from '../../../src/clients/jobTrackerClient';
import { ExceededMaxRetriesError } from '../../../src/common/errors';

tracing.start();
const tracer = trace.getTracer(SERVICE_NAME);

let queueClient: QueueClient;
let mapproxyConfigClient: MapproxyConfigClient;
let mapproxySeed: MapproxySeed;
let jobTrackerClient: JobTrackerClient;
let dequeueStub: jest.SpyInstance;
let ackStubForTileTasks: jest.SpyInstance;
let rejectStubForTileTasks: jest.SpyInstance;
jest.mock('timers/promises', () => ({
  setTimeout: jest.fn().mockImplementation(() => undefined),
}));

describe('CacheSeedManager', () => {
  const jobManagerTestUrl = 'http://someJobManager';
  const jobTrackerTestUrl = 'http://someJobTracker';
  let cacheSeedManager: CacheSeedManager;
  beforeEach(function () {
    initConfig();
    setValue('seedAttempts', 4);
    setValue('queue', { ...configMock.get<IQueueConfig>('queue'), jobManagerBaseUrl: jobManagerTestUrl });
    setValue('servicesUrl.jobTracker', jobTrackerTestUrl);
    setValue('server.httpRetry', { ...configMock.get<IHttpRetryConfig>('server.httpRetry'), delay: 0 });
    mapproxyConfigClient = new MapproxyConfigClient(configMock, jsLogger({ enabled: false }), tracer);
    queueClient = new QueueClient(configMock, jsLogger({ enabled: false }), configMock.get<IQueueConfig>('queue'));
    jobTrackerClient = new JobTrackerClient(configMock, jsLogger({ enabled: false }), tracer);

    jest.spyOn(CacheSeedManager.prototype as unknown as { delay: jest.Mock }, 'delay').mockResolvedValue(undefined);

    console.warn = jest.fn();
    getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });
    mapproxySeed = new MapproxySeed(jsLogger({ enabled: false }), configMock, tracer, mapproxyConfigClient);
    cacheSeedManager = new CacheSeedManager(jsLogger({ enabled: false }), configMock, tracer, queueClient, mapproxySeed, jobTrackerClient);
  });

  afterEach(function () {
    clearConfig();
    resetContainer();
    jest.restoreAllMocks();
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
      nock(jobTrackerTestUrl).post(`/tasks/${task.id}/notify`).reply(200); // internal job tracker notify request mocking
      const runTaskSpy = jest.spyOn(CacheSeedManager.prototype as unknown as { runTask: jest.Mock }, 'runTask');
      const isValidCacheTypeSpy = jest.spyOn(CacheSeedManager.prototype as unknown as { isValidCacheType: jest.Mock }, 'isValidCacheType');
      const runSeedSpy = jest.spyOn(MapproxySeed.prototype, 'runSeed').mockResolvedValue(undefined);

      // action
      const action = async () => {
        await cacheSeedManager.handleCacheSeedTask();
      };
      await expect(action()).resolves.not.toThrow();
      expect(dequeueStub).toHaveBeenCalledOnce();
      expect(runTaskSpy).toHaveBeenCalledOnce();
      expect(isValidCacheTypeSpy).toHaveBeenCalledOnce();
      expect(await isValidCacheTypeSpy.mock.results[0].value).toBe(true);
      expect(runSeedSpy).toHaveBeenCalledTimes(2);
      expect(runSeedSpy).toHaveBeenNthCalledWith(1, task.parameters.seedTasks[0], task.jobId, task.id);
      expect(runSeedSpy).toHaveBeenNthCalledWith(2, task.parameters.seedTasks[1], task.jobId, task.id);
      expect(ackStubForTileTasks).toHaveBeenCalledOnce();
    });

    it('No Task to run', async function () {
      const task = getTask();
      const job = getJob();

      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue(null);
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}?shouldReturnTasks=false`).reply(200, job); // internal job manager getJob request mocking
      ackStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'ack').mockImplementation(async () => Promise.resolve());

      // action
      await cacheSeedManager.handleCacheSeedTask();

      expect(dequeueStub).toHaveBeenCalledOnce();
      expect(ackStubForTileTasks).toHaveBeenCalledTimes(0);
    });

    it('Reject task and increase attempts count', async function () {
      const task = getTask();
      task.parameters.traceParentContext = { ...task.parameters.traceParentContext, traceparent: 'some-invalid-trace' };
      const job = getJob();
      const runTaskSpy = jest
        .spyOn(CacheSeedManager.prototype as unknown as { runTask: jest.Mock }, 'runTask')
        .mockImplementation(async () => Promise.reject(new Error('error on running seed')));
      rejectStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'reject').mockRejectedValue(new Error('test failure'));
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue({ ...task, attempts: 4 });
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}?shouldReturnTasks=false`).reply(200, job); // internal job manager getJob request mocking

      // action
      const action = async () => {
        await cacheSeedManager.handleCacheSeedTask();
      };
      await expect(action).rejects.toThrow(new Error('test failure'));
      expect(dequeueStub).toHaveBeenCalledOnce();
      expect(runTaskSpy).toHaveBeenCalledOnce();
      expect(rejectStubForTileTasks).toHaveBeenCalledOnce();
      expect(rejectStubForTileTasks).toHaveBeenCalledWith(task.jobId, task.id, true, 'error on running seed');
    });

    it('Reject task - task on max attempts count', async function () {
      const task = getTask();
      const job = getJob();
      rejectStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'reject').mockImplementation(async () => Promise.resolve());
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue({ ...task, attempts: 6 });
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}?shouldReturnTasks=false`).reply(200, job); // internal job manager getJob request mocking
      nock(jobTrackerTestUrl).post(`/tasks/${task.id}/notify`).reply(200); // internal job tracker notify request mocking

      // action
      await cacheSeedManager.handleCacheSeedTask();

      expect(dequeueStub).toHaveBeenCalledOnce();
      expect(rejectStubForTileTasks).toHaveBeenCalledOnce();
      expect(rejectStubForTileTasks).toHaveBeenCalledWith(task.jobId, task.id, false);
    });

    it('Reject seed task for getting invalid CacheType', async function () {
      const task = { ...getTask(), parameters: { ...getTask().parameters, cacheType: 'NotSupportCacheSample' } };
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue(task);
      rejectStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'reject').mockImplementation(async () => Promise.resolve());

      nock(jobTrackerTestUrl).post(`/tasks/${task.id}/notify`).reply(200); // internal job tracker notify request mocking

      const runTaskSpy = jest.spyOn(CacheSeedManager.prototype as unknown as { runTask: jest.Mock }, 'runTask');
      const isValidCacheTypeSpy = jest.spyOn(CacheSeedManager.prototype as unknown as { isValidCacheType: jest.Mock }, 'isValidCacheType');

      // action
      const action = async () => {
        await cacheSeedManager.handleCacheSeedTask();
      };

      await expect(action()).resolves.not.toThrow();
      expect(dequeueStub).toHaveBeenCalledOnce();
      expect(isValidCacheTypeSpy).toHaveBeenCalledOnce();
      expect(await isValidCacheTypeSpy.mock.results[0].value).toBeFalsy();
      expect(runTaskSpy).toHaveBeenCalledTimes(0);
      expect(rejectStubForTileTasks).toHaveBeenCalledOnce();
      expect(rejectStubForTileTasks).toHaveBeenCalledWith(task.jobId, task.id, false, 'Unsupported cache type NotSupportCacheSample');
    });

    it('Reject seed task for getting invalid mode type (not seed or clean on task params', async function () {
      const task = { ...getTask(), parameters: { ...getTask().parameters, seedTasks: [{ mode: 'testMode' }] } };
      const job = getJob();
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue(task);
      rejectStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'reject').mockImplementation(async () => Promise.resolve());
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}?shouldReturnTasks=false`).reply(200, job); // internal job manager getJob request mocking
      nock(jobTrackerTestUrl).post(`/tasks/${task.id}/notify`).reply(200); // internal job tracker notify request mocking
      const runTaskSpy = jest.spyOn(CacheSeedManager.prototype as unknown as { runTask: jest.Mock }, 'runTask');

      // action
      const action = async () => cacheSeedManager.handleCacheSeedTask();

      await expect(action()).resolves.not.toThrow();
      expect(dequeueStub).toHaveBeenCalledOnce();
      expect(runTaskSpy).toHaveBeenCalledOnce();
      expect(rejectStubForTileTasks).toHaveBeenCalledOnce();
      expect(rejectStubForTileTasks).toHaveBeenCalledWith(
        task.jobId,
        task.id,
        true,
        `Unsupported seeding mode: testMode, should be one of: 'seed' or 'clean'`
      );
    });

    it('Should reject task and mark nonresettable when mapproxy seed reached max retries on invalid bbox error', async function () {
      const task = getTask();
      const job = getJob();
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'dequeue').mockResolvedValue(task);
      rejectStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSeedingTasks, 'reject').mockImplementation(async () => Promise.resolve());
      nock(jobManagerTestUrl).get(`/jobs/${task.jobId}?shouldReturnTasks=false`).reply(200, job); // internal job manager getJob request mocking
      nock(jobTrackerTestUrl).post(`/tasks/${task.id}/notify`).reply(200); // internal job tracker notify request mocking
      const sampleError = new ExceededMaxRetriesError('Reject task and mark nonresettable');
      const runTaskSpy = jest.spyOn(CacheSeedManager.prototype as unknown as { runTask: jest.Mock }, 'runTask').mockRejectedValue(sampleError);

      // action
      const action = async () => cacheSeedManager.handleCacheSeedTask();

      await expect(action()).resolves.not.toThrow();
      expect(dequeueStub).toHaveBeenCalledOnce();
      expect(runTaskSpy).toHaveBeenCalledOnce();
      expect(rejectStubForTileTasks).toHaveBeenCalledOnce();
      expect(rejectStubForTileTasks).toHaveBeenCalledWith(task.jobId, task.id, false, sampleError.message);
    });

    describe('#Delay', () => {
      it('Running timeout', async function () {
        jest.spyOn(CacheSeedManager.prototype as unknown as { delay: jest.Mock }, 'delay').mockRestore();

        // action
        const action = async () => cacheSeedManager.delay(0.001);

        await expect(action()).resolves.not.toThrow();
        expect(setTimeoutPromises).toHaveBeenCalledOnce();
        expect(setTimeoutPromises).toHaveBeenCalledWith(1);
      });
    });
  });
});
