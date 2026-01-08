/**
 * Public Proposal View - /p/:shareToken
 * Client-facing page for viewing shared proposals
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Lock, AlertTriangle, FileText, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { vendorProposalsCopy as copy } from "@/copy/vendorProposalsCopy";

interface ProposalLine {
  id: string;
  state_code: string;
  state_name: string;
  county_name: string | null;
  is_all_counties: boolean;
  order_type: string;
  proposed_rate: number | null;
}

interface ProposalData {
  id: string;
  name: string;
  client_name: string | null;
  disclaimer: string | null;
  status: string;
  effective_as_of: string | null;
  updated_at: string;
}

type ViewState = "loading" | "passcode_required" | "locked" | "expired" | "revoked" | "invalid" | "success";

const ORDER_TYPE_LABELS: Record<string, string> = {
  standard: "Standard",
  appointment: "Appt-based",
  rush: "Rush",
};

export default function PublicProposalView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState(false);
  const [lockMinutes, setLockMinutes] = useState(0);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [lines, setLines] = useState<ProposalLine[]>([]);
  const [vendorName, setVendorName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (shareToken) {
      loadProposal();
    } else {
      setViewState("invalid");
    }
  }, [shareToken]);

  const loadProposal = async (enteredPasscode?: string) => {
    try {
      const { data, error } = await supabase.rpc("get_shared_proposal", {
        p_share_token: shareToken!,
        p_passcode: enteredPasscode || undefined,
      });

      if (error) throw error;

      const result = data as unknown as {
        success: boolean;
        error?: string;
        requires_passcode?: boolean;
        proposal?: ProposalData;
        lines?: ProposalLine[];
        vendor_name?: string;
      };

      if (!result.success) {
        switch (result.error) {
          case "SHARE_NOT_FOUND":
            setViewState("invalid");
            break;
          case "SHARE_REVOKED":
            setViewState("revoked");
            break;
          case "SHARE_EXPIRED":
            setViewState("expired");
            break;
          case "SHARE_LOCKED":
            setViewState("locked");
            // Extract minutes from error if available
            setLockMinutes(15);
            break;
          case "PASSCODE_REQUIRED":
            setViewState("passcode_required");
            break;
          case "INVALID_PASSCODE":
            setPasscodeError(true);
            setViewState("passcode_required");
            break;
          case "PROPOSAL_NOT_FOUND":
            setViewState("invalid");
            break;
          default:
            setViewState("invalid");
        }
        return;
      }

      // Success
      setProposal(result.proposal || null);
      setLines(result.lines || []);
      setVendorName(result.vendor_name || "");
      setViewState("success");
    } catch (err) {
      console.error("[PublicProposal] Load failed:", err);
      setViewState("invalid");
    }
  };

  const handleUnlock = async () => {
    if (!passcode.trim()) return;
    setSubmitting(true);
    setPasscodeError(false);
    await loadProposal(passcode.trim());
    setSubmitting(false);
  };

  // Build matrix data for display
  const buildMatrixData = () => {
    const groupMap = new Map<string, {
      stateCode: string;
      stateName: string;
      countyName: string | null;
      isAllCounties: boolean;
      standard: number | null;
      appointment: number | null;
      rush: number | null;
    }>();

    for (const line of lines) {
      const key = `${line.state_code}-${line.is_all_counties ? "__ALL__" : line.county_name}`;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          stateCode: line.state_code,
          stateName: line.state_name,
          countyName: line.county_name,
          isAllCounties: line.is_all_counties,
          standard: null,
          appointment: null,
          rush: null,
        };
        groupMap.set(key, group);
      }
      if (line.order_type === "standard") group.standard = line.proposed_rate;
      if (line.order_type === "appointment") group.appointment = line.proposed_rate;
      if (line.order_type === "rush") group.rush = line.proposed_rate;
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      const stateCompare = a.stateName.localeCompare(b.stateName);
      if (stateCompare !== 0) return stateCompare;
      if (a.isAllCounties) return -1;
      if (b.isAllCounties) return 1;
      return (a.countyName || "").localeCompare(b.countyName || "");
    });
  };

  const matrixData = buildMatrixData();

  const formatRate = (rate: number | null) => {
    if (rate == null) return "";
    return `$${rate.toFixed(2)}`;
  };

  // Error/Status Pages
  if (viewState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (viewState === "invalid") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">{copy.publicPage.invalid}</h2>
            </CardContent>
          </Card>
        </div>
        <footer className="py-4 text-center text-sm text-muted-foreground">
          {copy.publicPage.footer}
        </footer>
      </div>
    );
  }

  if (viewState === "expired") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
              <h2 className="text-xl font-semibold">{copy.publicPage.expired}</h2>
            </CardContent>
          </Card>
        </div>
        <footer className="py-4 text-center text-sm text-muted-foreground">
          {copy.publicPage.footer}
        </footer>
      </div>
    );
  }

  if (viewState === "revoked") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">{copy.publicPage.revoked}</h2>
            </CardContent>
          </Card>
        </div>
        <footer className="py-4 text-center text-sm text-muted-foreground">
          {copy.publicPage.footer}
        </footer>
      </div>
    );
  }

  if (viewState === "locked") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <Lock className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">{copy.publicPage.locked(lockMinutes)}</h2>
            </CardContent>
          </Card>
        </div>
        <footer className="py-4 text-center text-sm text-muted-foreground">
          {copy.publicPage.footer}
        </footer>
      </div>
    );
  }

  if (viewState === "passcode_required") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
              <CardTitle>{copy.publicPage.passcodeRequired.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {copy.publicPage.passcodeRequired.body}
              </p>

              <div className="space-y-2">
                <Label htmlFor="passcode">Passcode</Label>
                <div className="relative">
                  <Input
                    id="passcode"
                    type={showPasscode ? "text" : "password"}
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      setPasscodeError(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                    placeholder="Enter passcode..."
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPasscode(!showPasscode)}
                  >
                    {showPasscode ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {passcodeError && (
                  <p className="text-sm text-destructive">
                    {copy.publicPage.passcodeRequired.errorText}
                  </p>
                )}
              </div>

              <Button
                onClick={handleUnlock}
                disabled={submitting || !passcode.trim()}
                className="w-full"
              >
                {submitting ? "Unlocking..." : copy.publicPage.passcodeRequired.unlockButton}
              </Button>
            </CardContent>
          </Card>
        </div>
        <footer className="py-4 text-center text-sm text-muted-foreground">
          {copy.publicPage.footer}
        </footer>
      </div>
    );
  }

  // Success - Show Proposal
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-5xl py-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">{copy.publicPage.header}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{copy.publicPage.subheader}</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container max-w-5xl py-8 space-y-6">
        {/* Proposal Header */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{proposal?.name}</h2>
                {proposal?.client_name && (
                  <p className="text-muted-foreground">Client: {proposal.client_name}</p>
                )}
                {vendorName && (
                  <p className="text-sm text-muted-foreground">Prepared by: {vendorName}</p>
                )}
              </div>
              {proposal?.effective_as_of && (
                <Badge variant="outline" className="self-start">
                  Effective: {format(new Date(proposal.effective_as_of), "MMMM d, yyyy")}
                </Badge>
              )}
            </div>

            {proposal?.disclaimer && (
              <Alert className="bg-muted/50">
                <AlertDescription className="whitespace-pre-wrap text-sm">
                  {proposal.disclaimer}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Coverage Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Coverage Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2">
                    <TableHead colSpan={2} className="text-center border-r font-bold">
                      Coverage Area
                    </TableHead>
                    <TableHead colSpan={3} className="text-center font-bold">
                      Order Type Rates
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="w-32">State</TableHead>
                    <TableHead className="border-r">County</TableHead>
                    <TableHead className="text-right w-24">Standard</TableHead>
                    <TableHead className="text-right w-24">Appt-based</TableHead>
                    <TableHead className="text-right w-24">Rush</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrixData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No coverage areas in this proposal.
                      </TableCell>
                    </TableRow>
                  ) : (
                    matrixData.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {row.stateName} ({row.stateCode})
                        </TableCell>
                        <TableCell className="border-r">
                          {row.isAllCounties ? "All counties" : row.countyName}
                        </TableCell>
                        <TableCell className="text-right">{formatRate(row.standard)}</TableCell>
                        <TableCell className="text-right">{formatRate(row.appointment)}</TableCell>
                        <TableCell className="text-right">{formatRate(row.rush)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        {copy.publicPage.footer}
      </footer>
    </div>
  );
}
