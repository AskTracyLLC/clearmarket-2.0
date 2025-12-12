import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { ColumnDefinition } from "@/hooks/useColumnVisibility";

interface ColumnChooserProps {
  columns: ColumnDefinition[];
  visibleColumns: string[];
  onSave: (columns: string[]) => Promise<void>;
  onReset: () => Promise<void>;
  isSaving?: boolean;
}

export function ColumnChooser({
  columns,
  visibleColumns,
  onSave,
  onReset,
  isSaving = false,
}: ColumnChooserProps) {
  const [open, setOpen] = useState(false);
  const [localVisible, setLocalVisible] = useState<string[]>(visibleColumns);
  const { toast } = useToast();

  // Sync local state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalVisible(visibleColumns);
    }
    setOpen(isOpen);
  };

  const toggleColumn = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    if (column?.required) return;

    setLocalVisible((prev) =>
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId]
    );
  };

  const handleSave = async () => {
    try {
      await onSave(localVisible);
      toast({
        title: "Column preferences saved",
        description: "Your table view has been updated.",
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error saving preferences",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = async () => {
    try {
      await onReset();
      setLocalVisible(columns.map((c) => c.id));
      toast({
        title: "Reset to defaults",
        description: "Column visibility has been reset.",
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error resetting preferences",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Customize columns</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize columns</DialogTitle>
          <DialogDescription>
            Choose which columns you want to see in this table. You can hide
            columns that aren't important to you. You can always reset back to
            the default view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
          {columns.map((column) => (
            <div key={column.id} className="flex items-start space-x-3">
              <Checkbox
                id={column.id}
                checked={localVisible.includes(column.id)}
                onCheckedChange={() => toggleColumn(column.id)}
                disabled={column.required}
                aria-describedby={`${column.id}-description`}
              />
              <div className="grid gap-1 leading-none">
                <Label
                  htmlFor={column.id}
                  className={`text-sm font-medium ${
                    column.required ? "text-muted-foreground" : ""
                  }`}
                >
                  {column.label}
                  {column.required && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Always on)
                    </span>
                  )}
                </Label>
                {column.description && (
                  <p
                    id={`${column.id}-description`}
                    className="text-xs text-muted-foreground"
                  >
                    {column.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={isSaving}
            className="sm:mr-auto"
          >
            Reset to defaults
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
