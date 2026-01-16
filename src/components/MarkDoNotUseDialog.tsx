import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Ban } from "lucide-react";

interface MarkDoNotUseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  repUserId: string;
  repName: string;
  repEmail?: string | null;
  onMarked?: () => void;
}

export const MarkDoNotUseDialog: React.FC<MarkDoNotUseDialogProps> = ({
  open,
  onOpenChange,
  vendorId,
  repUserId,
  repName,
  repEmail,
  onMarked,
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: repName || "",
    primary_email: repEmail || "",
    emails: "",
    aliases: "",
    reason: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!form.full_name.trim()) {
      toast({
        title: "Full name required",
        description: "Please provide the rep's full name.",
        variant: "destructive",
      });
      return;
    }

    if (!form.reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for marking this rep as Do Not Use.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Parse comma-separated emails and aliases
      const emailsArray = form.emails
        .split(",")
        .map(e => e.trim())
        .filter(e => e.length > 0);

      const aliasesArray = form.aliases
        .split(",")
        .map(a => a.trim())
        .filter(a => a.length > 0);

      // Check if entry exists for upsert
      const { data: existingData } = await supabase
        .from("vendor_do_not_use_reps")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("rep_user_id", repUserId)
        .maybeSingle();

      if (existingData) {
        // Update existing
        const { error } = await supabase
          .from("vendor_do_not_use_reps")
          .update({
            full_name: form.full_name.trim(),
            primary_email: form.primary_email.trim() || null,
            emails: emailsArray.length > 0 ? emailsArray : null,
            aliases: aliasesArray.length > 0 ? aliasesArray : null,
            reason: form.reason.trim(),
            notes: form.notes.trim() || null,
          })
          .eq("id", existingData.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("vendor_do_not_use_reps")
          .insert({
            vendor_id: vendorId,
            rep_user_id: repUserId,
            full_name: form.full_name.trim(),
            primary_email: form.primary_email.trim() || null,
            emails: emailsArray.length > 0 ? emailsArray : null,
            aliases: aliasesArray.length > 0 ? aliasesArray : null,
            reason: form.reason.trim(),
            notes: form.notes.trim() || null,
          });

        if (error) throw error;
      }

      toast({
        title: "Added to Do Not Use",
        description: `${form.full_name} has been added to your Do Not Use list.`,
      });

      onOpenChange(false);
      onMarked?.();

      // Reset form
      setForm({
        full_name: "",
        primary_email: "",
        emails: "",
        aliases: "",
        reason: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error marking rep as DNU:", error);
      toast({
        title: "Error",
        description: "Failed to add rep to Do Not Use list.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset form when dialog opens with new rep data
  React.useEffect(() => {
    if (open) {
      setForm({
        full_name: repName || "",
        primary_email: repEmail || "",
        emails: "",
        aliases: "",
        reason: "",
        notes: "",
      });
    }
  }, [open, repName, repEmail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-destructive" />
            Mark as Do Not Use
          </DialogTitle>
          <DialogDescription>
            Add this rep to your vendor's Do Not Use list. They will be filtered out of your Connected Reps and won't appear in future searches.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="dnu-full-name">Full Name *</Label>
            <Input
              id="dnu-full-name"
              value={form.full_name}
              onChange={(e) => setForm(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dnu-primary-email">Primary Email</Label>
            <Input
              id="dnu-primary-email"
              type="email"
              value={form.primary_email}
              onChange={(e) => setForm(prev => ({ ...prev, primary_email: e.target.value }))}
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dnu-emails">Additional Emails (comma-separated)</Label>
            <Input
              id="dnu-emails"
              value={form.emails}
              onChange={(e) => setForm(prev => ({ ...prev, emails: e.target.value }))}
              placeholder="alt1@example.com, alt2@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dnu-aliases">Aliases (comma-separated)</Label>
            <Input
              id="dnu-aliases"
              value={form.aliases}
              onChange={(e) => setForm(prev => ({ ...prev, aliases: e.target.value }))}
              placeholder="Johnny, J. Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dnu-reason">Reason *</Label>
            <Input
              id="dnu-reason"
              value={form.reason}
              onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Quality issues, no-shows, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dnu-notes">Notes</Label>
            <Textarea
              id="dnu-notes"
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional details for your reference..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            variant="destructive"
          >
            {saving ? "Adding..." : "Add to Do Not Use"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MarkDoNotUseDialog;
