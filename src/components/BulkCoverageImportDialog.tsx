import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import {
  parseCoverageCSV,
  groupAndValidateRows,
  resolveCountyIds,
  executeImport,
  downloadTemplate,
  type ImportStateEntry,
  type ImportValidationResult,
} from "@/lib/vendorCoverageImport";

interface BulkCoverageImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onImportComplete: () => void;
}

export function BulkCoverageImportDialog({
  open,
  onOpenChange,
  userId,
  onImportComplete,
}: BulkCoverageImportDialogProps) {
  const [validationResult, setValidationResult] =
    useState<ImportValidationResult | null>(null);
  const [dbErrors, setDbErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const allErrors = [
    ...(validationResult?.errors || []),
    ...dbErrors,
  ];
  const allWarnings = validationResult?.warnings || [];
  const canImport =
    validationResult &&
    allErrors.length === 0 &&
    validationResult.entries.length > 0 &&
    !importing &&
    !importDone;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setParsing(true);
      setDbErrors([]);
      setImportDone(false);

      try {
        const text = await file.text();
        const { rawRows, parseErrors } = parseCoverageCSV(text);

        if (parseErrors.length > 0) {
          setValidationResult({
            entries: [],
            errors: parseErrors,
            warnings: [],
            isValid: false,
          });
          return;
        }

        const result = groupAndValidateRows(rawRows);

        // If structural validation passed, resolve county IDs
        if (result.errors.length === 0) {
          const { errors: countyErrors } = await resolveCountyIds(
            result.entries
          );
          if (countyErrors.length > 0) {
            setDbErrors(countyErrors);
          }
        }

        setValidationResult(result);
      } catch (err: any) {
        setValidationResult({
          entries: [],
          errors: [`Failed to read file: ${err.message}`],
          warnings: [],
          isValid: false,
        });
      } finally {
        setParsing(false);
      }
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!validationResult || allErrors.length > 0) return;
    setImporting(true);

    const { error } = await executeImport(userId, validationResult.entries);
    if (error) {
      setDbErrors((prev) => [...prev, error]);
    } else {
      setImportDone(true);
      onImportComplete();
    }

    setImporting(false);
  }, [validationResult, allErrors, userId, onImportComplete]);

  const handleClose = () => {
    setValidationResult(null);
    setDbErrors([]);
    setImportDone(false);
    setFileName(null);
    onOpenChange(false);
  };

  const modeLabel = (mode: string) => {
    switch (mode) {
      case "entire_state":
        return "Entire State";
      case "selected":
        return "Selected Only";
      case "entire_except":
        return "Entire Except";
      default:
        return mode;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {importDone ? "Import Complete" : "Import Coverage Areas (CSV)"}
          </DialogTitle>
          <DialogDescription>
            {importDone
              ? `Successfully imported ${validationResult?.entries.length} state coverage records.`
              : "Upload a CSV to bulk-add vendor coverage areas. Existing coverage for imported states will be replaced."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Template + Upload */}
        {!importDone && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 pointer-events-none"
                  asChild
                >
                  <span>
                    <Upload className="h-4 w-4" />
                    {fileName || "Choose CSV File"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {parsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing and validating…
              </div>
            )}
          </div>
        )}

        {/* Success message */}
        {importDone && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div>
                <p className="font-medium">Import Complete</p>
                <p className="text-sm text-muted-foreground">
                  {validationResult?.entries.length} state coverage
                  {validationResult?.entries.length !== 1 ? "s" : ""} imported
                  successfully. Existing records for those states were replaced.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Validation summary */}
        {validationResult && !importDone && (
          <>
            <div className="flex flex-wrap gap-3 py-1">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
                <span className="text-sm text-muted-foreground">States:</span>
                <span className="font-semibold">
                  {validationResult.entries.length}
                </span>
              </div>
              {allErrors.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-md">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">Errors:</span>
                  <span className="font-semibold text-destructive">
                    {allErrors.length}
                  </span>
                </div>
              )}
              {allWarnings.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">
                    Warnings:
                  </span>
                  <span className="font-semibold text-amber-600">
                    {allWarnings.length}
                  </span>
                </div>
              )}
              {allErrors.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-md">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600">
                    Ready to import
                  </span>
                </div>
              )}
            </div>

            {/* Error list */}
            {allErrors.length > 0 && (
              <div className="space-y-1 text-sm">
                {allErrors.map((err, i) => (
                  <p key={i} className="text-destructive">
                    • {err}
                  </p>
                ))}
              </div>
            )}
            {allWarnings.length > 0 && (
              <div className="space-y-1 text-sm">
                {allWarnings.map((w, i) => (
                  <p key={i} className="text-amber-600">
                    ⚠ {w}
                  </p>
                ))}
              </div>
            )}

            {/* Preview table */}
            {validationResult.entries.length > 0 && (
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Counties</TableHead>
                      <TableHead>County List</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResult.entries.map((entry) => (
                      <TableRow
                        key={entry.stateCode}
                        className={
                          entry.unknownCounties.length > 0
                            ? "bg-destructive/5"
                            : ""
                        }
                      >
                        <TableCell className="font-medium">
                          {entry.stateCode} — {entry.stateName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              entry.coverageMode === "entire_state"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {modeLabel(entry.coverageMode)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {entry.countyNames.length || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                          {entry.countyNames.length > 0
                            ? entry.countyNames.length <= 4
                              ? entry.countyNames.join(", ")
                              : `${entry.countyNames
                                  .slice(0, 3)
                                  .join(", ")} +${
                                  entry.countyNames.length - 3
                                } more`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {importDone ? "Close" : "Cancel"}
          </Button>
          {!importDone && (
            <Button onClick={handleImport} disabled={!canImport}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing…
                </>
              ) : (
                `Import ${validationResult?.entries.length ?? 0} States`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
