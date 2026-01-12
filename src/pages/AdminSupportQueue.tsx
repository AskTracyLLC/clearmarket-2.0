import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Inbox,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useQueueItems, QueueFilters } from "@/hooks/useQueueItems";
import { useQueueCounts } from "@/hooks/useQueueCounts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { VendorVerificationDetailPanel } from "@/components/admin/VendorVerificationDetailPanel";
import { DualRoleRequestDetailPanel } from "@/components/admin/DualRoleRequestDetailPanel";
import { SupportQueueItemCard } from "@/components/admin/SupportQueueItemCard";
import { SupportQueueItemDetail } from "@/components/admin/SupportQueueItemDetail";
import {
  SUPPORT_QUEUE_CATEGORIES,
  STATUS_OPTIONS,
  QueueCategory,
  QueueStatus,
} from "@/config/supportQueueCategories";

export default function AdminSupportQueue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const { toast } = useToast();

  // Get filter values from URL
  const categoryFromUrl = searchParams.get("category") as QueueCategory | null;
  const statusFromUrl = searchParams.get("status") as QueueStatus | null;
  const sourceType = searchParams.get("source_type");
  const sourceId = searchParams.get("source_id");

  const [selectedCategory, setSelectedCategory] = useState<QueueCategory | null>(categoryFromUrl);
  const [selectedStatus, setSelectedStatus] = useState<QueueStatus | null>(statusFromUrl);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Build filters
  const filters: QueueFilters = {
    category: selectedCategory,
    status: selectedStatus,
    search: searchQuery || undefined,
    source_type: sourceType || undefined,
    source_id: sourceId || undefined,
  };

  const { items, loading: itemsLoading, refresh, updateStatus, assignTo } = useQueueItems(filters);
  const { counts, loading: countsLoading, refresh: refreshCounts } = useQueueCounts();

  const selectedItem = selectedItemId ? items.find(item => item.id === selectedItemId) : null;

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory);
    if (selectedStatus) params.set("status", selectedStatus);
    if (sourceType) params.set("source_type", sourceType);
    if (sourceId) params.set("source_id", sourceId);
    setSearchParams(params, { replace: true });
  }, [selectedCategory, selectedStatus, sourceType, sourceId, setSearchParams]);

  // Clear source filters when category changes
  useEffect(() => {
    if (selectedCategory && (sourceType || sourceId)) {
      const params = new URLSearchParams(searchParams);
      params.delete("source_type");
      params.delete("source_id");
      setSearchParams(params, { replace: true });
    }
  }, [selectedCategory]);

  const handleCategoryClick = (category: QueueCategory | null) => {
    setSelectedCategory(category);
    setSelectedItemId(null);
  };

  const handleStatusChange = async (itemId: string, newStatus: QueueStatus) => {
    const success = await updateStatus(itemId, newStatus);
    if (success) {
      toast({ title: "Status updated" });
      refreshCounts();
    } else {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
    return success;
  };

  const handleRefresh = async () => {
    await Promise.all([refresh(), refreshCounts()]);
    toast({ title: "Refreshed" });
  };

  // Handle category change from detail panel - switch filter to new category so item doesn't disappear
  const handleCategoryChange = (itemId: string, newCategory: QueueCategory) => {
    // If we're currently filtering by a specific category and the item moved out,
    // switch to the new category so admin can continue working on it
    if (selectedCategory && selectedCategory !== newCategory) {
      setSelectedCategory(newCategory);
    }
    // Refresh to get updated data
    refresh();
    refreshCounts();
  };

  if (authLoading || permsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!permissions.canViewModeration) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Support Queue</h1>
        <p className="text-muted-foreground text-sm">
          Unified inbox for all admin tasks
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-180px)]">
        {/* Left Rail - Category Navigation */}
        <div className="col-span-12 md:col-span-3 lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2 pt-4 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 py-0">
              <nav className="flex flex-col gap-0.5">
                {/* All Items */}
                <button
                  onClick={() => handleCategoryClick(null)}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors",
                    selectedCategory === null
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Inbox className="h-4 w-4" />
                    All Items
                  </span>
                  {countsLoading ? (
                    <Skeleton className="h-5 w-8" />
                  ) : counts.total > 0 ? (
                    <Badge variant="secondary" className="text-xs">
                      {counts.total}
                    </Badge>
                  ) : null}
                </button>

                {/* Urgent */}
                {counts.urgent > 0 && (
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedStatus(null);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-muted"
                  >
                    <span className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      Urgent
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      {counts.urgent}
                    </Badge>
                  </button>
                )}

                <div className="h-px bg-border my-2" />

                {/* Category Items - rendered from config */}
                {SUPPORT_QUEUE_CATEGORIES.map((config) => {
                  const count = counts[config.key as keyof typeof counts] as number || 0;
                  const IconComponent = config.icon;

                  return (
                    <button
                      key={config.key}
                      onClick={() => handleCategoryClick(config.key)}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors",
                        selectedCategory === config.key
                          ? "bg-accent text-accent-foreground font-medium"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={config.color}>
                          <IconComponent className="h-4 w-4" />
                        </span>
                        {config.label}
                      </span>
                      {countsLoading ? (
                        <Skeleton className="h-5 w-8" />
                      ) : count > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {count}
                        </Badge>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Center - Task List */}
        <div className="col-span-12 md:col-span-5 lg:col-span-5">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 pt-4 px-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 h-9"
                />
                <Select
                  value={selectedStatus || "all"}
                  onValueChange={(v) => setSelectedStatus(v === "all" ? null : v as QueueStatus)}
                >
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-2 py-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-2">
                {itemsLoading ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mb-2 text-green-500/50" />
                    <p className="text-sm text-center px-4">
                      {selectedCategory 
                        ? (SUPPORT_QUEUE_CATEGORIES.find(c => c.key === selectedCategory)?.emptyStateCopy || "No items in this queue")
                        : "No items in this queue"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {items.map((item) => (
                      <SupportQueueItemCard
                        key={item.id}
                        item={{
                          id: item.id,
                          category: item.category,
                          title: item.title,
                          preview: item.preview,
                          priority: item.priority,
                          status: item.status,
                          created_at: item.created_at,
                          metadata: item.metadata,
                          assignee: item.assignee,
                        }}
                        isSelected={selectedItemId === item.id}
                        onClick={() => setSelectedItemId(item.id)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right - Detail Panel */}
        <div className="col-span-12 md:col-span-4 lg:col-span-5">
          <Card className="h-full flex flex-col overflow-hidden">
            {selectedItem ? (
              // Use specialized panel for vendor_verification, generic panel for all others
              selectedItem.category === "vendor_verification" ? (
                <VendorVerificationDetailPanel
                  item={selectedItem}
                  onStatusChange={handleStatusChange}
                  onAssign={assignTo}
                  onRefresh={() => {
                    refresh();
                    refreshCounts();
                  }}
                />
              ) : selectedItem.category === "dual_role_requests" ? (
                <DualRoleRequestDetailPanel
                  item={selectedItem}
                  onStatusChange={handleStatusChange}
                  onAssign={assignTo}
                  onRefresh={() => {
                    refresh();
                    refreshCounts();
                  }}
                />
              ) : (
                <SupportQueueItemDetail
                  item={selectedItem}
                  onStatusChange={handleStatusChange}
                  onAssign={assignTo}
                  onRefresh={() => {
                    refresh();
                    refreshCounts();
                  }}
                  onCategoryChange={handleCategoryChange}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Inbox className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Select an item to view details</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
