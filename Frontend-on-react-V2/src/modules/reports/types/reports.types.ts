export type ManagerFinanceSummaryDto = {
  managerName: string
  ordersCount: number
  totalSold: number
  totalPaid: number
  totalDebt: number
  collectionPercent: number
}

export type ManagerFinanceOrderDto = {
  orderId: number
  orderNumber: string
  orderDate: string
  customerName: string
  totalPrice: number
  paidAmount: number
  debtAmount: number
}

export type ManagerFinanceReportResponse = {
  summary: ManagerFinanceSummaryDto
  orders: ManagerFinanceOrderDto[]
}

export type ManagerFinanceQueryParams = {
  dateFrom: string
  dateTo: string
  managerId: number
}