import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Link2,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  RefreshCw,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, formatDistanceToNow } from "date-fns";
import { vendorProposalsCopy as copy } from "@/copy/vendorProposalsCopy";

interface ProposalShare {
  id: string;
  share_token: string;
  passcode_hash: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface ShareProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  proposalStatus: string;
  proposalName: string;
}

export function ShareProposalDialog({
  open,
  onOpenChange,
  proposalId,
  proposalStatus,
  proposalName,
}: ShareProposalDialogProps) {
  const [expirationDays, setExpirationDays] = useState<number>(7);
  const [requirePasscode, setRequirePasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedExpiresAt, setGeneratedExpiresAt] = useState<string | null>(null);
  const [activeShares, setActiveShares] = useState<ProposalShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDraft = proposalStatus === "draft";
  const baseUrl = window.location.origin;

  // Load active shares when dialog opens
  useEffect(() => {
    if (open && proposalId) {
      loadActiveShares();
      // Reset generated link state when opening
      setGeneratedLink(null);
      setGeneratedExpiresAt(null);
      setPasscode("");
      setRequirePasscode(false);
    }
  }, [open, proposalId]);

  const loadActiveShares = async () => {
    setLoadingShares(true);
    try {
      const { data, error } = await supabase
        .from("vendor_proposal_shares")
        .select("*")
        .eq("proposal_id", proposalId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setActiveShares(data || []);
    } catch (err: any) {
      console.error("[ShareProposal] Failed to load shares:", err);
    } finally {
      setLoadingShares(false);
    }
  };

  const handleGenerateLink = async () => {
    setGenerating(true);
    try {
      const params: {
        p_proposal_id: string;
        p_expires_in_days?: number;
        p_passcode?: string;
      } = {
        p_proposal_id: proposalId,
        p_expires_in_days: expirationDays,
      };

      if (requirePasscode && passcode.trim()) {
        params.p_passcode = passcode.trim();
      }

      const { data, error } = await supabase.rpc("create_proposal_share", params);

      if (error) throw error;

      const result = data as { success: boolean; share_token?: string; expires_at?: string; error?: string };

      if (!result.success) {
        throw new Error(result.error || "Failed to create share link");
      }

      const link = `${baseUrl}/p/${result.share_token}`;
      setGeneratedLink(link);
      setGeneratedExpiresAt(result.expires_at || null);
      toast.success("Share link created");
      loadActiveShares();
    } catch (err: any) {
      console.error("[ShareProposal] Generate failed:", err);
      toast.error(err.message || "Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleCopyExistingLink = async (shareToken: string) => {
    const link = `${baseUrl}/p/${shareToken}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleRevoke = async (shareId: string) => {
    setRevoking(true);
    try {
      const { data, error } = await supabase.rpc("revoke_proposal_share", {
        p_share_id: shareId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "Failed to revoke");
      }

      toast.success("Link revoked");
      setRevokeConfirmId(null);
      loadActiveShares();
    } catch (err: any) {
      console.error("[ShareProposal] Revoke failed:", err);
      toast.error(err.message || "Failed to revoke link");
    } finally {
      setRevoking(false);
    }
  };

  const getShareStatus = (share: ProposalShare): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    if (share.revoked_at) {
      return { label: "Revoked", variant: "destructive" };
    }
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return { label: "Expired", variant: "secondary" };
    }
    return { label: "Active", variant: "default" };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              {copy.shareModal.title}
            </DialogTitle>
            <DialogDescription>{copy.shareModal.subtitle}</DialogDescription>
          </DialogHeader>

          {/* Draft Warning */}
          {isDraft && (
            <Alert className="border-yellow-500/30 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-200">
                {copy.shareModal.draftWarning}
              </AlertDescription>
            </Alert>
          )}

          {/* Link Generation Form */}
          {!generatedLink && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Link expiration</Label>
                <Select
                  value={String(expirationDays)}
                  onValueChange={(v) => setExpirationDays(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {copy.shareModal.expirationOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="passcode-toggle">
                      {copy.shareModal.passcodeToggleLabel}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {copy.shareModal.passcodeHelperText}
                    </p>
                  </div>
                  <Switch
                    id="passcode-toggle"
                    checked={requirePasscode}
                    onCheckedChange={setRequirePasscode}
                  />
                </div>

                {requirePasscode && (
                  <div className="relative">
                    <Input
                      type={showPasscode ? "text" : "password"}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter a passcode..."
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
                )}
              </div>

              <Button
                onClick={handleGenerateLink}
                disabled={generating || (requirePasscode && !passcode.trim())}
                className="w-full"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    {copy.shareModal.generateLinkButton}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Generated Link Success */}
          {generatedLink && (
            <div className="space-y-4 py-4">
              <Alert className="border-green-500/30 bg-green-500/10">
                <Check className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-200">
                  {copy.shareModal.linkReadyCallout}
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={handleCopyLink} variant="secondary">
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {generatedExpiresAt && (
                <p className="text-sm text-muted-foreground">
                  {copy.shareModal.expiresNote(
                    format(new Date(generatedExpiresAt), "PPP 'at' p")
                  )}
                </p>
              )}

              <Button
                variant="outline"
                onClick={() => {
                  setGeneratedLink(null);
                  setGeneratedExpiresAt(null);
                  setPasscode("");
                  setRequirePasscode(false);
                }}
              >
                Create Another Link
              </Button>
            </div>
          )}

          {/* Active Links Section */}
          {activeShares.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-sm">
                {copy.shareModal.activeLinksHeader}
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Created</TableHead>
                      <TableHead className="w-[140px]">Expires</TableHead>
                      <TableHead className="w-[80px]">Passcode</TableHead>
                      <TableHead className="w-[80px]">Status</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeShares.map((share) => {
                      const status = getShareStatus(share);
                      const isExpired = share.expires_at && new Date(share.expires_at) < new Date();
                      
                      return (
                        <TableRow key={share.id}>
                          <TableCell className="text-sm">
                            {formatDistanceToNow(new Date(share.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-sm">
                            {share.expires_at
                              ? format(new Date(share.expires_at), "MMM d, yyyy")
                              : "Never"}
                          </TableCell>
                          <TableCell>
                            {share.passcode_hash ? (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <span className="text-muted-foreground text-sm">No</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="text-xs">
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!isExpired && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyExistingLink(share.share_token)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevokeConfirmId(share.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeConfirmId} onOpenChange={() => setRevokeConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{copy.shareModal.revokeConfirmTitle}</DialogTitle>
            <DialogDescription>{copy.shareModal.revokeConfirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevokeConfirmId(null)}>
              {copy.shareModal.cancelButton}
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeConfirmId && handleRevoke(revokeConfirmId)}
              disabled={revoking}
            >
              {revoking ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {copy.shareModal.revokeButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
