import { spawn } from 'node:child_process';

let spawned = false;
let stdErrStr = '';

export async function runCommand(
  commandName: string,
  args: string[],
  options: { onProgress?: (line: string) => void; abortSignal?: AbortSignal }
): Promise<void> {
  return new Promise((resolve, reject) => {
    let error: Error | undefined = undefined;

    const runCommand = spawn(commandName, args, {
      signal: options.abortSignal,
      killSignal: 'SIGINT',
      detached: false,
    });

    runCommand.stdout.on('data', (data: Buffer) => {
      // if not onProgress function was provided - will execute shell on silence execution
      if (options.onProgress) {
        options.onProgress(data.toString('utf8'));
      }
    });

    runCommand.stderr.on('data', (data: Buffer) => {
      const stdErrArr = data.toString('utf-8').trim().split('\n');
      stdErrStr = stdErrArr[stdErrArr.length - 1];
    });

    runCommand.once('exit', (code) => {
      // handle internal logic of abort cases (inside the progress function)
      if (options.abortSignal?.aborted !== undefined && options.abortSignal.aborted) {
        const errReason: string = options.abortSignal.reason as string;
        return reject(new Error(`Interrupted because shell abort: ${errReason}`));
      }

      // handle executions with errors
      if (error) {
        return reject(new Error(`Interrupted because process error: ${error.message}`));
      }

      // catch and handle not correct execution (on success exit code = 0)
      if (code !== null && code > 0) {
        const errStr = `Command failed with error [${stdErrStr}], status code: ${code}`;
        return reject(new Error(errStr));
      }
      // success shell execution
      return resolve();
    });

    // initialization of new spawn
    runCommand.once('spawn', () => {
      spawned = true;
    });

    runCommand.on('error', (err) => {
      if (!spawned) {
        // on case of shell error (example: no mapproxy-seed installed) it should be rejected on error event
        return reject(new Error(`Shell error: ${err.message}`));
      }
      // spawn was opened and the error will be handled on exit event
      error = err;
    });
  });
}
