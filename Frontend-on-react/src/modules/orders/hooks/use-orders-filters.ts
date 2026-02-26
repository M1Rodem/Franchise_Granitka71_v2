import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_ORDERS_PAGE,
  DEFAULT_ORDERS_PAGE_SIZE,
} from '@/modules/orders/lib/orders-filters';
import type { OrdersFilterParams, OrdersListQueryParams } from '@/modules/orders/types/orders.types';

const parsePositiveInt = (value: string | null, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNullableInt = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value: string | null): string => {
  if (!value) {
    return '';
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
};

const filterParamKeys = ['search', 'from', 'to', 'plotId', 'paymentStatus', 'completionStatus'] as const;

export function useOrdersFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<OrdersFilterParams>(
    () => ({
      searchQuery: searchParams.get('search')?.trim() ?? '',
      dateFrom: parseDate(searchParams.get('from')),
      dateTo: parseDate(searchParams.get('to')),
      plotId: parseNullableInt(searchParams.get('plotId')),
      paymentStatus: parseNullableInt(searchParams.get('paymentStatus')),
      completionStatus: parseNullableInt(searchParams.get('completionStatus')),
    }),
    [searchParams.toString()],
  );

  const page = parsePositiveInt(searchParams.get('page'), DEFAULT_ORDERS_PAGE);
  const pageSize = parsePositiveInt(searchParams.get('pageSize'), DEFAULT_ORDERS_PAGE_SIZE);

  const queryParams = useMemo<OrdersListQueryParams>(
    () => ({
      ...filters,
      page,
      pageSize,
    }),
    [filters, page, pageSize],
  );

  const patchFilterParams = (patch: Partial<OrdersFilterParams>) => {
    const next = new URLSearchParams(searchParams);

    const applyText = (key: string, value: string | undefined) => {
      if (value && value.trim()) {
        next.set(key, value.trim());
      } else {
        next.delete(key);
      }
    };

    const applyNullableInt = (key: string, value: number | null | undefined) => {
      if (value !== null && value !== undefined) {
        next.set(key, String(value));
      } else {
        next.delete(key);
      }
    };

    if ('searchQuery' in patch) {
      applyText('search', patch.searchQuery);
    }

    if ('dateFrom' in patch) {
      applyText('from', patch.dateFrom);
    }

    if ('dateTo' in patch) {
      applyText('to', patch.dateTo);
    }

    if ('plotId' in patch) {
      applyNullableInt('plotId', patch.plotId);
    }

    if ('paymentStatus' in patch) {
      applyNullableInt('paymentStatus', patch.paymentStatus);
    }

    if ('completionStatus' in patch) {
      applyNullableInt('completionStatus', patch.completionStatus);
    }

    next.set('page', String(DEFAULT_ORDERS_PAGE));
    next.set('pageSize', String(pageSize));

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  };

  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);

    for (const key of filterParamKeys) {
      next.delete(key);
    }

    next.set('page', String(DEFAULT_ORDERS_PAGE));
    next.set('pageSize', String(pageSize));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  };

  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(Math.max(DEFAULT_ORDERS_PAGE, nextPage)));
    next.set('pageSize', String(pageSize));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  };

  return {
    filters,
    page,
    pageSize,
    queryParams,
    patchFilterParams,
    resetFilters,
    setPage,
  };
}
