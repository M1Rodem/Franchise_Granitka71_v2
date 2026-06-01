import { httpClient } from '@/shared/api/http-client'

import type {
  ManagerFinanceQueryParams,
  ManagerFinanceReportResponse,
} from '../types/reports.types'

const toUtcStartOfDay = (value: string) =>
  `${value}T00:00:00Z`

export const reportsApi = {
  async getManagerFinanceReport(
    params: ManagerFinanceQueryParams
  ): Promise<ManagerFinanceReportResponse> {
    const response = await httpClient.get(
      '/Reports/manager-finance',
      {
        params: {
          dateFrom: toUtcStartOfDay(params.dateFrom),
          dateTo: toUtcStartOfDay(params.dateTo),
          managerId: params.managerId,
        },
      }
    )

    return response.data
  },
}