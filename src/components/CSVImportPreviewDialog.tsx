import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, XCircle, Download, Loader2 } from "lucide-react";
import {
  ParsedRow,
  ParseResult,
  ParsedVendorRepContact,
  ParsedRepVendorContact,
  generateErrorReportCSV,
  downloadCSV,
  formatSystems,
  ContactType,
} from "@/lib/offlineContactsCsv";

interface CSVImportPreviewDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parseResult: ParseResult<T> | null;
  contactType: ContactType;
  onConfirmImport: (validRows: ParsedRow<T>[]) => Promise<{ success: number; failed: number }>;
  importing?: boolean;
}

export function CSVImportPreviewDialog<T extends ParsedVendorRepContact | ParsedRepVendorContact>({
  open,
  onOpenChange,
  parseResult,
  contactType,
  onConfirmImport,
  importing = false,
}: CSVImportPreviewDialogProps<T>) {
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  if (!parseResult) return null;

  const previewRows = parseResult.rows.slice(0, 20);
  const hasMoreRows = parseResult.rows.length > 20;
  const validRows = parseResult.rows.filter(r => r.isValid);
  const failedRows = parseResult.rows.filter(r => !r.isValid);

  const handleConfirm = async () => {
    const result = await onConfirmImport(validRows);
    setImportResult(result);
  };

  const handleDownloadErrors = () => {
    const csv = generateErrorReportCSV(parseResult.rows, contactType);
    const filename = contactType === "vendor_rep" 
      ? "offline_rep_import_errors.csv" 
      : "offline_vendor_import_errors.csv";
    downloadCSV(csv, filename);
  };

  const handleClose = () => {
    setImportResult(null);
    onOpenChange(false);
  };

  const nameField = contactType === "vendor_rep" ? "rep_name" : "vendor_name";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {importResult ? "Import Complete" : "Preview CSV Import"}
          </DialogTitle>
          <DialogDescription>
            {importResult 
              ? `Imported ${importResult.success} contacts successfully.`
              : `Review the data before importing. ${parseResult.totalRows} total rows detected.`
            }
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="flex flex-wrap gap-3 py-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="font-semibold">{parseResult.totalRows}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-md">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Valid:</span>
            <span className="font-semibold text-green-600">{parseResult.validRows}</span>
          </div>
          {parseResult.errorRows > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-md">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Errors:</span>
              <span className="font-semibold text-destructive">{parseResult.errorRows}</span>
            </div>
          )}
          {parseResult.duplicateRows > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-md">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Duplicates (DB):</span>
              <span className="font-semibold text-amber-600">{parseResult.duplicateRows}</span>
            </div>
          )}
          {parseResult.duplicateInFileRows > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-md">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Duplicates (File):</span>
              <span className="font-semibold text-amber-600">{parseResult.duplicateInFileRows}</span>
            </div>
          )}
        </div>

        {/* Import Result Summary */}
        {importResult && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div>
                <p className="font-medium">Import Complete</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.success} contacts imported successfully
                  {importResult.failed > 0 && `, ${importResult.failed} failed`}
                </p>
              </div>
            </div>
            {failedRows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleDownloadErrors}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Error Report
              </Button>
            )}
          </div>
        )}

        {/* Preview Table */}
        {!importResult && (
          <ScrollArea className="h-[400px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Row</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead>{contactType === "vendor_rep" ? "Rep Name" : "Vendor Name"}</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Systems</TableHead>
                  <TableHead>Import Status</TableHead>
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, idx) => {
                  const data = row.data as any;
                  return (
                    <TableRow 
                      key={idx} 
                      className={
                        !row.isValid 
                          ? "bg-destructive/5" 
                          : row.warnings.length > 0 
                            ? "bg-amber-500/5" 
                            : ""
                      }
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {row.rowIndex}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            data.status === "blocked" 
                              ? "destructive" 
                              : data.status === "inactive" 
                                ? "secondary" 
                                : "default"
                          }
                          className="text-xs"
                        >
                          {data.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {data[nameField] || <span className="text-destructive italic">Missing</span>}
                      </TableCell>
                      <TableCell className="text-sm">{data.company || "—"}</TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">
                        {data.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{data.phone || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {data.systems?.length > 0 
                          ? formatSystems(data.systems) 
                          : "—"
                        }
                      </TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Ready
                          </Badge>
                        ) : row.isDuplicate ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Duplicate
                          </Badge>
                        ) : row.isDuplicateInFile ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Dup in File
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive">
                            Error
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {row.errors.length > 0 && (
                          <span className="text-destructive">{row.errors.join("; ")}</span>
                        )}
                        {row.warnings.length > 0 && (
                          <span className="text-amber-600">{row.warnings.join("; ")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {hasMoreRows && (
              <div className="text-center py-3 text-sm text-muted-foreground border-t">
                ...and {parseResult.rows.length - 20} more rows
              </div>
            )}
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          {!importResult && failedRows.length > 0 && (
            <Button variant="outline" onClick={handleDownloadErrors}>
              <Download className="h-4 w-4 mr-2" />
              Download Error Report
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {importResult ? "Close" : "Cancel"}
          </Button>
          {!importResult && (
            <Button 
              onClick={handleConfirm} 
              disabled={validRows.length === 0 || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${validRows.length} Contacts`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
