import { httpClient } from '@/shared/api/http-client';
import { plotsSchema, type PlotDto } from '../types/plots.types';

export const plotsApi = {
  async getPlots(includeInactive = false): Promise<PlotDto[]> {
    const response = await httpClient.get('/api/plots', {
      params: { includeInactive },
    });

    return plotsSchema.parse(response.data);
  },

  async deletePlot(id: number) {
    await httpClient.delete(`/api/plots/${id}`)
  },

  async createPlot(data: {
    name: string
    description?: string | null
    latitude: number
    longitude: number
    isActive?: boolean
  }) {
    const response = await httpClient.post('/api/plots', {
      name: data.name,
      description: data.description ?? null,
      latitude: data.latitude,
      longitude: data.longitude,
      isActive: data.isActive ?? true,
    })

    return response.data
  }
};