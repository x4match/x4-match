'use client';

import { useEffect, useMemo, useState } from 'react';

export function useTableFilters<T extends Record<string, string>>(
  defaults: T,
  options?: { debounceMs?: number },
) {
  const debounceMs = options?.debounceMs ?? 300;
  const [filters, setFilters] = useState<T>(defaults);
  const [debounced, setDebounced] = useState<T>(defaults);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(filters), debounceMs);
    return () => clearTimeout(timer);
  }, [filters, debounceMs]);

  const setFilter = (key: keyof T, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(defaults);
    setDebounced(defaults);
  };

  const hasActiveFilters = useMemo(
    () => Object.keys(defaults).some((key) => filters[key as keyof T] !== defaults[key as keyof T]),
    [filters, defaults],
  );

  const apiParams = useMemo(() => {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(debounced)) {
      if (value) params[key] = value;
    }
    return params;
  }, [debounced]);

  return { filters, setFilter, resetFilters, hasActiveFilters, apiParams };
}
