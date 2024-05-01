/* eslint-disable @typescript-eslint/no-magic-numbers */
import { IJobResponse, ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';
import { ITaskParams } from '../../src/common/interfaces';
import { CacheType, SeedMode } from '../../src/common/enums';

const task = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  status: OperationStatus.PENDING,
  percentage: 0,
  description: '',
  created: '',
  reason: '',
  updated: '',
  jobId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
  type: 'testTye',
  attempts: 0,
  parameters: {
    seedTasks: [
      {
        grid: 'wgs84',
        mode: SeedMode.SEED,
        layerId: 'test',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [35.079988132, 32.479045006],
              [35.149688132, 32.479045006],
              [35.149688132, 32.424145006],
              [35.079988132, 32.424145006],
              [35.079988132, 32.479045006],
            ],
          ],
        },
        toZoomLevel: 21,
        skipUncached: true,
        fromZoomLevel: 0,
        refreshBefore: '2025-01-16T16:14:22',
      },
      {
        grid: 'wgs84',
        mode: SeedMode.CLEAN,
        layerId: 'test',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [35.079988132, 32.479045006],
              [35.149688132, 32.479045006],
              [35.149688132, 32.424145006],
              [35.079988132, 32.424145006],
              [35.079988132, 32.479045006],
            ],
          ],
        },
        toZoomLevel: 21,
        skipUncached: true,
        fromZoomLevel: 0,
        refreshBefore: '2025-01-16T16:14:22',
      },
    ],
    catalogId: 'bf60bc17-aa2e-49df-9478-98b783b47b68',
    traceParentContext: {
      traceparent: "00-cf79cb9964bce24d461321db4fdce4da-8eedc8e68d60730c-01"
    },
    cacheType: CacheType.REDIS,
  },
  resettable: false,
} as unknown as ITaskResponse<ITaskParams>;

function getTask(): ITaskResponse<ITaskParams> {
  return task;
}

const job: IJobResponse<unknown, unknown> = {
  id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
  resourceId: 'someTestSeed',
  version: '1.0',
  type: 'TilesSeeding',
  description: 'someTestSeed',
  parameters: {},
  status: OperationStatus.IN_PROGRESS,
  percentage: 0,
  reason: '',
  domain: 'RASTER',
  isCleaned: false,
  priority: 1000,
  expirationDate: new Date(Date.now()),
  internalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  producerName: 'string',
  productName: 'string',
  productType: 'string',
  additionalIdentifiers: 'string',
  taskCount: 1,
  completedTasks: 0,
  failedTasks: 0,
  expiredTasks: 0,
  pendingTasks: 0,
  inProgressTasks: 1,
  abortedTasks: 0,
  created: '2024-01-16T16:21:53.020Z',
  updated: '2024-01-16T16:21:53.020Z',
};

function getJob(): IJobResponse<unknown, unknown> {
  return job;
}

export { getTask, getJob };
