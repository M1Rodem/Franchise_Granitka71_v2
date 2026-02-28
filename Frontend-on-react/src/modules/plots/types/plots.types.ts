import { z } from 'zod';

const plotCamelSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable().optional(),
  latitude: z.number(),
  longitude: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

const plotPascalSchema = z.object({
  Id: z.number().int(),
  Name: z.string(),
  Description: z.string().nullable().optional(),
  Latitude: z.number(),
  Longitude: z.number(),
  IsActive: z.boolean(),
  CreatedAt: z.string(),
  UpdatedAt: z.string(),
}).passthrough().transform((v) => ({
  id: v.Id,
  name: v.Name,
  description: v.Description,
  latitude: v.Latitude,
  longitude: v.Longitude,
  isActive: v.IsActive,
  createdAt: v.CreatedAt,
  updatedAt: v.UpdatedAt,
}));

export const plotSchema = z.union([plotCamelSchema, plotPascalSchema]);

export const plotsSchema = z.array(plotSchema);

export type PlotDto = z.infer<typeof plotSchema>;