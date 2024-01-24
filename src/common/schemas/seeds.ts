/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/naming-convention */
import { z } from 'zod';

interface SeedLevels {
  from: number;
  to: number;
}

const validZoomLevels = (levels: SeedLevels): boolean => {
  return levels.from <= levels.to;
};

const refreshBeforeSchema = {
  time: z.string(),
};

const levelsSchema = {
  from: z.number().min(0).max(23),
  to: z.number().min(0).max(23),
};

const seedTitleSchema = z.string();
const cleanTitleSchema = z.string();

const invalidZoomLevelsMessage = 'levels.from value can not bigger than levels.to';

const baseContentSchema = z.object({
  caches: z.array(z.string()),
  coverages: z.array(z.string()),
  grids: z.array(z.string()),
  levels: z.object(levelsSchema).refine(validZoomLevels, { message: invalidZoomLevelsMessage }),
});

const seedContentSchema = baseContentSchema.extend({ refresh_before: z.object(refreshBeforeSchema) });
const cleanupContentSchema = baseContentSchema.extend({ remove_before: z.object(refreshBeforeSchema) });

const seedRecord = z.record(seedTitleSchema, seedContentSchema);
const cleanupRecord = z.record(cleanTitleSchema, cleanupContentSchema);

export const baseSchema = baseContentSchema;
export const seedsSchema = z.object({ seeds: seedRecord });
export const cleanupsSchema = z.object({ cleanups: cleanupRecord });

export type Seed = z.infer<typeof seedsSchema>;
export type Cleanup = z.infer<typeof cleanupsSchema>;
export type BaseCache = z.infer<typeof baseContentSchema>;
