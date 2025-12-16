import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { assignTemplateToRep, ChecklistTemplate } from "@/lib/checklists";
import { vendorChecklistsCopy } from "@/copy/vendorChecklistsCopy";

interface AssignChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repUserId: string;
  repName: string;
  onAssigned?: () => void;
}

export function AssignChecklistDialog({
  open,
  onOpenChange,
  repUserId,
  repName,
  onAssigned,
}: AssignChecklistDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [existingAssignments, setExistingAssignments] = useState<string[]>([]);

  useEffect(() => {
    if (open && user) {
      loadTemplates();
      loadExistingAssignments();
    }
  }, [open, user, repUserId]);

  const loadTemplates = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("owner_type", "vendor")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("user_checklist_assignments")
        .select("template_id")
        .eq("user_id", repUserId);

      if (error) throw error;
      setExistingAssignments(data?.map(a => a.template_id) || []);
    } catch (error) {
      console.error("Error loading existing assignments:", error);
    }
  };

  const handleAssign = async () => {
    if (!selectedTemplateId || !user) return;

    setAssigning(true);
    try {
      const result = await assignTemplateToRep(supabase, selectedTemplateId, repUserId);
      
      if (result) {
        toast({
          title: copy.assignDialog.toasts.assignSuccess,
          description: copy.assignDialog.toasts.assignSuccessDescription.replace("{repName}", repName),
        });
        onAssigned?.();
        onOpenChange(false);
        setSelectedTemplateId(null);
      } else {
        toast({
          title: vendorChecklistsCopy.toasts.error,
          description: copy.assignDialog.toasts.assignError,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error assigning checklist:", error);
      toast({
        title: vendorChecklistsCopy.toasts.error,
        description: error.message || copy.assignDialog.toasts.assignError,
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const copy = vendorChecklistsCopy;

  const availableTemplates = templates.filter(
    t => !existingAssignments.includes(t.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.assignDialog.title.replace("{repName}", repName)}</DialogTitle>
          <DialogDescription>
            {copy.assignDialog.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/30">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                {copy.assignDialog.emptyNoTemplates}
              </p>
              <p className="text-xs text-muted-foreground">
                {copy.assignDialog.emptyNoTemplatesHelper}
              </p>
            </div>
          ) : availableTemplates.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/30">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {copy.assignDialog.emptyAllAssigned}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px] pr-4">
              <RadioGroup
                value={selectedTemplateId || ""}
                onValueChange={setSelectedTemplateId}
                className="space-y-3"
              >
                {availableTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedTemplateId === template.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <RadioGroupItem value={template.id} id={template.id} className="mt-1" />
                    <div className="flex-1">
                      <Label
                        htmlFor={template.id}
                        className="font-medium text-foreground cursor-pointer"
                      >
                        {template.name}
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {template.role === "field_rep" ? "Field Rep" : template.role === "vendor" ? "Vendor" : "Both"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assigning}>
            {copy.assignDialog.cancelButton}
          </Button>
          <Button
            onClick={handleAssign}
            disabled={assigning || !selectedTemplateId || availableTemplates.length === 0}
          >
            {assigning ? copy.assignDialog.assigningButton : copy.assignDialog.assignButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
