import { Tracing } from '@map-colonies/telemetry';
import { Link } from '@opentelemetry/api';
import * as api from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { SEMRESATTRS_PROCESS_RUNTIME_NAME, SEMRESATTRS_PROCESS_RUNTIME_VERSION } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ITraceParentContext } from './interfaces';
import { NODE_VERSION } from './constants';

const contextManager = new AsyncHooksContextManager();
contextManager.enable();
api.context.setGlobalContextManager(contextManager);

export const tracing = new Tracing(
  [new HttpInstrumentation({ requireParentforOutgoingSpans: true })],
  {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '@opentelemetry/instrumentation-express': { enabled: false },
  },
  // todo - after architecture design understand which global shared attributes also to add
  // eslint-disable-next-line @typescript-eslint/naming-convention
  { [SEMRESATTRS_PROCESS_RUNTIME_NAME]: 'nodejs', [SEMRESATTRS_PROCESS_RUNTIME_VERSION]: NODE_VERSION }
);

export const getSpanLinkOption = (context: ITraceParentContext): Link[] => {
  if (context.traceparent === undefined) {
    throw Error(`TraceParentContext is undefined`);
  }
  const parts = context.traceparent.split('-');
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  if (parts.length !== 4) {
    const invalidParts = `${parts.join('|')}`;
    throw Error(`TraceParentContext include not valid traceparent object: ${invalidParts}`);
  }
  console.log(parts, '**********');
  const spanLinks: Link[] = [{ context: { spanId: parts[2], traceFlags: parseInt(parts[3]), traceId: parts[1] } }];
  return spanLinks;
};
