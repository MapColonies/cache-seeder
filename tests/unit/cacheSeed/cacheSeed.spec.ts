import jsLogger from '@map-colonies/js-logger';
import { DependencyContainer } from 'tsyringe';
import { CacheSeedManager } from '../../../src/cacheSeed/cacheSeedManager';
import { configMock, init as initConfig, clear as clearConfig } from '../../mocks/config';
import { initAxiosMock } from '../../mocks/axiosMock';
import { registerExternalValues } from '../testContainerConfig';
import { QueueClient } from '../../../src/clients/queueClient';
import { MapproxySeed } from '../../../src/mapproxyUtils/mapproxySeed';


let container: DependencyContainer;
let queueClient: QueueClient;

let cacheSeedManager: CacheSeedManager;
let mapproxySeed: MapproxySeed;

describe('CacheSeedManager', () => {
  beforeEach(function () {
    initConfig();
    initAxiosMock();

    container = registerExternalValues({ useChild: true });
    queueClient = container.resolve(QueueClient);
    mapproxySeed = new MapproxySeed(jsLogger({ enabled: false }),configMock);
    cacheSeedManager = new CacheSeedManager(jsLogger({ enabled: false }),configMock,queueClient,mapproxySeed);
  });
  describe('#HandleSeedTasks', () => {
    it('return the resource of id 1', async function () {
      const runSeedSpy = jest.spyOn(MapproxySeed.prototype, 'runSeed');
      // action
      const action = async () => {
        await cacheSeedManager.handleCacheSeedTask();
      };
      await expect(action()).resolves.not.toThrow();
      expect(runSeedSpy).toHaveBeenCalledTimes(1);
      expect(runSeedSpy).toHaveBeenCalledWith({id:'testId'});
    });
  });
});
