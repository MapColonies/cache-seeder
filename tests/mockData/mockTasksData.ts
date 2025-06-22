import { faker } from "@faker-js/faker";
import { ITaskResponse, OperationStatus } from "@map-colonies/mc-priority-queue";

export const notifyTask: ITaskResponse<unknown> = {
    id: faker.string.uuid(),
    type: 'test-task',
    description: 'Test task for unit testing',
    parameters: {},
    status: OperationStatus.IN_PROGRESS,
    percentage: 50,
    reason: '',
    attempts: 1,
    jobId: faker.string.uuid(),
    resettable: false,
    created: faker.date.past().toISOString(),
    updated: faker.date.recent().toISOString(),
  };
