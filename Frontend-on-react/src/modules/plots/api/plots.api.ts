import { httpClient } from '@/shared/api/http-client';
import { plotsSchema, type PlotDto } from '../types/plots.types';

export const plotsApi = {
  async getPlots(includeInactive = false): Promise<PlotDto[]> {
    const response = await httpClient.get('/api/plots', {
      params: { includeInactive },
    });

    return plotsSchema.parse(response.data);
  },
};