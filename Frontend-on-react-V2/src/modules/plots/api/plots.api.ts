import { httpClient } from '@/shared/api/http-client';
import type { PlotDto } from '../types/plots.types';

export const plotsApi = {
  async getPlots(
    page: number,
    pageSize: number,
    search?: string,
    includeInactive = false
  ): Promise<{ items: PlotDto[]; total: number }> {
    const response = await httpClient.get('/plots', {
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
    await httpClient.delete(`/plots/${id}`)
  },

  async createPlot(data: {
    name: string
    description?: string | null
    latitude: number
    longitude: number
    isActive?: boolean
  }) {
    const response = await httpClient.post('/plots', {
      name: data.name,
      description: data.description ?? null,
      latitude: data.latitude,
      longitude: data.longitude,
      isActive: data.isActive ?? true,
    })

    return response.data
  },
  async getPlotsOptions(): Promise<PlotDto[]> {
    const response = await httpClient.get('/plots', {
      params: {
        page: 1,
        pageSize: 1000,
      },
    })

    return response.data.items
  },
  async getAllPlots(): Promise<PlotDto[]> {
    const response = await httpClient.get('/plots/all')
    return response.data
  }
};