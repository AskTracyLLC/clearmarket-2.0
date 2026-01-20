import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Globe, 
  Linkedin, 
  Calendar,
  Shield,
  ExternalLink,
  Hash,
  Check,
  X,
  Clock,
  AlertTriangle,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type DualRoleRequest = Database["public"]["Tables"]["dual_role_access_requests"]["Row"];

type DualRoleRequestWithProfile = DualRoleRequest & {
  profiles?: {
    full_name: string | null;
  } | null;
};

interface AdminDualRoleRequestDrawerProps {
  request: DualRoleRequestWithProfile | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function parseBbbUrl(message: string | null): string | null {
  if (!message) return null;
  const match = message.match(/BBB:\s*(https?:\/\/\S+)/i);
  return match ? match[1] : null;
}

function getEntityTypeLabel(entityType: string | null): string {
  if (!entityType) return "—";
  const labels: Record<string, string> = {
    llc: "LLC",
    corporation: "Corporation",
    sole_proprietor: "Sole Proprietor",
    partnership: "Partnership",
    other: "Other",
  };
  return labels[entityType] || entityType;
}

export function AdminDualRoleRequestDrawer({
  request,
  open,
  onClose,
  onUpdated,
}: AdminDualRoleRequestDrawerProps) {
  const { user } = useAuth();
  const [decisionNote, setDecisionNote] = useState("");
  const [verifyGl, setVerifyGl] = useState(false);
  const [glNote, setGlNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const isPending = request?.status === "pending";
  const hasGlExpiration = !!request?.gl_expires_on;
  const bbbUrl = parseBbbUrl(request?.message);

  function resetForm() {
    setDecisionNote("");
    setVerifyGl(false);
    setGlNote("");
  }

  async function handleDecision(decision: "approved" | "denied") {
    if (!request || !user) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("review_dual_role_access_request", {
        p_request_id: request.id,
        p_decision: decision,
        p_decision_note: decisionNote.trim() || null,
        p_verify_gl: verifyGl,
        p_gl_note: glNote.trim() || null,
      });

      if (error) {
        toast.error("Failed to process request", { description: error.message });
        return;
      }

      toast.success(
        decision === "approved" ? "Request approved" : "Request denied",
        {
          description: decision === "approved" 
            ? "User now has Dual Role access."
            : "User has been notified of the decision.",
        }
      );

      resetForm();
      onUpdated();
    } finally {
      setProcessing(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="success"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case "denied":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Denied</Badge>;
      case "cancelled":
        return <Badge variant="outline"><X className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (!request) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {request.business_name}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            Submitted {format(new Date(request.created_at), "MMMM d, yyyy")}
            {getStatusBadge(request.status)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* User Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Requester</h4>
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span>{request.profiles?.full_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-mono">
                <span className="text-muted-foreground">User ID:</span>
                <span className="text-xs">{request.user_id}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Business Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Business Information</h4>
            
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{request.business_name}</p>
                  {request.entity_type && (
                    <p className="text-xs text-muted-foreground">{getEntityTypeLabel(request.entity_type)}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{request.office_phone}</span>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{request.office_email}</span>
              </div>

              {(request.business_city || request.business_state) && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">
                    {request.business_city && request.business_state
                      ? `${request.business_city}, ${request.business_state}`
                      : request.business_city || request.business_state}
                  </span>
                </div>
              )}

              {request.website_url && (
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a 
                    href={request.website_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {request.website_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {request.linkedin_url && (
                <div className="flex items-center gap-3">
                  <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a 
                    href={request.linkedin_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    LinkedIn Profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {request.year_established && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">Established {request.year_established}</span>
                </div>
              )}

              {request.ein_last4 && (
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">
                    EIN: ••••••{request.ein_last4}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* BBB Profile */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">BBB Profile</h4>
            {bbbUrl ? (
              <div className="p-3 bg-muted/50 rounded-lg">
                <a 
                  href={bbbUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                >
                  {bbbUrl}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <p className="text-xs text-muted-foreground mt-2">
                  BBB ratings are not auto-imported. Verify manually if needed.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>

          <Separator />

          {/* GL Insurance */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              GL Insurance
            </h4>
            
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">GL Status:</span>
                {request.gl_status === "none" || !request.gl_status ? (
                  <span className="text-sm">Not submitted</span>
                ) : request.gl_status === "submitted" ? (
                  <Badge variant="secondary">Submitted</Badge>
                ) : request.gl_status === "verified" ? (
                  <Badge variant="success">Verified</Badge>
                ) : (
                  <Badge variant="destructive">Rejected</Badge>
                )}
              </div>
              {request.gl_expires_on && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expiration:</span>
                  <span className="text-sm">{format(new Date(request.gl_expires_on), "MMMM d, yyyy")}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Message */}
          {request.message && (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Additional Message
                </h4>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{request.message}</p>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Review History */}
          {request.reviewed_at && (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">Review History</h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Reviewed:</span>
                    <span className="text-sm">{format(new Date(request.reviewed_at), "MMMM d, yyyy")}</span>
                  </div>
                  {request.decision_note && (
                    <div>
                      <span className="text-sm text-muted-foreground">Decision Note:</span>
                      <p className="text-sm mt-1">{request.decision_note}</p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Admin Actions */}
          {isPending && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Review Decision</h4>

              <div className="space-y-2">
                <Label htmlFor="decisionNote">Decision Note (optional)</Label>
                <Textarea
                  id="decisionNote"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Add a note about your decision..."
                  rows={3}
                />
              </div>

              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Switch
                    id="verifyGl"
                    checked={verifyGl}
                    onCheckedChange={setVerifyGl}
                    disabled={!hasGlExpiration}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="verifyGl" className={!hasGlExpiration ? "text-muted-foreground" : ""}>
                      Verify GL (adds GL Insured badge)
                    </Label>
                    {!hasGlExpiration && (
                      <p className="text-xs text-muted-foreground">
                        No expiration date submitted.
                      </p>
                    )}
                  </div>
                </div>

                {verifyGl && hasGlExpiration && (
                  <div className="space-y-2 pl-10">
                    <Label htmlFor="glNote">GL Note (optional)</Label>
                    <Textarea
                      id="glNote"
                      value={glNote}
                      onChange={(e) => setGlNote(e.target.value)}
                      placeholder="Add a note about GL verification..."
                      rows={2}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {isPending && (
          <SheetFooter className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => handleDecision("denied")}
              disabled={processing}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-1" />
              {processing ? "Processing..." : "Deny"}
            </Button>
            <Button
              onClick={() => handleDecision("approved")}
              disabled={processing}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-1" />
              {processing ? "Processing..." : "Approve"}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
