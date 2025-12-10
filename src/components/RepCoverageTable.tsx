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
import { Edit, Trash2 } from "lucide-react";

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

interface RepCoverageTableProps {
  coverageAreas: CoverageRow[];
  onEdit: (row: CoverageRow) => void;
  onDelete: (rowId: string) => void;
}

export const RepCoverageTable = ({ coverageAreas, onEdit, onDelete }: RepCoverageTableProps) => {
  // Sort by state_code, then county_name
  const sortedAreas = [...coverageAreas].sort((a, b) => {
    const stateCompare = a.state_code.localeCompare(b.state_code);
    if (stateCompare !== 0) return stateCompare;
    return (a.county_name || "").localeCompare(b.county_name || "");
  });

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

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">State</TableHead>
            <TableHead className="font-semibold">County</TableHead>
            <TableHead className="font-semibold">Work Type</TableHead>
            <TableHead className="font-semibold text-right">Base Price</TableHead>
            <TableHead className="font-semibold text-right">Rush Price</TableHead>
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
