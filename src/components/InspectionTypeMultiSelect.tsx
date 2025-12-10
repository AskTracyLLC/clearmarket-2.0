import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InspectionTypeOption,
  InspectionCategory,
  fetchInspectionTypesForRole,
  fetchInspectionCategories,
} from "@/lib/inspectionTypes";

interface InspectionTypeMultiSelectProps {
  role: 'rep' | 'vendor';
  selectedLabels: string[]; // Store/pass labels for backward compatibility
  onChange: (labels: string[]) => void;
  error?: string;
}

export function InspectionTypeMultiSelect({
  role,
  selectedLabels,
  onChange,
  error,
}: InspectionTypeMultiSelectProps) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<InspectionCategory[]>([]);
  const [grouped, setGrouped] = useState<Record<string, InspectionTypeOption[]>>({});
  const [allOptions, setAllOptions] = useState<InspectionTypeOption[]>([]);

  useEffect(() => {
    loadOptions();
  }, [role]);

  const loadOptions = async () => {
    setLoading(true);
    const [cats, data] = await Promise.all([
      fetchInspectionCategories(),
      fetchInspectionTypesForRole(role)
    ]);
    setCategories(cats);
    setGrouped(data);
    setAllOptions(Object.values(data).flat());
    setLoading(false);
  };

  const handleToggle = (label: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedLabels, label]);
    } else {
      onChange(selectedLabels.filter(l => l !== label));
    }
  };

  // NOTE: Legacy inspection type values (old broad categories) are intentionally
  // ignored and not displayed. Users must reselect from the new detailed options.

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map(category => {
        const options = grouped[category.label] || [];
        
        // Only show category if there are active options or selected ones
        const hasActiveOptions = options.some(opt => opt.is_active);
        const hasSelectedOptions = options.some(opt => selectedLabels.includes(opt.label));
        
        if (!hasActiveOptions && !hasSelectedOptions) {
          return null;
        }

        return (
          <div key={category.id} className="space-y-3">
            <h4 className="font-medium text-sm text-foreground border-b border-border pb-1">
              {category.label}
              {category.description && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  — {category.description}
                </span>
              )}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.map(opt => {
                const isSelected = selectedLabels.includes(opt.label);
                // Show option if active OR if already selected (even if inactive)
                if (!opt.is_active && !isSelected) return null;

                return (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleToggle(opt.label, !!checked)}
                    />
                    <span className="text-sm">
                      {opt.label}
                      {!opt.is_active && (
                        <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">
                          inactive
                        </Badge>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legacy inspection type values are no longer displayed.
          Users must select from the new categorized options above. */}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
