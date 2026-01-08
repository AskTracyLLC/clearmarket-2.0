import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "clearmarket-sidebar-collapsed";

interface UseSidebarStateResult {
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

/**
 * Hook to manage sidebar collapsed/expanded state with localStorage persistence.
 */
export function useSidebarState(): UseSidebarStateResult {
  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed.toString());
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => !prev);
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
  }, []);

  return {
    collapsed,
    toggleCollapsed,
    setCollapsed,
  };
}
