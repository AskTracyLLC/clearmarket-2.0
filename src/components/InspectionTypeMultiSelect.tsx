import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InspectionTypeOption,
  INSPECTION_TYPE_CATEGORIES,
  fetchInspectionTypesForRole,
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
  const [grouped, setGrouped] = useState<Record<string, InspectionTypeOption[]>>({});
  const [allOptions, setAllOptions] = useState<InspectionTypeOption[]>([]);

  useEffect(() => {
    loadOptions();
  }, [role]);

  const loadOptions = async () => {
    setLoading(true);
    const data = await fetchInspectionTypesForRole(role);
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

  // Find labels that don't match any option (legacy values)
  const knownLabels = new Set(allOptions.map(opt => opt.label));
  const legacyValues = selectedLabels.filter(label => 
    !knownLabels.has(label) && !label.startsWith("Other:")
  );

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
      {INSPECTION_TYPE_CATEGORIES.map(category => {
        const options = grouped[category] || [];
        
        // Only show category if there are active options or selected ones
        const hasActiveOptions = options.some(opt => opt.is_active);
        const hasSelectedOptions = options.some(opt => selectedLabels.includes(opt.label));
        
        if (!hasActiveOptions && !hasSelectedOptions) {
          return null;
        }

        return (
          <div key={category} className="space-y-3">
            <h4 className="font-medium text-sm text-foreground border-b border-border pb-1">
              {category}
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

      {/* Show legacy values that don't map to any option */}
      {legacyValues.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground border-b border-border pb-1">
            Legacy Values
          </h4>
          <div className="flex flex-wrap gap-2">
            {legacyValues.map((val, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {val}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            These values were set before the new inspection types system. They will continue to work.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
