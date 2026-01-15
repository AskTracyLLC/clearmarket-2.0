import { useState, useCallback, useMemo } from "react";

export interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
  totalItems?: number;
}

export interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  offset: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setTotalItems: (total: number) => void;
  resetToFirstPage: () => void;
  /** Range for Supabase .range() calls: [from, to] */
  range: [number, number];
}

/**
 * Generic pagination hook for list views.
 * Default page size: 20 items per page.
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { initialPage = 1, pageSize = 20, totalItems: initialTotal = 0 } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalItems, setTotalItems] = useState(initialTotal);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize]
  );

  const offset = useMemo(() => (currentPage - 1) * pageSize, [currentPage, pageSize]);

  const range: [number, number] = useMemo(
    () => [offset, offset + pageSize - 1],
    [offset, pageSize]
  );

  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const setPage = useCallback(
    (page: number) => {
      const safePage = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(safePage);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((p) => p + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setCurrentPage((p) => p - 1);
    }
  }, [hasPrevPage]);

  const resetToFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    offset,
    hasNextPage,
    hasPrevPage,
    setPage,
    nextPage,
    prevPage,
    setTotalItems,
    resetToFirstPage,
    range,
  };
}
