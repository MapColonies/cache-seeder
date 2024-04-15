import jsLogger from '@map-colonies/js-logger';
import { configMock, init as initConfig, clear as clearConfig } from '../../mocks/config';
import { getApp } from '../../../src/app';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { MapproxySeed } from '../../../src/mapproxyUtils/mapproxySeed';
import { MapproxyConfigClient } from '../../../src/clients/mapproxyConfig';
import { tracerMock } from '../../mocks/tracer';

let mapproxyConfigClient: MapproxyConfigClient;
let mapproxySeed: MapproxySeed;

describe('#SeedProgressFunction', () => {
  beforeEach(function () {
    initConfig();

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
  });

  describe('#Handle stream data', () => {
    it('running single progress line - tiles', async function () {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
      await mapproxySeed.seedProgressFunc('(0 tiles)');
      expect(abortSpy).toBeCalledTimes(0);
    });

    it('running single progress line - no relevant info', async function () {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
      await mapproxySeed.seedProgressFunc('regular stdout message');
      expect(abortSpy).toBeCalledTimes(0);
    });

    it('running single progress line: - ERROR - ', async function () {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
      const errMsg = 'some bad process msg';
      await mapproxySeed.seedProgressFunc(`- ERROR -${errMsg}`);
      expect(abortSpy).toBeCalledTimes(1);
      expect(abortSpy).toBeCalledWith(`${errMsg}`);
    });

    it('running single progress line - configuration error ', async function () {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
      const errMsg = 'error in configuration: some dummy test msg';
      await mapproxySeed.seedProgressFunc(errMsg);
      expect(abortSpy).toBeCalledTimes(1);
      expect(abortSpy).toBeCalledWith(`${errMsg}`);
    });
  });
});
