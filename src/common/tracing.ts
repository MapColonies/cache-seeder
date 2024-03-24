import { Tracing } from '@map-colonies/telemetry';
import { SpanOptions } from '@opentelemetry/api';
import * as api from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ITraceParentContext } from './interfaces';
import { SERVICE_NAME, SERVICE_VERSION } from './constants';

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
  { serviceName: SERVICE_NAME, serviceVersion: SERVICE_VERSION }
);

export const getSpanLinkOption = (context: ITraceParentContext): SpanOptions => {
  if (context.traceparent === undefined) {
    throw Error(`TraceParentContext is undefined`);
  }
  const parts = context.traceparent.split('-');
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  if (parts.length !== 4) {
    const invalidParts = `${parts.join('|')}`;
    throw Error(`TraceParentContext include not valid traceparent object: ${invalidParts}`);
  }
  const spanOptions: SpanOptions = { links: [{ context: { spanId: parts[2], traceFlags: parseInt(parts[3]), traceId: parts[1] } }] };
  return spanOptions;
};
