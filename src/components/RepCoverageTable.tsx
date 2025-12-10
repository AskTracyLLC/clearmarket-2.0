import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Edit, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

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
}

export const RepCoverageTable = ({ coverageAreas, onEdit, onDelete }: RepCoverageTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("state");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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

  const sortedAreas = useMemo(() => {
    const sorted = [...coverageAreas].sort((a, b) => {
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
  }, [coverageAreas, sortKey, sortDirection]);

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
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <SortableHeader sortKeyName="state">State</SortableHeader>
            <SortableHeader sortKeyName="county">County</SortableHeader>
            <SortableHeader sortKeyName="workType">Work Type</SortableHeader>
            <SortableHeader sortKeyName="basePrice" className="text-right">Base Price</SortableHeader>
            <SortableHeader sortKeyName="rushPrice" className="text-right">Rush Price</SortableHeader>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAreas.map((row) => (
            <TableRow key={row.id}>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
