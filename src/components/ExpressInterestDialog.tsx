import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MapPin, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateConversation } from "@/lib/conversations";
import { createNotification } from "@/lib/notifications";

interface PostInfo {
  id: string;
  title: string;
  state_code: string | null;
  county?: {
    county_name: string;
    state_code: string;
  } | null;
  vendor_id: string;
}

interface RepProfileInfo {
  id: string;
  user_id: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  systems_used: string[] | null;
  inspection_types: string[] | null;
  is_accepting_new_vendors: boolean | null;
  willing_to_travel_out_of_state: boolean | null;
}

interface CoverageArea {
  id: string;
  state_code: string;
  county_id: string | null;
  county_name: string | null;
  covers_entire_state: boolean;
  covers_entire_county: boolean;
  base_price: number | null;
  rush_price: number | null;
}

interface ExpressInterestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: PostInfo;
  repProfile: RepProfileInfo;
  coverageAreas: CoverageArea[];
  onInterestExpressed: (postId: string) => void;
}

export function ExpressInterestDialog({
  open,
  onOpenChange,
  post,
  repProfile,
  coverageAreas,
  onInterestExpressed,
}: ExpressInterestDialogProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset note when dialog opens
  useEffect(() => {
    if (open) {
      setNote("");
    }
  }, [open]);

  // Find matching coverage for this post
  const matchingCoverage = coverageAreas.find((coverage) => {
    if (coverage.state_code !== post.state_code) return false;
    if (coverage.covers_entire_state) return true;
    if (!post.county?.county_name) return true;
    if (coverage.county_name === post.county?.county_name) return true;
    return false;
  });

  const locationDisplay = post.county?.county_name 
    ? `${post.county.county_name}, ${post.state_code}` 
    : post.state_code || "Location not specified";

  const formatCoverageSnapshot = () => {
    const lines: string[] = [];
    
    // Location
    const repLocation = [repProfile.city, repProfile.state, repProfile.zip_code]
      .filter(Boolean)
      .join(", ");
    if (repLocation) {
      lines.push(`Location: ${repLocation}`);
    }

    // Systems
    if (repProfile.systems_used?.length) {
      lines.push(`Systems I Use: ${repProfile.systems_used.join(", ")}`);
    }

    // Inspection Types
    if (repProfile.inspection_types?.length) {
      lines.push(`Inspection Types: ${repProfile.inspection_types.join(", ")}`);
    }

    // Coverage for this request
    if (matchingCoverage) {
      const coverageArea = matchingCoverage.county_name 
        ? `${matchingCoverage.county_name}, ${matchingCoverage.state_code}`
        : `${matchingCoverage.state_code} (entire state)`;
      lines.push(`Coverage for this request: ${coverageArea}`);
      
      // Base rate
      if (matchingCoverage.base_price !== null) {
        lines.push(`Base Rate in this county: $${matchingCoverage.base_price}`);
      } else {
        lines.push(`Base Rate in this county: Not set`);
      }
    }

    // Availability preferences
    lines.push(`Accepting New Vendors: ${repProfile.is_accepting_new_vendors !== false ? "Yes" : "No"}`);
    lines.push(`Willing to Travel Out of State: ${repProfile.willing_to_travel_out_of_state ? "Yes" : "No"}`);

    return lines;
  };

  const handleSubmit = async () => {
    if (!repProfile?.id || !repProfile?.user_id) {
      toast.error("Rep profile not found");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Mark interest (upsert to avoid duplicates)
      const { error: interestError } = await supabase
        .from("rep_interest")
        .upsert(
          {
            post_id: post.id,
            rep_id: repProfile.id,
            status: "interested",
          },
          { onConflict: "post_id,rep_id" }
        );

      if (interestError) {
        throw interestError;
      }

      // 2. Create or get existing conversation
      const { id: conversationId, error: convError } = await getOrCreateConversation(
        repProfile.user_id,
        post.vendor_id,
        { type: "seeking_coverage", postId: post.id }
      );

      if (convError || !conversationId) {
        throw new Error(convError || "Failed to create conversation");
      }

      // 3. Build the message body
      const coverageLines = formatCoverageSnapshot();
      let messageBody = `I'm interested in your request: ${post.title} – ${locationDisplay}.\n\n`;
      
      if (note.trim()) {
        messageBody += `${note.trim()}\n\n`;
      }
      
      messageBody += `Coverage Snapshot:\n${coverageLines.map(line => `• ${line}`).join("\n")}`;

      // 4. Send the message
      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: repProfile.user_id,
        recipient_id: post.vendor_id,
        subject: "Interest in Seeking Coverage Post",
        body: messageBody,
      });

      if (msgError) {
        throw msgError;
      }

      // 5. Update conversation last_message
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: messageBody.substring(0, 100) + (messageBody.length > 100 ? "..." : ""),
          hidden_for_one: false,
          hidden_for_two: false,
        })
        .eq("id", conversationId);

      // 6. Create notification for vendor
      await createNotification(
        supabase,
        post.vendor_id,
        "seeking_coverage_interest",
        "Field Rep interested in your coverage request",
        `A field rep has expressed interest in "${post.title}" and sent you a message with their coverage details.`,
        conversationId
      );

      toast.success("Your interest and coverage details were sent to the vendor.");
      onInterestExpressed(post.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error expressing interest:", error);
      toast.error("Failed to send interest. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm interest & message vendor</DialogTitle>
          <DialogDescription>
            We'll send your coverage details with this message so the vendor can quickly see if you're a good fit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Post info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">{post.title}</p>
                <p className="text-xs text-muted-foreground">{locationDisplay}</p>
              </div>
            </div>
          </div>

          {/* Coverage Snapshot Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Coverage Snapshot (will be sent)</Label>
            <div className="bg-background border border-border rounded-lg p-3 space-y-2 text-sm">
              {/* Location */}
              <div className="flex flex-wrap gap-1">
                <span className="text-muted-foreground">Location:</span>
                <span>{[repProfile.city, repProfile.state, repProfile.zip_code].filter(Boolean).join(", ") || "Not set"}</span>
              </div>

              {/* Systems */}
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-muted-foreground">Systems:</span>
                {repProfile.systems_used?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {repProfile.systems_used.map((sys) => (
                      <Badge key={sys} variant="secondary" className="text-xs">{sys}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Not set</span>
                )}
              </div>

              {/* Inspection Types */}
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-muted-foreground">Inspection Types:</span>
                {repProfile.inspection_types?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {repProfile.inspection_types.slice(0, 3).map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">{type}</Badge>
                    ))}
                    {repProfile.inspection_types.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{repProfile.inspection_types.length - 3} more</Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Not set</span>
                )}
              </div>

              {/* Coverage for this request */}
              {matchingCoverage && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-muted-foreground">Coverage for this request:</span>
                  <span>
                    {matchingCoverage.county_name 
                      ? `${matchingCoverage.county_name}, ${matchingCoverage.state_code}`
                      : `${matchingCoverage.state_code} (entire state)`}
                  </span>
                </div>
              )}

              {/* Base Rate */}
              <div className="flex flex-wrap gap-1">
                <span className="text-muted-foreground">Base Rate:</span>
                <span className="font-medium">
                  {matchingCoverage?.base_price !== null && matchingCoverage?.base_price !== undefined
                    ? `$${matchingCoverage.base_price}`
                    : "Not set"}
                </span>
              </div>

              {/* Availability */}
              <div className="flex gap-4 text-xs">
                <span>
                  <span className="text-muted-foreground">Accepting New Vendors:</span>{" "}
                  <span className={repProfile.is_accepting_new_vendors !== false ? "text-green-600" : "text-muted-foreground"}>
                    {repProfile.is_accepting_new_vendors !== false ? "Yes" : "No"}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Travel Out of State:</span>{" "}
                  <span className={repProfile.willing_to_travel_out_of_state ? "text-green-600" : "text-muted-foreground"}>
                    {repProfile.willing_to_travel_out_of_state ? "Yes" : "No"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium">Add a quick note (optional)</Label>
            <Textarea
              id="note"
              placeholder="You can share anything important here, like preferred pay, availability, or special experience in this area."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send message & mark interested
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
