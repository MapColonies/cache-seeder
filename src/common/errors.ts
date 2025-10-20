export class ExceededMaxRetriesError extends Error {
  public constructor(message?: string) {
    super(message);
    this.name = 'ExceededMaxRetriesError';
  }
}
