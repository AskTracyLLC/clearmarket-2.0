import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Inbox,
  Star,
  ShieldAlert,
  FileCheck,
  Flag,
  CreditCard,
  Headphones,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  User,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useQueueItems, QueueCategory, QueueStatus, QueueItem, QueueFilters } from "@/hooks/useQueueItems";
import { useQueueCounts } from "@/hooks/useQueueCounts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORY_CONFIG: Record<QueueCategory, { label: string; icon: React.ReactNode; color: string }> = {
  reviews: { label: "Reviews", icon: <Star className="h-4 w-4" />, color: "text-amber-400" },
  moderation: { label: "Moderation", icon: <ShieldAlert className="h-4 w-4" />, color: "text-red-400" },
  background_checks: { label: "Background Checks", icon: <FileCheck className="h-4 w-4" />, color: "text-blue-400" },
  user_reports: { label: "User Reports", icon: <Flag className="h-4 w-4" />, color: "text-orange-400" },
  billing: { label: "Billing", icon: <CreditCard className="h-4 w-4" />, color: "text-green-400" },
  support_tickets: { label: "Support Tickets", icon: <Headphones className="h-4 w-4" />, color: "text-purple-400" },
  other: { label: "Other", icon: <MoreHorizontal className="h-4 w-4" />, color: "text-muted-foreground" },
};

const STATUS_CONFIG: Record<QueueStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Open", variant: "destructive" },
  in_progress: { label: "In Progress", variant: "default" },
  waiting: { label: "Waiting", variant: "secondary" },
  resolved: { label: "Resolved", variant: "outline" },
};

export default function AdminSupportQueue() {
  const navigate = useNavigate();
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
  };

  const handleAssignToMe = async (itemId: string) => {
    if (!user) return;
    const success = await assignTo(itemId, user.id);
    if (success) {
      toast({ title: "Assigned to you" });
    } else {
      toast({ title: "Failed to assign", variant: "destructive" });
    }
  };

  const handleUnassign = async (itemId: string) => {
    const success = await assignTo(itemId, null);
    if (success) {
      toast({ title: "Unassigned" });
    } else {
      toast({ title: "Failed to unassign", variant: "destructive" });
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refresh(), refreshCounts()]);
    toast({ title: "Refreshed" });
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
                      // Filter by priority in items hook
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

                {/* Category Items */}
                {(Object.keys(CATEGORY_CONFIG) as QueueCategory[]).map((category) => {
                  const config = CATEGORY_CONFIG[category];
                  const count = counts[category];

                  return (
                    <button
                      key={category}
                      onClick={() => handleCategoryClick(category)}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors",
                        selectedCategory === category
                          ? "bg-accent text-accent-foreground font-medium"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={config.color}>{config.icon}</span>
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
                    {(Object.keys(STATUS_CONFIG) as QueueStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_CONFIG[status].label}
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
                    <p className="text-sm">No items in this queue</p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {items.map((item) => {
                      const categoryConfig = CATEGORY_CONFIG[item.category as QueueCategory];
                      const statusConfig = STATUS_CONFIG[item.status as QueueStatus];

                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className={cn(
                            "w-full text-left p-3 rounded-md border transition-colors",
                            selectedItemId === item.id
                              ? "bg-accent border-accent-foreground/20"
                              : "bg-card hover:bg-muted border-transparent"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={categoryConfig?.color || "text-muted-foreground"}>
                                {categoryConfig?.icon}
                              </span>
                              <span className="font-medium text-sm truncate">{item.title}</span>
                            </div>
                            {item.priority === "urgent" && (
                              <Badge variant="destructive" className="text-[10px] shrink-0">
                                Urgent
                              </Badge>
                            )}
                          </div>
                          {item.preview && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2 ml-6">
                              {item.preview}
                            </p>
                          )}
                          <div className="flex items-center gap-2 ml-6">
                            <Badge variant={statusConfig?.variant || "secondary"} className="text-[10px]">
                              {statusConfig?.label || item.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(item.created_at), "MMM d, h:mm a")}
                            </span>
                            {item.assignee && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {item.assignee.full_name || "Assigned"}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right - Detail Panel */}
        <div className="col-span-12 md:col-span-4 lg:col-span-5">
          <Card className="h-full flex flex-col">
            {selectedItem ? (
              <>
                <CardHeader className="pb-2 pt-4 px-4 flex-shrink-0 border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={CATEGORY_CONFIG[selectedItem.category as QueueCategory]?.color}>
                          {CATEGORY_CONFIG[selectedItem.category as QueueCategory]?.icon}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_CONFIG[selectedItem.category as QueueCategory]?.label}
                        </Badge>
                        {selectedItem.priority === "urgent" && (
                          <Badge variant="destructive" className="text-xs">Urgent</Badge>
                        )}
                      </div>
                      <h2 className="font-semibold text-lg">{selectedItem.title}</h2>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {selectedItem.target_url && (
                          <DropdownMenuItem onClick={() => navigate(selectedItem.target_url!)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Source
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {selectedItem.assigned_to === user?.id ? (
                          <DropdownMenuItem onClick={() => handleUnassign(selectedItem.id)}>
                            Unassign from me
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleAssignToMe(selectedItem.id)}>
                            Assign to me
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-4">
                  <div className="space-y-6">
                    {/* Preview/Description */}
                    {selectedItem.preview && (
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Details</h3>
                        <p className="text-sm">{selectedItem.preview}</p>
                      </div>
                    )}

                    {/* Status Controls */}
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Status</h3>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(STATUS_CONFIG) as QueueStatus[]).map((status) => (
                          <Button
                            key={status}
                            variant={selectedItem.status === status ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleStatusChange(selectedItem.id, status)}
                            disabled={selectedItem.status === status}
                          >
                            {STATUS_CONFIG[status].label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Assignment */}
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Assignment</h3>
                      {selectedItem.assignee ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedItem.assignee.full_name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleUnassign(selectedItem.id)}
                          >
                            Unassign
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignToMe(selectedItem.id)}
                        >
                          <User className="h-4 w-4 mr-2" />
                          Assign to me
                        </Button>
                      )}
                    </div>

                    {/* Metadata */}
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Timeline</h3>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          Created: {format(new Date(selectedItem.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                        {selectedItem.resolved_at && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Resolved: {format(new Date(selectedItem.resolved_at), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Deep Link */}
                    {selectedItem.target_url && (
                      <div>
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={() => navigate(selectedItem.target_url!)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Full Details
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </>
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
