import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
  id: string;
  label: string;
}

interface MobileMultiSelectProps {
  options: Option[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  headerText?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

/**
 * MobileMultiSelect
 *
 * Uses Popover for reliable mobile touch support.
 * Each row is a button with onClick for consistent tap handling.
 */
export const MobileMultiSelect = ({
  options,
  selectedIds,
  onToggle,
  placeholder = "Select items...",
  emptyMessage = "No items available",
  disabled = false,
  headerText,
  showSearch = true,
  searchPlaceholder = "Search...",
  className,
}: MobileMultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o.label] as const));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as string[];
  }, [options, selectedIds]);

  const triggerLabel = useMemo(() => {
    if (selectedIds.length === 0) return placeholder;
    if (selectedIds.length === 1) return "1 selected";
    return `${selectedIds.length} selected`;
  }, [placeholder, selectedIds.length]);

  const handleToggle = (id: string) => {
    onToggle(id);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-background"
          >
            <span className="text-sm truncate">{triggerLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className={cn(
            "w-[min(420px,calc(100vw-2rem))] p-0",
            "flex flex-col",
            "max-h-[60dvh]"
          )}
          align="start"
          sideOffset={4}
        >
          {/* Header */}
          <div className="shrink-0 p-2 border-b border-border bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground px-2">
              {headerText || `Select items (${options.length} total)`}
            </p>
          </div>

          {/* Search */}
          {showSearch && options.length > 10 && (
            <div className="shrink-0 p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              </div>
            </div>
          )}

          {/* List - scrollable */}
          <div
            className="flex-1 p-2 overflow-y-auto overscroll-contain touch-pan-y"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? "No matches found" : emptyMessage}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredOptions.map((opt) => {
                  const checked = selectedIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggle(opt.id)}
                      className={cn(
                        "relative flex w-full items-center rounded-sm px-2 py-2.5 text-sm outline-none",
                        "hover:bg-accent focus:bg-accent active:bg-accent",
                        "cursor-pointer select-none",
                        "transition-colors"
                      )}
                    >
                      <div className="flex items-center gap-2 pointer-events-none">
                        <Checkbox
                          checked={checked}
                          tabIndex={-1}
                          className="pointer-events-none"
                        />
                        <span className="truncate">{opt.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected badges */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((label) => {
            const option = options.find((o) => o.label === label);
            return (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
                <X
                  className="ml-1 h-3 w-3 cursor-pointer"
                  onClick={() => option && onToggle(option.id)}
                />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};
