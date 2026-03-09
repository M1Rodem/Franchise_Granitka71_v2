import { httpClient } from '@/shared/api/http-client';
import type { PlotDto } from '../types/plots.types';

export const plotsApi = {
  async getPlots(
    page: number,
    pageSize: number,
    search?: string,
    includeInactive = false
  ): Promise<{ items: PlotDto[]; total: number }> {
    const response = await httpClient.get('/api/plots', {
      params: {
        page,
        pageSize,
        includeInactive,
        search: search || undefined,
      },
    });

    return response.data;
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
  },
  async getPlotsOptions(): Promise<PlotDto[]> {
    const response = await httpClient.get('/api/plots', {
      params: {
        page: 1,
        pageSize: 1000,
      },
    })

    return response.data.items
  },
  async getAllPlots(): Promise<PlotDto[]> {
    const response = await httpClient.get('/api/plots/all')
    return response.data
  }
};