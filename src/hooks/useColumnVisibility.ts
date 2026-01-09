import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ColumnDefinition {
  id: string;
  label: string;
  description?: string;
  required?: boolean; // If true, column cannot be hidden
}

interface UseColumnVisibilityOptions {
  tableKey: string;
  columns: ColumnDefinition[];
  defaultVisibleColumns?: string[];
}

export function useColumnVisibility({
  tableKey,
  columns,
  defaultVisibleColumns,
}: UseColumnVisibilityOptions) {
  const { user } = useAuth();
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    defaultVisibleColumns || columns.map((c) => c.id)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences from database
  useEffect(() => {
    async function loadPreferences() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_table_preferences")
          .select("visible_columns")
          .eq("user_id", user.id)
          .eq("table_key", tableKey)
          .maybeSingle();

        if (error) {
          console.error("Error loading column preferences:", error);
        } else if (data?.visible_columns) {
          // Ensure required columns are always visible
          const requiredCols = columns.filter((c) => c.required).map((c) => c.id);
          const savedCols = data.visible_columns as string[];
          
          // Filter out old column IDs that no longer exist
          const validColumnIds = columns.map((c) => c.id);
          const validSavedCols = savedCols.filter((id) => validColumnIds.includes(id));
          
          // Add new default columns that weren't in the saved preferences
          // (so users see new features without manually resetting)
          const defaults = defaultVisibleColumns || columns.map((c) => c.id);
          const newDefaultCols = defaults.filter(
            (id) => !savedCols.includes(id) && validColumnIds.includes(id)
          );
          
          const mergedCols = [...new Set([...requiredCols, ...validSavedCols, ...newDefaultCols])];
          setVisibleColumns(mergedCols);
        }
      } catch (err) {
        console.error("Error loading preferences:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [user?.id, tableKey, columns]);

  // Save preferences to database
  const savePreferences = useCallback(
    async (newVisibleColumns: string[]) => {
      if (!user?.id) return;

      setIsSaving(true);
      try {
        // Ensure required columns are always included
        const requiredCols = columns.filter((c) => c.required).map((c) => c.id);
        const finalCols = [...new Set([...requiredCols, ...newVisibleColumns])];

        const { error } = await supabase
          .from("user_table_preferences")
          .upsert(
            {
              user_id: user.id,
              table_key: tableKey,
              visible_columns: finalCols,
            },
            { onConflict: "user_id,table_key" }
          );

        if (error) {
          console.error("Error saving column preferences:", error);
          throw error;
        }

        setVisibleColumns(finalCols);
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id, tableKey, columns]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    const defaults = defaultVisibleColumns || columns.map((c) => c.id);
    await savePreferences(defaults);
  }, [defaultVisibleColumns, columns, savePreferences]);

  // Check if a column is visible
  const isColumnVisible = useCallback(
    (columnId: string) => visibleColumns.includes(columnId),
    [visibleColumns]
  );

  // Toggle column visibility (used by the chooser UI)
  const toggleColumn = useCallback(
    (columnId: string) => {
      const column = columns.find((c) => c.id === columnId);
      if (column?.required) return; // Cannot toggle required columns

      setVisibleColumns((prev) =>
        prev.includes(columnId)
          ? prev.filter((id) => id !== columnId)
          : [...prev, columnId]
      );
    },
    [columns]
  );

  return {
    visibleColumns,
    setVisibleColumns,
    isColumnVisible,
    toggleColumn,
    savePreferences,
    resetToDefaults,
    isLoading,
    isSaving,
    columns,
  };
}
