import { Tracing } from '@map-colonies/tracing';
import type { Link } from '@opentelemetry/api';
import type { ITraceParentContext } from './interfaces';

let tracing: Tracing | undefined;

export function tracingFactory(options: ConstructorParameters<typeof Tracing>[0]): Tracing {
  tracing = new Tracing({
    ...options,
    autoInstrumentationsConfigMap: {
      '@opentelemetry/instrumentation-http': {
        requireParentforOutgoingSpans: true,
      },
      '@opentelemetry/instrumentation-fs': {
        requireParentSpan: true,
      },
    },
  });

  return tracing;
}

export function getTracing(): Tracing {
  if (!tracing) {
    throw new Error('tracing not initialized');
  }
  return tracing;
}

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
  const spanLinks: Link[] = [{ context: { spanId: parts[2]!, traceFlags: parseInt(parts[3]!), traceId: parts[1]! } }];
  return spanLinks;
};
