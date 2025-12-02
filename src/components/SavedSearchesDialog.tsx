import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bell, BellOff, Play, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getSavedSearches, updateSavedSearch, deleteSavedSearch, type SavedSearch } from "@/lib/savedSearches";

interface SavedSearchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  roleContext: "vendor_find_reps" | "rep_find_vendors" | "rep_find_work";
  onRunSearch: (filters: any) => void;
}

export function SavedSearchesDialog({
  open,
  onOpenChange,
  userId,
  roleContext,
  onRunSearch,
}: SavedSearchesDialogProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadSearches();
    }
  }, [open, userId, roleContext]);

  const loadSearches = async () => {
    setLoading(true);
    const data = await getSavedSearches(userId, roleContext);
    setSearches(data);
    setLoading(false);
  };

  const handleToggleActive = async (searchId: string, currentActive: boolean) => {
    const { error } = await updateSavedSearch(searchId, { is_active: !currentActive });
    
    if (error) {
      toast.error("Failed to update search");
      return;
    }

    toast.success(currentActive ? "Alerts disabled" : "Alerts enabled");
    loadSearches();
  };

  const handleDelete = async (searchId: string, searchName: string) => {
    if (!confirm(`Delete saved search "${searchName}"?`)) return;

    const { error } = await deleteSavedSearch(searchId);
    
    if (error) {
      toast.error("Failed to delete search");
      return;
    }

    toast.success("Search deleted");
    loadSearches();
  };

  const handleRunSearch = (filters: any) => {
    onRunSearch(filters);
    onOpenChange(false);
    toast.success("Search filters applied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saved Searches</DialogTitle>
          <DialogDescription>
            Manage your saved searches and get alerts when new matches appear.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : searches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No saved searches yet. Save your current filters to get alerts when new matches appear.
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {searches.map((search) => (
              <div
                key={search.id}
                className="border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{search.name}</h3>
                      {search.is_active ? (
                        <Badge variant="secondary" className="text-xs">
                          <Bell className="w-3 h-3 mr-1" />
                          Alerts on
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <BellOff className="w-3 h-3 mr-1" />
                          Alerts off
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {search.last_run_at
                        ? `Last checked ${formatDistanceToNow(new Date(search.last_run_at), { addSuffix: true })}`
                        : "Never checked"}
                    </p>
                  </div>
                  <Switch
                    checked={search.is_active}
                    onCheckedChange={() => handleToggleActive(search.id, search.is_active)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRunSearch(search.search_filters)}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Run Search
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(search.id, search.name)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
