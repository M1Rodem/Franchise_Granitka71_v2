import { useQuery } from '@tanstack/react-query';
import { plotsApi } from '../api/plots.api';

export const plotsKeys = {
  all: ['plots'] as const,
};

export function usePlots() {
  return useQuery({
    queryKey: plotsKeys.all,
    queryFn: () => plotsApi.getPlots(false),
    staleTime: 1000 * 60 * 5,
  });
}