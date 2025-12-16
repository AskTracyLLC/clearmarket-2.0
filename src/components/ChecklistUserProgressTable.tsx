import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageSquareWarning, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { checklistUserProgressCopy } from "@/copy/checklistUserProgressCopy";

interface UserProgress {
  userId: string;
  userName: string | null;
  userEmail: string;
  role: "Field Rep" | "Vendor";
  completedCount: number;
  totalCount: number;
  percent: number;
  lastUpdated: string | null;
  hasFeedback: boolean;
}

interface ChecklistUserProgressTableProps {
  templateId: string;
  vendorId?: string; // If provided, only show connected reps for this vendor
}

type SortColumn = "user" | "role" | "completion" | "steps" | "lastUpdated" | "feedback";
type SortDirection = "asc" | "desc";

type TemplateRole = "field_rep" | "vendor" | "both";

export function ChecklistUserProgressTable({ templateId, vendorId }: ChecklistUserProgressTableProps) {
  const [users, setUsers] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("completion");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [templateRole, setTemplateRole] = useState<TemplateRole>("both");
  const [isVendorTemplate, setIsVendorTemplate] = useState(false);

  const copy = checklistUserProgressCopy;

  useEffect(() => {
    if (templateId) {
      loadUserProgress();
    }
  }, [templateId, vendorId]);

  const loadUserProgress = async () => {
    setLoading(true);
    try {
      // First, fetch the template to get its role and owner_type
      const { data: templateData, error: templateError } = await supabase
        .from("checklist_templates")
        .select("role, owner_type")
        .eq("id", templateId)
        .single();

      if (templateError) throw templateError;
      
      const tRole = (templateData?.role as TemplateRole) || "both";
      const vendorOwned = templateData?.owner_type === "vendor";
      setTemplateRole(tRole);
      setIsVendorTemplate(vendorOwned);

      // Get all assignments for this template
      let assignmentsQuery = supabase
        .from("user_checklist_assignments")
        .select(`
          id,
          user_id,
          updated_at,
          user_checklist_items (
            status,
            updated_at
          )
        `)
        .eq("template_id", templateId);

      const { data: assignments, error: assignError } = await assignmentsQuery;

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Get user IDs
      let userIds = assignments.map(a => a.user_id);

      // For vendor templates OR if vendorId context provided, filter to only connected field reps
      if (vendorId || vendorOwned) {
        // Get vendor ID - either from prop or from template owner
        let filterVendorId = vendorId;
        if (!filterVendorId && vendorOwned) {
          const { data: fullTemplate } = await supabase
            .from("checklist_templates")
            .select("owner_id")
            .eq("id", templateId)
            .single();
          filterVendorId = fullTemplate?.owner_id || undefined;
        }

        if (filterVendorId) {
          const { data: connections } = await supabase
            .from("vendor_connections")
            .select("field_rep_id")
            .eq("vendor_id", filterVendorId)
            .eq("status", "connected");

          const connectedRepIds = new Set(connections?.map(c => c.field_rep_id) || []);
          userIds = userIds.filter(id => connectedRepIds.has(id));
        }
      }

      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_fieldrep, is_vendor_admin")
        .in("id", userIds);

      // Filter profiles based on template role
      const filteredProfiles = (profiles || []).filter(p => {
        if (tRole === "field_rep") {
          return p.is_fieldrep === true;
        } else if (tRole === "vendor") {
          return p.is_vendor_admin === true;
        }
        // 'both' - show all
        return true;
      });

      const filteredUserIds = new Set(filteredProfiles.map(p => p.id));

      // Get feedback for these users on this template
      const { data: feedbackData } = await supabase
        .from("checklist_item_feedback")
        .select("user_id")
        .eq("template_id", templateId)
        .in("user_id", Array.from(filteredUserIds));

      const usersWithFeedback = new Set(feedbackData?.map(f => f.user_id) || []);

      // Build user progress data (only for users matching template role)
      const progressData: UserProgress[] = assignments
        .filter(a => filteredUserIds.has(a.user_id))
        .map(assignment => {
          const profile = filteredProfiles.find(p => p.id === assignment.user_id);
          const items = (assignment.user_checklist_items as Array<{ status: string; updated_at: string }>) || [];
          const completedCount = items.filter(i => i.status === "completed").length;
          const totalCount = items.length;
          
          // Get most recent update
          const itemDates = items.map(i => new Date(i.updated_at).getTime());
          const assignmentDate = new Date(assignment.updated_at).getTime();
          const allDates = [...itemDates, assignmentDate];
          const lastUpdated = allDates.length > 0 
            ? new Date(Math.max(...allDates)).toISOString() 
            : assignment.updated_at;

          return {
            userId: assignment.user_id,
            userName: profile?.full_name || null,
            userEmail: profile?.email || "Unknown",
            role: profile?.is_fieldrep ? "Field Rep" : "Vendor",
            completedCount,
            totalCount,
            percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
            lastUpdated,
            hasFeedback: usersWithFeedback.has(assignment.user_id),
          };
        });

      setUsers(progressData);
    } catch (error) {
      console.error("Error loading user progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const sortedAndFilteredUsers = useMemo(() => {
    // First filter
    const filtered = users.filter(user => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = user.userName?.toLowerCase().includes(query);
        const matchesEmail = user.userEmail.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail) return false;
      }
      
      // Incomplete filter
      if (showOnlyIncomplete && user.percent >= 100) {
        return false;
      }
      
      return true;
    });

    // Then sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "user":
          comparison = (a.userName || a.userEmail).localeCompare(b.userName || b.userEmail);
          break;
        case "role":
          comparison = a.role.localeCompare(b.role);
          break;
        case "completion":
          comparison = a.percent - b.percent;
          break;
        case "steps":
          comparison = a.completedCount - b.completedCount;
          break;
        case "lastUpdated":
          const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
          const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case "feedback":
          comparison = (a.hasFeedback ? 1 : 0) - (b.hasFeedback ? 1 : 0);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [users, searchQuery, showOnlyIncomplete, sortColumn, sortDirection]);

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {copy.table.noAssignments}
      </div>
    );
  }

  const getRoleBadge = () => {
    if (isVendorTemplate) {
      return <Badge variant="outline" className="ml-2">For your Field Reps</Badge>;
    }
    switch (templateRole) {
      case "field_rep":
        return <Badge variant="outline" className="ml-2">Field Rep checklist</Badge>;
      case "vendor":
        return <Badge variant="outline" className="ml-2">Vendor checklist</Badge>;
      default:
        return <Badge variant="outline" className="ml-2">Both roles</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <p className="text-sm text-muted-foreground">{copy.tabHelper}</p>
        {getRoleBadge()}
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <Input
          placeholder={copy.filters.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Switch
            id="incomplete-filter"
            checked={showOnlyIncomplete}
            onCheckedChange={setShowOnlyIncomplete}
          />
          <Label htmlFor="incomplete-filter" className="text-sm">
            {copy.filters.showOnlyIncomplete}
          </Label>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort("user")}
              >
                <div className="flex items-center">
                  {copy.table.columns.user}
                  <SortIcon column="user" />
                </div>
              </TableHead>
              {/* Only show Role column for admin (non-vendor) templates */}
              {!isVendorTemplate && (
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("role")}
                >
                  <div className="flex items-center">
                    {copy.table.columns.role}
                    <SortIcon column="role" />
                  </div>
                </TableHead>
              )}
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort("completion")}
              >
                <div className="flex items-center">
                  {copy.table.columns.completion}
                  <SortIcon column="completion" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort("steps")}
              >
                <div className="flex items-center">
                  {copy.table.columns.steps}
                  <SortIcon column="steps" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort("lastUpdated")}
              >
                <div className="flex items-center">
                  {copy.table.columns.lastUpdated}
                  <SortIcon column="lastUpdated" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort("feedback")}
              >
                <div className="flex items-center">
                  {copy.table.columns.feedback}
                  <SortIcon column="feedback" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isVendorTemplate ? 5 : 6} className="text-center text-muted-foreground py-8">
                  No users match your filters.
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.userName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{user.userEmail}</div>
                    </div>
                    </TableCell>
                    {!isVendorTemplate && (
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                    )}
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress value={user.percent} className="h-2 flex-1" />
                      <span className="text-sm text-muted-foreground w-12">
                        {user.percent}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {copy.table.stepsFormat
                      .replace("{completed}", String(user.completedCount))
                      .replace("{total}", String(user.totalCount))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastUpdated 
                      ? format(new Date(user.lastUpdated), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {user.hasFeedback ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="secondary" className="gap-1">
                              <MessageSquareWarning className="h-3 w-3" />
                              {copy.feedback.hasFeedback}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{copy.feedback.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-sm text-muted-foreground">{copy.feedback.none}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}