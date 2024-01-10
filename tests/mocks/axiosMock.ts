//requests mocks
const getMock = jest.fn().mockResolvedValue({ data: undefined });
const postMock = jest.fn();
const putMock = jest.fn();
const patchMock = jest.fn();
const deleteMock = jest.fn();
const headMock = jest.fn();
const optionsMock = jest.fn();

//other functions mocks
const createMock = jest.fn();

//module mock
const axiosMocks = {
  get: getMock,
  post: postMock,
  put: putMock,
  patch: patchMock,
  delete: deleteMock,
  head: headMock,
  options: optionsMock,
  create: createMock,
};

const initAxiosMock = (): void => {
  createMock.mockReturnValue(axiosMocks);
};

export { axiosMocks, initAxiosMock };
