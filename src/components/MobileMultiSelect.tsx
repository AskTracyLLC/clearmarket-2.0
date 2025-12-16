import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
 * Mobile-friendly multi-select dropdown with proper touch scrolling.
 * Features:
 * - Touch-optimized scrolling for iOS/Android
 * - Optional search filter for large lists
 * - Renders in portal to avoid parent overflow clipping
 * - Badge display of selected items
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

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  // Get labels for selected items
  const selectedLabels = useMemo(() => {
    return options
      .filter(opt => selectedIds.includes(opt.id))
      .map(opt => opt.label);
  }, [options, selectedIds]);

  const handleToggle = (id: string) => {
    onToggle(id);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-background"
            disabled={disabled}
          >
            <span className="text-sm truncate">
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : placeholder}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[min(400px,calc(100vw-2rem))] p-0 bg-popover border border-border z-[100]" 
          align="start"
          sideOffset={4}
          // Ensure portal rendering to avoid parent overflow clipping
          forceMount={open ? true : undefined}
        >
          {/* Header with count */}
          <div className="p-2 border-b border-border bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground px-2">
              {headerText || `Select items (${options.length} total)`}
            </p>
          </div>
          
          {/* Search filter */}
          {showSearch && options.length > 10 && (
            <div className="p-2 border-b border-border">
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
          
          {/* Scrollable list with mobile touch support */}
          <div
            className="bg-popover"
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
              <div className="p-2 space-y-1">
                {filteredOptions.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center space-x-2 p-2 rounded-sm hover:bg-accent active:bg-accent cursor-pointer select-none"
                    onClick={() => handleToggle(option.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(option.id)}
                      onCheckedChange={() => handleToggle(option.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="pointer-events-none"
                    />
                    <span className="text-sm">{option.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected badges */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((label) => {
            const option = options.find(o => o.label === label);
            return (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
                <X
                  className="ml-1 h-3 w-3 cursor-pointer"
                  onClick={() => option && handleToggle(option.id)}
                />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};
