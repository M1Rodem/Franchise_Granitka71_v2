export interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PagingResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
