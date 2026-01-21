import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { parseImportFile, normalizeRow } from "@/lib/clearcheck/parser";
import type { ClearCheckImportType } from "@/lib/clearcheck/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ImportPage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [importType, setImportType] = useState<ClearCheckImportType>('EZ_NEEDS_UPDATE');
    const [isProcessing, setIsProcessing] = useState(false);
    const [parseResult, setParseResult] = useState<{ rows: number; errors: string[]; warnings: string[] } | null>(null);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setParseResult(null);
        }
    };

    const handleProcess = async () => {
        if (!selectedFile) {
            toast({
                title: "No File Selected",
                description: "Please select a file to import.",
                variant: "destructive",
            });
            return;
        }

        setIsProcessing(true);
        setParseResult(null);

        try {
            // Step 1: Parse the file
            const { rows, errors, warnings } = await parseImportFile(selectedFile, importType);

            if (errors.length > 0) {
                setParseResult({ rows: 0, errors, warnings });
                toast({
                    title: "Import Failed",
                    description: `Found ${errors.length} error(s). Please fix and retry.`,
                    variant: "destructive",
                });
                setIsProcessing(false);
                return;
            }

            // Step 2: Create batch record
            const system = importType.startsWith('EZ') ? 'EZ' : 'IA';
            const { data: batch, error: batchError } = await supabase
                .from('clearcheck_import_batches')
                .insert({
                    import_type: importType,
                    system,
                    filename: selectedFile.name,
                    row_count: rows.length,
                    warnings: warnings,
                    errors: [],
                })
                .select()
                .single();

            if (batchError || !batch) {
                throw new Error('Failed to create import batch: ' + batchError?.message);
            }

            // Step 3: Insert staging rows
            const stagingRows = rows.map(row => ({
                batch_id: batch.id,
                raw: row,
                parsed: normalizeRow(row, system, importType),
                is_valid: true,
                error_text: null,
            }));

            const { error: stagingError } = await supabase
                .from('clearcheck_staging_rows')
                .insert(stagingRows);

            if (stagingError) {
                throw new Error('Failed to insert staging rows: ' + stagingError.message);
            }

            // Step 4: Process staging -> orders (upsert logic)
            // For MVP, we'll do this client-side in a loop
            // In production, this should be a server-side function
            for (const staging of stagingRows) {
                const parsed = staging.parsed;

                // Generate order instance key (simplified hash for MVP)
                const keyParts = [
                    parsed.system,
                    parsed.job_id,
                    parsed.street?.toLowerCase().replace(/[^a-z0-9]/g, '') || '',
                    parsed.city?.toLowerCase() || '',
                    parsed.state?.toLowerCase() || '',
                    parsed.county?.toLowerCase() || '',
                    parsed.created_date || '',
                    parsed.client_primary?.toLowerCase() || '',
                ];
                const orderInstanceKey = keyParts.join('|');

                // Upsert order
                const { error: upsertError } = await supabase
                    .from('clearcheck_orders')
                    .upsert({
                        order_instance_key: orderInstanceKey,
                        ...parsed,
                    }, {
                        onConflict: 'order_instance_key'
                    });

                if (upsertError) {
                    console.error('Failed to upsert order:', upsertError);
                    warnings.push(`Failed to upsert order ${parsed.job_id}: ${upsertError.message}`);
                }
            }

            setParseResult({ rows: rows.length, errors: [], warnings });

            toast({
                title: "Import Successful",
                description: `Imported ${rows.length} orders with ${warnings.length} warning(s).`,
            });

        } catch (err) {
            console.error(err);
            toast({
                title: "Import Error",
                description: err instanceof Error ? err.message : "Unknown error occurred",
                variant: "destructive",
            });
            setParseResult({ rows: 0, errors: [err instanceof Error ? err.message : "Unknown error"], warnings: [] });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
                <p className="text-muted-foreground">Upload EZ or IA exports to update the ClearCheck database.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Upload Import File</CardTitle>
                    <CardDescription>
                        Select an Excel file (.xlsx, .xls) or CSV file with order data.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="import-type">Import Type</Label>
                        <Select value={importType} onValueChange={(val) => setImportType(val as ClearCheckImportType)}>
                            <SelectTrigger id="import-type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="EZ_NEEDS_UPDATE">EZ - Needs Update</SelectItem>
                                <SelectItem value="IA_NEEDS_UPDATE">IA - Needs Update</SelectItem>
                                <SelectItem value="IA_FOLLOW_UP">IA - Follow-up</SelectItem>
                                <SelectItem value="EZ_STATUS_REFRESH">EZ - Status Refresh</SelectItem>
                                <SelectItem value="IA_SUBMITTED_REFRESH">IA - Submitted Refresh</SelectItem>
                                <SelectItem value="IA_CANCELED_REFRESH">IA - Canceled Refresh</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="file-upload">File</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="file-upload"
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                                disabled={isProcessing}
                            />
                            {selectedFile && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    {selectedFile.name}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button onClick={handleProcess} disabled={!selectedFile || isProcessing} className="w-full">
                        <Upload className="mr-2 h-4 w-4" />
                        {isProcessing ? 'Processing...' : 'Process Import'}
                    </Button>
                </CardContent>
            </Card>

            {parseResult && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {parseResult.errors.length > 0 ? (
                                <>
                                    <AlertCircle className="h-5 w-5 text-destructive" />
                                    Import Failed
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                    Import Complete
                                </>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm">
                            <p><strong>Rows Processed:</strong> {parseResult.rows}</p>
                        </div>

                        {parseResult.errors.length > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Errors:</strong>
                                    <ul className="list-disc list-inside mt-2">
                                        {parseResult.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        {parseResult.warnings.length > 0 && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Warnings:</strong>
                                    <ul className="list-disc list-inside mt-2">
                                        {parseResult.warnings.slice(0, 10).map((warn, i) => (
                                            <li key={i}>{warn}</li>
                                        ))}
                                        {parseResult.warnings.length > 10 && (
                                            <li className="text-muted-foreground">...and {parseResult.warnings.length - 10} more</li>
                                        )}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
