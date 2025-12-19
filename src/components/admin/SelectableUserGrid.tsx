import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X } from "lucide-react";
import { AudienceUser } from "@/lib/adminBroadcasts";

interface SelectableUserGridProps {
  title: string;
  users: AudienceUser[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onSelectNone: (ids: string[]) => void;
  loading?: boolean;
}

export function SelectableUserGrid({
  title,
  users,
  selectedIds,
  onToggle,
  onSelectAll,
  onSelectNone,
  loading = false,
}: SelectableUserGridProps) {
  const [search, setSearch] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let result = users;
    
    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter((u) => {
        const fullName = (u.full_name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        return fullName.includes(searchLower) || email.includes(searchLower);
      });
    }
    
    // Apply "show selected only" filter
    if (showSelectedOnly) {
      result = result.filter((u) => selectedIds.includes(u.id));
    }
    
    // Sort alphabetically by name (A-Z)
    result = [...result].sort((a, b) => {
      const nameA = (a.full_name || a.email || "").toLowerCase();
      const nameB = (b.full_name || b.email || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    return result;
  }, [users, search, showSelectedOnly, selectedIds]);

  // Count selected in this section
  const selectedCount = useMemo(() => {
    return users.filter((u) => selectedIds.includes(u.id)).length;
  }, [users, selectedIds]);

  // Format user label
  const formatLabel = (user: AudienceUser): string => {
    if (user.full_name) {
      return user.full_name;
    }
    return user.email || "Unknown User";
  };

  const handleSelectAll = () => {
    const ids = filteredUsers.map((u) => u.id);
    onSelectAll(ids);
  };

  const handleSelectNone = () => {
    const ids = users.map((u) => u.id);
    onSelectNone(ids);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{title}</h4>
        </div>
        <div className="py-8 text-center text-muted-foreground text-sm">
          Loading users...
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{title}</h4>
        </div>
        <div className="py-8 text-center text-muted-foreground text-sm">
          No {title.toLowerCase()} match the current filters.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with title and controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h4 className="font-medium text-sm">{title}</h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={filteredUsers.length === 0}
            className="text-xs h-7"
          >
            Select All ({filteredUsers.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectNone}
            disabled={selectedCount === 0}
            className="text-xs h-7"
          >
            Select None
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`show-selected-${title}`}
            checked={showSelectedOnly}
            onCheckedChange={(checked) => setShowSelectedOnly(checked === true)}
          />
          <label
            htmlFor={`show-selected-${title}`}
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Show selected only
          </label>
        </div>
      </div>

      {/* User grid */}
      <ScrollArea className="h-64 border rounded-md bg-background">
        {filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            {search ? "No users match your search." : "No users to display."}
          </div>
        ) : (
          <div className="p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
            {filteredUsers.map((user) => {
              const isSelected = selectedIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => onToggle(user.id)}
                  className={`
                    flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors
                    border border-transparent
                    ${isSelected 
                      ? "bg-primary/10 border-primary/20" 
                      : "hover:bg-muted/50"
                    }
                  `}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(user.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {formatLabel(user)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Selected count */}
      <div className="text-xs text-muted-foreground">
        Selected: <span className="font-medium text-foreground">{selectedCount}</span> of {users.length}
      </div>
    </div>
  );
}
