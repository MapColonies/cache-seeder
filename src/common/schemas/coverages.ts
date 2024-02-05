import { z } from 'zod';

const coverageTitleSchema = z.string();
const coverageContentSchema = z.object({
  datasource: z.string(),
  srs: z.string(),
});

const coverageRecord = z.record(coverageTitleSchema, coverageContentSchema);

export const coveragesSchema = z.object({ coverages: coverageRecord });
export type Coverage = z.infer<typeof coveragesSchema>;
