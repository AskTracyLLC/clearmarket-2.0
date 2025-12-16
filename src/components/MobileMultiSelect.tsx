import { useMemo, useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
 * Uses Radix Select under the hood (same interaction model as our State dropdown),
 * but keeps the menu open for multi-select by preventing default selection behavior.
 *
 * This avoids iOS/Android scroll-lock issues seen with nested popovers inside dialogs.
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

  return (
    <div className={cn("space-y-2", className)}>
      <SelectPrimitive.Root open={open} onOpenChange={setOpen} value="__multi__">
        <SelectPrimitive.Trigger asChild disabled={disabled}>
          <Button variant="outline" className="w-full justify-between bg-background">
            <span className="text-sm truncate">{triggerLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
          </Button>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            align="start"
            className={cn(
              "relative z-50 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
            )}
          >
            {/* Header */}
            <div className="p-2 border-b border-border bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground px-2">
                {headerText || `Select items (${options.length} total)`}
              </p>
            </div>

            {/* Search */}
            {showSearch && options.length > 10 && (
              <div className="p-2 border-b border-border bg-popover">
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
                    onKeyDown={(e) => {
                      // Prevent Select typeahead from stealing focus / closing
                      e.stopPropagation();
                    }}
                  />
                </div>
              </div>
            )}

            {/* Scrollable list (critical for mobile) */}
            <SelectPrimitive.Viewport
              className="p-2"
              style={{
                maxHeight: "min(60vh, 360px)",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
                overscrollBehavior: "contain",
              }}
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
                      <SelectPrimitive.Item
                        key={opt.id}
                        value={opt.id}
                        // Prevent Radix Select from closing on selection
                        onSelect={(e) => {
                          e.preventDefault();
                          onToggle(opt.id);
                        }}
                        className={cn(
                          "relative flex w-full select-none items-center rounded-sm px-2 py-2 text-sm outline-none",
                          "hover:bg-accent focus:bg-accent",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox checked={checked} className="pointer-events-none" />
                          <span className="truncate">{opt.label}</span>
                        </div>
                      </SelectPrimitive.Item>
                    );
                  })}
                </div>
              )}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

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
