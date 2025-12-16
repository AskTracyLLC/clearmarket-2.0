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
import { MessageSquareWarning } from "lucide-react";
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

export function ChecklistUserProgressTable({ templateId, vendorId }: ChecklistUserProgressTableProps) {
  const [users, setUsers] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);

  const copy = checklistUserProgressCopy;

  useEffect(() => {
    if (templateId) {
      loadUserProgress();
    }
  }, [templateId, vendorId]);

  const loadUserProgress = async () => {
    setLoading(true);
    try {
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

      // If vendor context, filter to only connected reps
      if (vendorId) {
        const { data: connections } = await supabase
          .from("vendor_connections")
          .select("field_rep_id")
          .eq("vendor_id", vendorId)
          .eq("status", "connected");

        const connectedRepIds = new Set(connections?.map(c => c.field_rep_id) || []);
        userIds = userIds.filter(id => connectedRepIds.has(id));
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

      // Get feedback for these users on this template
      const { data: feedbackData } = await supabase
        .from("checklist_item_feedback")
        .select("user_id")
        .eq("template_id", templateId)
        .in("user_id", userIds);

      const usersWithFeedback = new Set(feedbackData?.map(f => f.user_id) || []);

      // Build user progress data
      const progressData: UserProgress[] = assignments
        .filter(a => userIds.includes(a.user_id))
        .map(assignment => {
          const profile = profiles?.find(p => p.id === assignment.user_id);
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

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
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
  }, [users, searchQuery, showOnlyIncomplete]);

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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{copy.tabHelper}</p>
      
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
              <TableHead>{copy.table.columns.user}</TableHead>
              <TableHead>{copy.table.columns.role}</TableHead>
              <TableHead>{copy.table.columns.completion}</TableHead>
              <TableHead>{copy.table.columns.steps}</TableHead>
              <TableHead>{copy.table.columns.lastUpdated}</TableHead>
              <TableHead>{copy.table.columns.feedback}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No users match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.userName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{user.userEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
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
