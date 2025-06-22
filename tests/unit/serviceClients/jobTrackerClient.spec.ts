import jsLogger from '@map-colonies/js-logger';
import nock from 'nock';
import { ITaskResponse } from '@map-colonies/mc-priority-queue';
import { configMock, registerDefaultConfig } from '../../mocks/config';
import { JobTrackerClient } from '../../../src/clients/jobTrackerClient';
import { tracerMock } from '../../mocks/tracer';
import { notifyTask } from '../../mockData/mockTasksData';

describe('JobTrackerClient', () => {
  let jobTrackerClient: JobTrackerClient;
  let jobTrackerUrl: string;

  beforeEach(() => {
    registerDefaultConfig();
    jobTrackerUrl = configMock.get<string>('servicesUrl.jobTracker');
    jobTrackerClient = new JobTrackerClient(configMock, jsLogger({ enabled: false }), tracerMock);
  });

  afterEach(() => {
    nock.cleanAll();
    jest.resetAllMocks();
  });

  describe('notify', () => {
    it('should successfully notify job tracker about the task', async () => {
      const task: ITaskResponse<unknown> = notifyTask;

      const scope = nock(jobTrackerUrl).post(`/tasks/${task.id}/notify`).reply(200);

      await jobTrackerClient.notify(task.id);

      expect(scope.isDone()).toBe(true);
    });

    it('should throw an error when the notification request fails', async () => {
      const task: ITaskResponse<unknown> = notifyTask;
      // Setup nock to intercept the request and return an error response
      nock(jobTrackerUrl).post(`/tasks/${task.id}/notify`).reply(500, { error: 'Internal server error' });

      await expect(jobTrackerClient.notify(task.id)).rejects.toThrow();
    });

    it('should handle connection errors gracefully', async () => {
      const task: ITaskResponse<unknown> = notifyTask;

      nock(jobTrackerUrl).post(`/tasks/${task.id}/notify`).replyWithError('Connection refused');

      await expect(jobTrackerClient.notify(task.id)).rejects.toThrow();
    });
  });
});
