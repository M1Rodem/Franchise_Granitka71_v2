import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { httpClient } from '@/shared/api/http-client';
import type { PlotFilterOption } from '@/modules/orders/types/orders.types';

const plotCamelSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
  })
  .passthrough();

const plotPascalSchema = z
  .object({
    Id: z.number().int(),
    Name: z.string(),
  })
  .passthrough()
  .transform((value) => ({
    id: value.Id,
    name: value.Name,
  }));

const plotsSchema = z.array(z.union([plotCamelSchema, plotPascalSchema]));

const getPlotsFilterOptions = async (): Promise<PlotFilterOption[]> => {
  const response = await httpClient.get('/api/plots/all');
  return plotsSchema.parse(response.data);
};

export function useOrdersFilterOptions() {
  return useQuery({
    queryKey: ['orders', 'filters', 'plots'],
    queryFn: getPlotsFilterOptions,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}