import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Plus, Search, X } from "lucide-react";
import { BatchEditPricingDialog } from "./BatchEditPricingDialog";
import { BatchDeleteCoverageDialog } from "./BatchDeleteCoverageDialog";
import { supabase } from "@/integrations/supabase/client";

interface CoverageRow {
  id: string;
  state_code: string;
  state_name: string;
  county_name: string | null;
  county_id: string | null;
  coverage_mode: string | null;
  covers_entire_state: boolean;
  covers_entire_county: boolean;
  base_price: number | null;
  rush_price: number | null;
  inspection_types: string[] | null;
  region_note: string | null;
}

type SortKey = "state" | "county" | "workType" | "basePrice" | "rushPrice";
type SortDirection = "asc" | "desc";

interface RepCoverageTableProps {
  coverageAreas: CoverageRow[];
  onEdit: (row: CoverageRow) => void;
  onDelete: (rowId: string) => void;
  onAdd?: () => void;
  onBatchDelete?: (rowIds: string[]) => Promise<void>;
  onBatchUpdate?: (rowIds: string[], basePrice: string, rushPrice: string) => Promise<void>;
}

export const RepCoverageTable = ({ 
  coverageAreas, 
  onEdit, 
  onDelete, 
  onAdd,
  onBatchDelete,
  onBatchUpdate,
}: RepCoverageTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("state");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Filters
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [countySearch, setCountySearch] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState<string>("all");
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Dialogs
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Get unique states for filter dropdown
  const uniqueStates = useMemo(() => {
    const states = [...new Set(coverageAreas.map(c => c.state_code))].sort();
    return states;
  }, [coverageAreas]);

  // Get unique work types for filter dropdown
  const uniqueWorkTypes = useMemo(() => {
    const types = new Set<string>();
    coverageAreas.forEach(c => {
      (c.inspection_types || []).forEach(t => types.add(t.replace("Other: ", "")));
    });
    return [...types].sort();
  }, [coverageAreas]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const getWorkTypeString = (row: CoverageRow): string => {
    if (!row.inspection_types || row.inspection_types.length === 0) {
      return "";
    }
    return row.inspection_types.map(t => t.replace("Other: ", "")).join(", ");
  };

  // Filter and sort areas
  const filteredAndSortedAreas = useMemo(() => {
    let filtered = [...coverageAreas];

    // Apply state filter
    if (stateFilter !== "all") {
      filtered = filtered.filter(c => c.state_code === stateFilter);
    }

    // Apply county search
    if (countySearch.trim()) {
      const search = countySearch.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.county_name || "").toLowerCase().includes(search)
      );
    }

    // Apply work type filter
    if (workTypeFilter !== "all") {
      filtered = filtered.filter(c => 
        (c.inspection_types || []).some(t => 
          t.replace("Other: ", "") === workTypeFilter
        )
      );
    }

    // Sort
    const sorted = filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case "state":
          comparison = a.state_code.localeCompare(b.state_code);
          if (comparison === 0) {
            comparison = (a.county_name || "").localeCompare(b.county_name || "");
          }
          break;
        case "county":
          comparison = (a.county_name || "").localeCompare(b.county_name || "");
          break;
        case "workType":
          comparison = getWorkTypeString(a).localeCompare(getWorkTypeString(b));
          break;
        case "basePrice":
          const aBase = a.base_price ?? -Infinity;
          const bBase = b.base_price ?? -Infinity;
          comparison = aBase - bBase;
          break;
        case "rushPrice":
          const aRush = a.rush_price ?? -Infinity;
          const bRush = b.rush_price ?? -Infinity;
          comparison = aRush - bRush;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [coverageAreas, stateFilter, countySearch, workTypeFilter, sortKey, sortDirection]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [stateFilter, countySearch, workTypeFilter]);

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return "—";
    return `$${parseFloat(String(price)).toFixed(2)}`;
  };

  const getCoverageModeBadge = (row: CoverageRow) => {
    const mode = row.coverage_mode || (row.covers_entire_state ? "entire_state" : "selected_counties");
    
    if (mode === "entire_state") {
      return <Badge variant="secondary" className="text-xs">Entire State</Badge>;
    }
    if (mode === "entire_state_except") {
      return <Badge variant="outline" className="text-xs">State w/ Exclusions</Badge>;
    }
    return null;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredAndSortedAreas.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const isAllSelected = filteredAndSortedAreas.length > 0 && 
    filteredAndSortedAreas.every(c => selectedIds.has(c.id));
  const isSomeSelected = selectedIds.size > 0;

  const handleBatchDelete = async () => {
    if (!onBatchDelete) return;
    setBatchDeleting(true);
    await onBatchDelete(Array.from(selectedIds));
    setBatchDeleting(false);
    setSelectedIds(new Set());
    setBatchDeleteOpen(false);
  };

  const handleBatchEdit = async (basePrice: string, rushPrice: string) => {
    if (!onBatchUpdate) return;
    await onBatchUpdate(Array.from(selectedIds), basePrice, rushPrice);
    setSelectedIds(new Set());
  };

  const clearFilters = () => {
    setStateFilter("all");
    setCountySearch("");
    setWorkTypeFilter("all");
  };

  const hasActiveFilters = stateFilter !== "all" || countySearch.trim() !== "" || workTypeFilter !== "all";

  const SortableHeader = ({ 
    sortKeyName, 
    children, 
    className = "" 
  }: { 
    sortKeyName: SortKey; 
    children: React.ReactNode; 
    className?: string;
  }) => (
    <TableHead 
      className={`font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none ${className}`}
      onClick={() => handleSort(sortKeyName)}
    >
      <div className="flex items-center">
        {children}
        {getSortIcon(sortKeyName)}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Header with Add button and filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {coverageAreas.length} coverage area{coverageAreas.length !== 1 ? "s" : ""}
            {hasActiveFilters && ` (${filteredAndSortedAreas.length} shown)`}
          </div>
          {onAdd && (
            <Button type="button" onClick={onAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Coverage Area
            </Button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">State:</span>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="All states" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {uniqueStates.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">County:</span>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={countySearch}
                onChange={(e) => setCountySearch(e.target.value)}
                className="h-8 w-[140px] pl-8"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Work Type:</span>
            <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {uniqueWorkTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="h-8"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Batch actions bar */}
        {isSomeSelected && (
          <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/30">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setBatchEditOpen(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Selected
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                size="sm"
                onClick={() => setBatchDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <SortableHeader sortKeyName="state">State</SortableHeader>
              <SortableHeader sortKeyName="county">County</SortableHeader>
              <SortableHeader sortKeyName="workType">Work Type</SortableHeader>
              <SortableHeader sortKeyName="basePrice" className="text-right">Base Price</SortableHeader>
              <SortableHeader sortKeyName="rushPrice" className="text-right">Rush Price</SortableHeader>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedAreas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters 
                    ? "No coverage areas match your filters."
                    : "No coverage areas added yet."
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedAreas.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                      aria-label={`Select ${row.county_name || row.state_code}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {row.state_code}
                      {getCoverageModeBadge(row)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.county_name || (row.covers_entire_state ? "All counties" : "—")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.inspection_types && row.inspection_types.length > 0 ? (
                        row.inspection_types.map((type, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {type.replace("Other: ", "")}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">Uses profile types</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.base_price === null || row.base_price === undefined ? (
                      <Badge variant="destructive" className="text-xs">Missing</Badge>
                    ) : (
                      formatPrice(row.base_price)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(row.rush_price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(row)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove coverage for this county?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove coverage for {row.county_name || row.state_name}? 
                              Vendors won't see you as available here anymore.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(row.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <BatchEditPricingDialog
        open={batchEditOpen}
        onOpenChange={setBatchEditOpen}
        selectedCount={selectedIds.size}
        onConfirm={handleBatchEdit}
      />

      <BatchDeleteCoverageDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        selectedCount={selectedIds.size}
        onConfirm={handleBatchDelete}
        deleting={batchDeleting}
      />
    </div>
  );
};
