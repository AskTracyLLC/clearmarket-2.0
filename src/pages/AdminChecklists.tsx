import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ClipboardList, Plus, Pencil, Trash2, Users, BarChart3, 
  MessageSquareWarning, AlertTriangle, CheckCircle2, TrendingDown,
  ExternalLink, Eye, ChevronRight, ChevronDown, Check
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { adminChecklistsCopy } from "@/copy/adminChecklistsCopy";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ChecklistTemplate {
  id: string;
  name: string;
  role: "field_rep" | "vendor" | "both";
  owner_type: "system" | "vendor";
  owner_id: string | null;
  is_default: boolean;
  requires_paid_plan: boolean;
  created_at: string;
}

interface ChecklistItem {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  auto_track_key: string | null;
  sort_order: number;
  is_required: boolean;
  role: "field_rep" | "vendor" | "both";
}

interface CompletionStats {
  templateId: string;
  totalAssigned: number;
  fullyCompleted: number;
  avgPercentComplete: number;
  atLeast5Steps: number;
}

interface ItemStats {
  itemId: string;
  title: string;
  completedCount: number;
  totalAssigned: number;
  percent: number;
  feedbackCount: number;
}

interface FeedbackItem {
  id: string;
  template_name: string;
  item_title: string;
  user_email: string;
  feedback_type: string;
  message: string;
  attachment_urls: string[] | null;
  created_at: string;
  status: string;
}

interface AssignableUser {
  id: string;
  email: string;
  full_name: string | null;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
  state: string | null;
  already_assigned: boolean;
}

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  bug: "Something is broken",
  confusing: "This step is confusing",
  completed_not_marked: "Completed but not marked",
  suggestion: "Suggestion",
  other: "Other",
};

export default function AdminChecklists() {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [stats, setStats] = useState<CompletionStats[]>([]);
  const [itemStats, setItemStats] = useState<ItemStats[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("templates");

  // Dialog states
  const [editTemplateOpen, setEditTemplateOpen] = useState(false);
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [feedbackDetailOpen, setFeedbackDetailOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);

  // Template form state
  const [formTemplateName, setFormTemplateName] = useState("");
  const [formTemplateRole, setFormTemplateRole] = useState<"field_rep" | "vendor" | "both">("field_rep");
  const [formTemplateIsDefault, setFormTemplateIsDefault] = useState(false);

  // Item form state
  const [formItemTitle, setFormItemTitle] = useState("");
  const [formItemDescription, setFormItemDescription] = useState("");
  const [formItemAutoTrackKey, setFormItemAutoTrackKey] = useState("");
  const [formItemIsRequired, setFormItemIsRequired] = useState(true);
  const [formItemRole, setFormItemRole] = useState<"field_rep" | "vendor" | "both">("both");

  const [saving, setSaving] = useState(false);

  // Assign to Users tab state
  const [assignTemplateId, setAssignTemplateId] = useState<string | null>(null);
  const [assignRoleFilter, setAssignRoleFilter] = useState<"field_rep" | "vendor">("field_rep");
  const [assignStateFilter, setAssignStateFilter] = useState<string>("all");
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [vendorStates, setVendorStates] = useState<string[]>([]);
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());

  // Permission check
  useEffect(() => {
    if (!permsLoading && !permissions.canViewAdminDashboard) {
      toast.error("Access denied");
      navigate("/dashboard");
    }
  }, [permsLoading, permissions, navigate]);

  useEffect(() => {
    if (user && permissions.canViewAdminDashboard) {
      loadTemplates();
      loadFeedback();
    }
  }, [user, permissions]);

  useEffect(() => {
    if (selectedTemplateId) {
      loadItems(selectedTemplateId);
      loadItemStats(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("owner_type", "system")
        .order("role")
        .order("name");

      if (error) throw error;
      setTemplates(data as ChecklistTemplate[]);

      // Load completion stats
      await loadCompletionStats(data.map(t => t.id));

      // Auto-select first template
      if (data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load checklist templates");
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order");

      if (error) throw error;
      setItems(data as ChecklistItem[]);
    } catch (error) {
      console.error("Error loading items:", error);
      toast.error("Failed to load checklist items");
    }
  };

  const loadCompletionStats = async (templateIds: string[]) => {
    try {
      const statsPromises = templateIds.map(async (templateId) => {
        // Count total assignments
        const { count: totalAssigned } = await supabase
          .from("user_checklist_assignments")
          .select("*", { count: "exact", head: true })
          .eq("template_id", templateId);

        // Get all assignments with their items for completion calculation
        const { data: assignments } = await supabase
          .from("user_checklist_assignments")
          .select(`
            id,
            user_checklist_items (
              status
            )
          `)
          .eq("template_id", templateId);

        let fullyCompleted = 0;
        let totalPercent = 0;
        let atLeast5Steps = 0;

        if (assignments && assignments.length > 0) {
          assignments.forEach((a: any) => {
            const items = a.user_checklist_items || [];
            const completed = items.filter((i: any) => i.status === "completed").length;
            const percent = items.length > 0 ? (completed / items.length) * 100 : 0;
            totalPercent += percent;
            if (percent === 100) fullyCompleted++;
            if (completed >= 5) atLeast5Steps++;
          });
        }

        return {
          templateId,
          totalAssigned: totalAssigned || 0,
          fullyCompleted,
          avgPercentComplete: assignments && assignments.length > 0 
            ? Math.round(totalPercent / assignments.length) 
            : 0,
          atLeast5Steps,
        };
      });

      const results = await Promise.all(statsPromises);
      setStats(results);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadItemStats = async (templateId: string) => {
    try {
      // Get all items for template
      const { data: items, error: itemsError } = await supabase
        .from("checklist_items")
        .select("id, title")
        .eq("template_id", templateId)
        .order("sort_order");

      if (itemsError) throw itemsError;

      // Get total assignments for this template
      const { count: totalAssigned } = await supabase
        .from("user_checklist_assignments")
        .select("*", { count: "exact", head: true })
        .eq("template_id", templateId);

      // Get completion counts per item
      const itemStatsPromises = (items || []).map(async (item) => {
        const { count: completedCount } = await supabase
          .from("user_checklist_items")
          .select("*", { count: "exact", head: true })
          .eq("item_id", item.id)
          .eq("status", "completed");

        const { count: feedbackCount } = await supabase
          .from("checklist_item_feedback")
          .select("*", { count: "exact", head: true })
          .eq("item_id", item.id);

        return {
          itemId: item.id,
          title: item.title,
          completedCount: completedCount || 0,
          totalAssigned: totalAssigned || 0,
          percent: totalAssigned && totalAssigned > 0 
            ? Math.round(((completedCount || 0) / totalAssigned) * 100) 
            : 0,
          feedbackCount: feedbackCount || 0,
        };
      });

      const results = await Promise.all(itemStatsPromises);
      setItemStats(results);
    } catch (error) {
      console.error("Error loading item stats:", error);
    }
  };

  const loadFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from("checklist_item_feedback")
        .select(`
          id,
          feedback_type,
          message,
          attachment_urls,
          created_at,
          status,
          template:checklist_templates(name),
          item:checklist_items(title),
          user:profiles(email)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedFeedback: FeedbackItem[] = (data || []).map((f: any) => ({
        id: f.id,
        template_name: f.template?.name || "Unknown",
        item_title: f.item?.title || "Unknown",
        user_email: f.user?.email || "Unknown",
        feedback_type: f.feedback_type,
        message: f.message,
        attachment_urls: f.attachment_urls,
        created_at: f.created_at,
        status: f.status,
      }));

      setFeedback(formattedFeedback);
    } catch (error) {
      console.error("Error loading feedback:", error);
    }
  };

  const getStatsForTemplate = (templateId: string) => {
    return stats.find(s => s.templateId === templateId);
  };

  const getRepStats = () => {
    const repTemplates = templates.filter(t => t.role === "field_rep");
    const repStats = stats.filter(s => repTemplates.some(t => t.id === s.templateId));
    const totalAssigned = repStats.reduce((sum, s) => sum + s.totalAssigned, 0);
    const atLeast5 = repStats.reduce((sum, s) => sum + s.atLeast5Steps, 0);
    const avgCompletion = repStats.length > 0 
      ? Math.round(repStats.reduce((sum, s) => sum + s.avgPercentComplete, 0) / repStats.length)
      : 0;
    return { totalAssigned, atLeast5, avgCompletion, percent5Steps: totalAssigned > 0 ? Math.round((atLeast5 / totalAssigned) * 100) : 0 };
  };

  const getVendorStats = () => {
    const vendorTemplates = templates.filter(t => t.role === "vendor");
    const vendorStats = stats.filter(s => vendorTemplates.some(t => t.id === s.templateId));
    const totalAssigned = vendorStats.reduce((sum, s) => sum + s.totalAssigned, 0);
    const atLeast5 = vendorStats.reduce((sum, s) => sum + s.atLeast5Steps, 0);
    const avgCompletion = vendorStats.length > 0 
      ? Math.round(vendorStats.reduce((sum, s) => sum + s.avgPercentComplete, 0) / vendorStats.length)
      : 0;
    return { totalAssigned, atLeast5, avgCompletion, percent5Steps: totalAssigned > 0 ? Math.round((atLeast5 / totalAssigned) * 100) : 0 };
  };

  const getMostSkippedItem = (role: "field_rep" | "vendor") => {
    const roleItems = itemStats.filter(is => {
      const item = items.find(i => i.id === is.itemId);
      return item && (item.role === role || item.role === "both");
    });
    
    if (roleItems.length === 0) return null;
    
    // Find item with lowest completion percentage (most skipped)
    return roleItems.reduce((lowest, current) => 
      current.percent < lowest.percent ? current : lowest
    , roleItems[0]);
  };

  // Template CRUD
  const openAddTemplateDialog = () => {
    setEditingTemplate(null);
    setFormTemplateName("");
    setFormTemplateRole("field_rep");
    setFormTemplateIsDefault(false);
    setAddTemplateOpen(true);
  };

  const openEditTemplateDialog = (template: ChecklistTemplate) => {
    setEditingTemplate(template);
    setFormTemplateName(template.name);
    setFormTemplateRole(template.role);
    setFormTemplateIsDefault(template.is_default);
    setEditTemplateOpen(true);
  };

  const handleSaveTemplate = async (isNew: boolean) => {
    if (!formTemplateName.trim()) {
      toast.error("Template name is required");
      return;
    }
    setSaving(true);

    try {
      if (isNew) {
        const { error } = await supabase
          .from("checklist_templates")
          .insert({
            name: formTemplateName,
            role: formTemplateRole,
            owner_type: "system",
            is_default: formTemplateIsDefault,
            requires_paid_plan: false,
          });
        if (error) throw error;
        toast.success("Template created");
        setAddTemplateOpen(false);
      } else if (editingTemplate) {
        const { error } = await supabase
          .from("checklist_templates")
          .update({
            name: formTemplateName,
            role: formTemplateRole,
            is_default: formTemplateIsDefault,
          })
          .eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Template updated");
        setEditTemplateOpen(false);
      }
      await loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: ChecklistTemplate) => {
    if (!confirm(`Delete "${template.name}"? This will remove all items and assignments.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("checklist_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;
      toast.success("Template deleted");
      if (selectedTemplateId === template.id) {
        setSelectedTemplateId(null);
        setItems([]);
      }
      await loadTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  // Item CRUD
  const openAddItemDialog = () => {
    setEditingItem(null);
    setFormItemTitle("");
    setFormItemDescription("");
    setFormItemAutoTrackKey("");
    setFormItemIsRequired(true);
    setFormItemRole("both");
    setAddItemOpen(true);
  };

  const openEditItemDialog = (item: ChecklistItem) => {
    setEditingItem(item);
    setFormItemTitle(item.title);
    setFormItemDescription(item.description || "");
    setFormItemAutoTrackKey(item.auto_track_key || "");
    setFormItemIsRequired(item.is_required);
    setFormItemRole(item.role);
    setEditItemOpen(true);
  };

  const handleSaveItem = async (isNew: boolean) => {
    if (!formItemTitle.trim()) {
      toast.error("Item title is required");
      return;
    }
    if (!selectedTemplateId) {
      toast.error("No template selected");
      return;
    }
    setSaving(true);

    try {
      if (isNew) {
        // Get next sort order
        const maxOrder = items.reduce((max, i) => Math.max(max, i.sort_order), -1);
        
        const { error } = await supabase
          .from("checklist_items")
          .insert({
            template_id: selectedTemplateId,
            title: formItemTitle,
            description: formItemDescription || null,
            auto_track_key: formItemAutoTrackKey || null,
            is_required: formItemIsRequired,
            role: formItemRole,
            sort_order: maxOrder + 1,
          });
        if (error) throw error;
        toast.success("Item added");
        setAddItemOpen(false);
      } else if (editingItem) {
        const { error } = await supabase
          .from("checklist_items")
          .update({
            title: formItemTitle,
            description: formItemDescription || null,
            auto_track_key: formItemAutoTrackKey || null,
            is_required: formItemIsRequired,
            role: formItemRole,
          })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Item updated");
        setEditItemOpen(false);
      }
      await loadItems(selectedTemplateId);
      await loadItemStats(selectedTemplateId);
    } catch (error) {
      console.error("Error saving item:", error);
      toast.error("Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (item: ChecklistItem) => {
    if (!confirm(`Delete "${item.title}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
      toast.success("Item deleted");
      if (selectedTemplateId) {
        await loadItems(selectedTemplateId);
        await loadItemStats(selectedTemplateId);
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item");
    }
  };

  const handleMoveItem = async (item: ChecklistItem, direction: "up" | "down") => {
    const currentIndex = items.findIndex(i => i.id === item.id);
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;

    const swapItem = items[newIndex];
    
    try {
      await supabase
        .from("checklist_items")
        .update({ sort_order: swapItem.sort_order })
        .eq("id", item.id);
      
      await supabase
        .from("checklist_items")
        .update({ sort_order: item.sort_order })
        .eq("id", swapItem.id);

      if (selectedTemplateId) {
        await loadItems(selectedTemplateId);
      }
    } catch (error) {
      console.error("Error reordering items:", error);
      toast.error("Failed to reorder items");
    }
  };

  const openFeedbackDetail = (fb: FeedbackItem) => {
    setSelectedFeedback(fb);
    setFeedbackDetailOpen(true);
  };

  // === Assign to Users functions ===
  const loadUsersForAssignment = async () => {
    if (!assignTemplateId) return;
    
    setLoadingUsers(true);
    setSelectedUserIds(new Set());
    
    try {
      // Get existing assignments for this template
      const { data: existingAssignments } = await supabase
        .from("user_checklist_assignments")
        .select("user_id")
        .eq("template_id", assignTemplateId);
      
      const assignedUserIds = new Set((existingAssignments || []).map(a => a.user_id));

      // Load users based on role filter
      let query = supabase
        .from("profiles")
        .select("id, email, full_name, is_fieldrep, is_vendor_admin")
        .eq("account_status", "active");

      if (assignRoleFilter === "field_rep") {
        query = query.eq("is_fieldrep", true);
      } else {
        query = query.eq("is_vendor_admin", true);
      }

      const { data: users, error } = await query.order("email");
      if (error) throw error;

      // For field reps, get their state from rep_profile
      // For vendors, get their state from vendor_profile
      let usersWithState: AssignableUser[] = [];

      if (assignRoleFilter === "field_rep") {
        const { data: repProfiles } = await supabase
          .from("rep_profile")
          .select("user_id, state");
        
        const repStateMap = new Map((repProfiles || []).map(rp => [rp.user_id, rp.state]));
        
        usersWithState = (users || []).map(u => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          is_fieldrep: u.is_fieldrep,
          is_vendor_admin: u.is_vendor_admin,
          state: repStateMap.get(u.id) || null,
          already_assigned: assignedUserIds.has(u.id),
        }));
      } else {
        const { data: vendorProfiles } = await supabase
          .from("vendor_profile")
          .select("user_id, state");
        
        const vendorStateMap = new Map((vendorProfiles || []).map(vp => [vp.user_id, vp.state]));
        
        usersWithState = (users || []).map(u => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          is_fieldrep: u.is_fieldrep,
          is_vendor_admin: u.is_vendor_admin,
          state: vendorStateMap.get(u.id) || null,
          already_assigned: assignedUserIds.has(u.id),
        }));

        // Collect unique states for vendor filter
        const states = [...new Set(usersWithState.map(u => u.state).filter(Boolean))] as string[];
        states.sort();
        setVendorStates(states);
        // Expand all states by default
        setExpandedStates(new Set(states));
      }

      setAssignableUsers(usersWithState);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Reload users when template or role filter changes
  useEffect(() => {
    if (activeTab === "assign" && assignTemplateId) {
      loadUsersForAssignment();
    }
  }, [assignTemplateId, assignRoleFilter, activeTab]);

  const filteredUsers = assignableUsers.filter(u => {
    if (assignRoleFilter === "vendor" && assignStateFilter !== "all") {
      return u.state === assignStateFilter;
    }
    return true;
  });

  const groupedVendorsByState = () => {
    const groups: Record<string, AssignableUser[]> = {};
    filteredUsers.forEach(u => {
      const state = u.state || "Unknown";
      if (!groups[state]) groups[state] = [];
      groups[state].push(u);
    });
    // Sort states alphabetically
    const sortedKeys = Object.keys(groups).sort();
    const sorted: Record<string, AssignableUser[]> = {};
    sortedKeys.forEach(k => { sorted[k] = groups[k]; });
    return sorted;
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAllUsers = () => {
    const eligibleIds = filteredUsers.filter(u => !u.already_assigned).map(u => u.id);
    setSelectedUserIds(new Set(eligibleIds));
  };

  const clearAllSelection = () => {
    setSelectedUserIds(new Set());
  };

  const selectAllInState = (state: string) => {
    const usersInState = filteredUsers.filter(u => (u.state || "Unknown") === state && !u.already_assigned);
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      usersInState.forEach(u => next.add(u.id));
      return next;
    });
  };

  const clearSelectionInState = (state: string) => {
    const usersInState = filteredUsers.filter(u => (u.state || "Unknown") === state);
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      usersInState.forEach(u => next.delete(u.id));
      return next;
    });
  };

  const toggleStateExpanded = (state: string) => {
    setExpandedStates(prev => {
      const next = new Set(prev);
      if (next.has(state)) {
        next.delete(state);
      } else {
        next.add(state);
      }
      return next;
    });
  };

  const handleBulkAssign = async () => {
    if (!assignTemplateId) return;
    
    if (selectedUserIds.size === 0) {
      toast.error(adminChecklistsCopy.assignSection.validationNoSelection);
      return;
    }

    setAssigning(true);
    
    try {
      // Get all items for the template
      const { data: templateItems, error: itemsError } = await supabase
        .from("checklist_items")
        .select("id")
        .eq("template_id", assignTemplateId);

      if (itemsError) throw itemsError;

      let assignedCount = 0;

      for (const userId of selectedUserIds) {
        // Create assignment
        const { data: assignment, error: assignError } = await supabase
          .from("user_checklist_assignments")
          .insert({
            user_id: userId,
            template_id: assignTemplateId,
          })
          .select("id")
          .maybeSingle();

        if (assignError) {
          // Likely duplicate, skip
          console.log("Assignment exists for user", userId);
          continue;
        }

        if (assignment) {
          assignedCount++;
          // Create item entries
          const itemInserts = (templateItems || []).map(item => ({
            assignment_id: assignment.id,
            item_id: item.id,
            status: "pending" as const,
          }));

          if (itemInserts.length > 0) {
            await supabase
              .from("user_checklist_items")
              .insert(itemInserts);
          }
        }
      }

      toast.success(`${adminChecklistsCopy.assignSection.successToast} (${assignedCount} users)`);
      setSelectedUserIds(new Set());
      // Reload to update "already assigned" status
      await loadUsersForAssignment();
      // Refresh stats
      await loadCompletionStats(templates.map(t => t.id));
    } catch (error) {
      console.error("Error assigning checklist:", error);
      toast.error(adminChecklistsCopy.assignSection.errorToast);
    } finally {
      setAssigning(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const assignTemplate = templates.find(t => t.id === assignTemplateId);
  const repStats = getRepStats();
  const vendorStats = getVendorStats();
  const openFeedbackCount = feedback.filter(f => f.status === "open").length;

  if (authLoading || permsLoading || loading) {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{adminChecklistsCopy.pageHeader.title}</h1>
          </div>
          <p className="text-muted-foreground">
            {adminChecklistsCopy.pageHeader.subtitle}
          </p>
        </div>

        {/* Completion Overview Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Field Reps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{repStats.percent5Steps}%</p>
                <p className="text-xs text-muted-foreground">
                  completed at least 5 steps ({repStats.atLeast5} of {repStats.totalAssigned})
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg. completion: {repStats.avgCompletion}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{vendorStats.percent5Steps}%</p>
                <p className="text-xs text-muted-foreground">
                  completed at least 5 steps ({vendorStats.atLeast5} of {vendorStats.totalAssigned})
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg. completion: {vendorStats.avgCompletion}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{openFeedbackCount}</p>
                  <Badge variant={openFeedbackCount > 0 ? "destructive" : "secondary"} className="text-xs">
                    Open
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {feedback.length} total feedback reports
                </p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 text-xs"
                  onClick={() => setActiveTab("feedback")}
                >
                  View feedback →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates">{adminChecklistsCopy.tabs.templatesAndItems}</TabsTrigger>
            <TabsTrigger value="insights">{adminChecklistsCopy.tabs.completionInsights}</TabsTrigger>
            <TabsTrigger value="feedback" className="relative">
              {adminChecklistsCopy.tabs.feedback}
              {openFeedbackCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                  {openFeedbackCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assign">{adminChecklistsCopy.tabs.assignToUsers}</TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{adminChecklistsCopy.templatesSection.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {adminChecklistsCopy.templatesSection.helper}
                </p>
              </div>
              <Button onClick={openAddTemplateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                {adminChecklistsCopy.templatesSection.addTemplateButton}
              </Button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Templates List */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Templates</CardTitle>
                    <CardDescription className="text-sm">Select to edit items</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      <div className="divide-y divide-border">
                        {templates.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            {adminChecklistsCopy.templatesSection.emptyTemplates}
                          </div>
                        ) : (
                          templates.map((template) => {
                            const templateStats = getStatsForTemplate(template.id);
                            const isSelected = selectedTemplateId === template.id;
                            return (
                              <div
                                key={template.id}
                                className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                                  isSelected ? "bg-muted border-l-2 border-l-primary" : ""
                                }`}
                                onClick={() => setSelectedTemplateId(template.id)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{template.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {template.role === "field_rep" ? "Rep" : template.role === "vendor" ? "Vendor" : "Both"}
                                      </Badge>
                                      {template.is_default && (
                                        <Badge variant="secondary" className="text-xs">Default</Badge>
                                      )}
                                    </div>
                                    {templateStats && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        <Users className="inline w-3 h-3 mr-1" />
                                        {templateStats.totalAssigned} assigned · {templateStats.avgPercentComplete}% avg
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditTemplateDialog(template);
                                      }}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTemplate(template);
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Items Editor */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {selectedTemplate ? (
                            <>{adminChecklistsCopy.templateEditor.headerPrefix} {selectedTemplate.name}</>
                          ) : (
                            "Select a template"
                          )}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {selectedTemplate 
                            ? adminChecklistsCopy.templateEditor.helper
                            : adminChecklistsCopy.templatesSection.emptySelection}
                        </CardDescription>
                      </div>
                      {selectedTemplate && (
                        <Button size="sm" onClick={openAddItemDialog}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add Item
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {!selectedTemplate ? (
                      <div className="p-8 text-center text-muted-foreground">
                        {adminChecklistsCopy.templatesSection.emptySelection}
                      </div>
                    ) : items.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        {adminChecklistsCopy.templateEditor.emptyItems}
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10"></TableHead>
                              <TableHead>{adminChecklistsCopy.templateEditor.fields.titleLabel}</TableHead>
                              <TableHead>{adminChecklistsCopy.templateEditor.autoBadge.label}</TableHead>
                              <TableHead className="text-center">{adminChecklistsCopy.templateEditor.fields.requiredLabel}</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item, index) => (
                              <TableRow key={item.id}>
                                <TableCell className="w-10">
                                  <div className="flex flex-col gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      disabled={index === 0}
                                      onClick={() => handleMoveItem(item, "up")}
                                    >
                                      ▲
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      disabled={index === items.length - 1}
                                      onClick={() => handleMoveItem(item, "down")}
                                    >
                                      ▼
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-sm">{item.title}</p>
                                    {item.description && (
                                      <p className="text-xs text-muted-foreground truncate max-w-xs" title="Helper text (shown under the step)">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {item.auto_track_key ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Badge variant="outline" className="text-xs">
                                            {adminChecklistsCopy.templateEditor.autoBadge.label}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{adminChecklistsCopy.templateEditor.autoBadge.tooltip}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Manual</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {item.is_required ? (
                                    <Badge variant="default" className="text-xs">Yes</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">No</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditItemDialog(item)}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteItem(item)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{adminChecklistsCopy.completionInsights.title}</h2>
              <p className="text-sm text-muted-foreground">
                {adminChecklistsCopy.completionInsights.helper}
              </p>
            </div>

            {selectedTemplate && itemStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedTemplate.name} - Per-Item Completion</CardTitle>
                  <CardDescription>
                    See which steps are slowing people down
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{adminChecklistsCopy.completionInsights.columns.step}</TableHead>
                        <TableHead className="text-center">{adminChecklistsCopy.completionInsights.columns.completion}</TableHead>
                        <TableHead className="text-center">% Complete</TableHead>
                        <TableHead className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1 justify-center w-full">
                                {adminChecklistsCopy.completionInsights.columns.feedback}
                                <MessageSquareWarning className="w-3 h-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Number of feedback reports tied to this step (bugs, confusion, etc.)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemStats.map((is) => {
                        const isLowCompletion = is.percent < 50 && is.totalAssigned > 5;
                        return (
                          <TableRow key={is.itemId}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isLowCompletion && (
                                  <TrendingDown className="w-4 h-4 text-destructive" />
                                )}
                                <span className={isLowCompletion ? "text-destructive" : ""}>
                                  {is.title}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {is.completedCount} / {is.totalAssigned}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={is.percent >= 75 ? "default" : is.percent >= 50 ? "secondary" : "destructive"}
                              >
                                {is.percent}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {is.feedbackCount > 0 ? (
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="h-auto p-0"
                                  onClick={() => setActiveTab("feedback")}
                                >
                                  {is.feedbackCount} report{is.feedbackCount !== 1 ? "s" : ""}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {!selectedTemplate && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {adminChecklistsCopy.completionInsights.emptyNoUsers}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{adminChecklistsCopy.feedbackSection.title}</h2>
              <p className="text-sm text-muted-foreground">
                {adminChecklistsCopy.feedbackSection.helper}
              </p>
            </div>

            <Card>
              <CardContent className="p-0">
                {feedback.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {adminChecklistsCopy.feedbackSection.empty}
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{adminChecklistsCopy.feedbackSection.columns.step}</TableHead>
                          <TableHead>{adminChecklistsCopy.feedbackSection.columns.user}</TableHead>
                          <TableHead>{adminChecklistsCopy.feedbackSection.columns.type}</TableHead>
                          <TableHead>{adminChecklistsCopy.feedbackSection.columns.message}</TableHead>
                          <TableHead>{adminChecklistsCopy.feedbackSection.columns.submitted}</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feedback.map((fb) => (
                          <TableRow key={fb.id}>
                            <TableCell>
                              <div className="max-w-[200px]">
                                <p className="text-xs text-muted-foreground truncate">{fb.template_name}</p>
                                <p className="text-sm font-medium truncate">{fb.item_title}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm truncate max-w-[150px] block">{fb.user_email}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={fb.feedback_type === "bug" ? "destructive" : "secondary"} className="text-xs">
                                {fb.feedback_type === "bug" ? "Bug" : 
                                 fb.feedback_type === "confusing" ? "Confusing" :
                                 fb.feedback_type === "completed_not_marked" ? "Not marked" :
                                 fb.feedback_type === "suggestion" ? "Suggestion" : "Other"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm truncate max-w-[200px]">{fb.message}</p>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(fb.created_at), "MMM d, yyyy")}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openFeedbackDetail(fb)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assign to Users Tab */}
          <TabsContent value="assign" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{adminChecklistsCopy.assignSection.title}</h2>
              <p className="text-sm text-muted-foreground">
                {adminChecklistsCopy.assignSection.helper}
              </p>
            </div>

            {/* Template Selector */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label>{adminChecklistsCopy.assignSection.templateLabel}</Label>
                    <Select 
                      value={assignTemplateId || ""} 
                      onValueChange={(v) => setAssignTemplateId(v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={adminChecklistsCopy.assignSection.templatePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.role === "field_rep" ? "Rep" : t.role === "vendor" ? "Vendor" : "Both"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {assignTemplateId && (
                    <>
                      {/* Role Filter */}
                      <div>
                        <Label>{adminChecklistsCopy.assignSection.roleLabel}</Label>
                        <div className="flex gap-2 mt-1">
                          <Button
                            variant={assignRoleFilter === "field_rep" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setAssignRoleFilter("field_rep");
                              setAssignStateFilter("all");
                            }}
                          >
                            {adminChecklistsCopy.assignSection.roleFieldReps}
                          </Button>
                          <Button
                            variant={assignRoleFilter === "vendor" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setAssignRoleFilter("vendor");
                              setAssignStateFilter("all");
                            }}
                          >
                            {adminChecklistsCopy.assignSection.roleVendors}
                          </Button>
                        </div>
                      </div>

                      {/* State Filter (Vendors only) */}
                      {assignRoleFilter === "vendor" && vendorStates.length > 0 && (
                        <div>
                          <Label>{adminChecklistsCopy.assignSection.stateLabel}</Label>
                          <Select value={assignStateFilter} onValueChange={setAssignStateFilter}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{adminChecklistsCopy.assignSection.stateAll}</SelectItem>
                              {vendorStates.map(state => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* User List */}
            {assignTemplateId && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {assignRoleFilter === "field_rep" ? "Field Reps" : "Vendors"}
                      <span className="text-muted-foreground font-normal ml-2">
                        ({filteredUsers.length} users)
                      </span>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllUsers}>
                        {adminChecklistsCopy.assignSection.selectAll}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearAllSelection}>
                        {adminChecklistsCopy.assignSection.clearSelection}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingUsers ? (
                    <div className="p-8 text-center text-muted-foreground">Loading users...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {adminChecklistsCopy.assignSection.noUsersMatch}
                    </div>
                  ) : assignRoleFilter === "field_rep" ? (
                    // Flat table for field reps
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>{adminChecklistsCopy.assignSection.columns.name}</TableHead>
                            <TableHead>{adminChecklistsCopy.assignSection.columns.email}</TableHead>
                            <TableHead>{adminChecklistsCopy.assignSection.columns.state}</TableHead>
                            <TableHead>{adminChecklistsCopy.assignSection.columns.status}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map(user => (
                            <TableRow 
                              key={user.id} 
                              className={user.already_assigned ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}
                              onClick={() => !user.already_assigned && toggleUserSelection(user.id)}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedUserIds.has(user.id)}
                                  disabled={user.already_assigned}
                                  onCheckedChange={() => toggleUserSelection(user.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {user.full_name || "—"}
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{user.state || "—"}</TableCell>
                              <TableCell>
                                {user.already_assigned && (
                                  <Badge variant="secondary" className="text-xs">
                                    {adminChecklistsCopy.assignSection.alreadyAssignedNote}
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    // Grouped by state for vendors
                    <ScrollArea className="h-[400px]">
                      <div className="divide-y divide-border">
                        {Object.entries(groupedVendorsByState()).map(([state, users]) => (
                          <Collapsible 
                            key={state} 
                            open={expandedStates.has(state)}
                            onOpenChange={() => toggleStateExpanded(state)}
                          >
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                                <div className="flex items-center gap-2">
                                  {expandedStates.has(state) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  <span className="font-medium">State: {state}</span>
                                  <span className="text-sm text-muted-foreground">
                                    ({users.length} vendors)
                                  </span>
                                </div>
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-xs"
                                    onClick={() => selectAllInState(state)}
                                  >
                                    {adminChecklistsCopy.assignSection.selectAllInState}
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-xs"
                                    onClick={() => clearSelectionInState(state)}
                                  >
                                    {adminChecklistsCopy.assignSection.clearInState}
                                  </Button>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Table>
                                <TableBody>
                                  {users.map(user => (
                                    <TableRow 
                                      key={user.id}
                                      className={user.already_assigned ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}
                                      onClick={() => !user.already_assigned && toggleUserSelection(user.id)}
                                    >
                                      <TableCell className="w-10 pl-8">
                                        <Checkbox
                                          checked={selectedUserIds.has(user.id)}
                                          disabled={user.already_assigned}
                                          onCheckedChange={() => toggleUserSelection(user.id)}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        {user.full_name || "—"}
                                      </TableCell>
                                      <TableCell>{user.email}</TableCell>
                                      <TableCell>
                                        {user.already_assigned && (
                                          <Badge variant="secondary" className="text-xs">
                                            {adminChecklistsCopy.assignSection.alreadyAssignedNote}
                                          </Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Assign Button */}
            {assignTemplateId && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">
                  {selectedUserIds.size > 0 ? (
                    <span>{selectedUserIds.size} user{selectedUserIds.size !== 1 ? "s" : ""} selected</span>
                  ) : (
                    <span>No users selected</span>
                  )}
                </div>
                <Button 
                  onClick={handleBulkAssign} 
                  disabled={assigning || selectedUserIds.size === 0}
                >
                  {assigning 
                    ? adminChecklistsCopy.assignSection.assigningButton 
                    : adminChecklistsCopy.assignSection.assignButton}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Template Dialog */}
        <Dialog open={editTemplateOpen} onOpenChange={setEditTemplateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
              <DialogDescription>Update the template settings.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formTemplateName}
                  onChange={(e) => setFormTemplateName(e.target.value)}
                  placeholder="Template name"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formTemplateRole} onValueChange={(v: any) => setFormTemplateRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="field_rep">Field Rep</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-assign to new users</Label>
                <Switch checked={formTemplateIsDefault} onCheckedChange={setFormTemplateIsDefault} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTemplateOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSaveTemplate(false)} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Template Dialog */}
        <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Template</DialogTitle>
              <DialogDescription>Create a new system checklist template.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formTemplateName}
                  onChange={(e) => setFormTemplateName(e.target.value)}
                  placeholder="Template name"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formTemplateRole} onValueChange={(v: any) => setFormTemplateRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="field_rep">Field Rep</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-assign to new users</Label>
                <Switch checked={formTemplateIsDefault} onCheckedChange={setFormTemplateIsDefault} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddTemplateOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSaveTemplate(true)} disabled={saving}>
                {saving ? "Creating..." : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={editItemOpen} onOpenChange={setEditItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
              <DialogDescription>Update the checklist item.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>{adminChecklistsCopy.templateEditor.fields.titleLabel}</Label>
                <Input
                  value={formItemTitle}
                  onChange={(e) => setFormItemTitle(e.target.value)}
                  placeholder="Item title"
                />
              </div>
              <div>
                <Label>{adminChecklistsCopy.templateEditor.fields.descriptionLabel}</Label>
                <Textarea
                  value={formItemDescription}
                  onChange={(e) => setFormItemDescription(e.target.value)}
                  placeholder="Optional helper text shown under the step"
                  rows={2}
                />
              </div>
              <div>
                <Label>Auto-Track Key</Label>
                <Input
                  value={formItemAutoTrackKey}
                  onChange={(e) => setFormItemAutoTrackKey(e.target.value)}
                  placeholder="e.g., profile_completed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for manual completion. {adminChecklistsCopy.templateEditor.autoBadge.tooltip}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label>{adminChecklistsCopy.templateEditor.fields.requiredLabel}</Label>
                <Switch checked={formItemIsRequired} onCheckedChange={setFormItemIsRequired} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItemOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSaveItem(false)} disabled={saving}>
                {saving ? "Saving..." : adminChecklistsCopy.templateEditor.saveButton}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Item Dialog */}
        <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Item</DialogTitle>
              <DialogDescription>Add a new item to this checklist.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>{adminChecklistsCopy.templateEditor.fields.titleLabel}</Label>
                <Input
                  value={formItemTitle}
                  onChange={(e) => setFormItemTitle(e.target.value)}
                  placeholder="Step title"
                />
              </div>
              <div>
                <Label>{adminChecklistsCopy.templateEditor.fields.descriptionLabel}</Label>
                <Textarea
                  value={formItemDescription}
                  onChange={(e) => setFormItemDescription(e.target.value)}
                  placeholder="Optional helper text shown under the step"
                  rows={2}
                />
              </div>
              <div>
                <Label>Auto-Track Key</Label>
                <Input
                  value={formItemAutoTrackKey}
                  onChange={(e) => setFormItemAutoTrackKey(e.target.value)}
                  placeholder="e.g., profile_completed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for manual completion. {adminChecklistsCopy.templateEditor.autoBadge.tooltip}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label>{adminChecklistsCopy.templateEditor.fields.requiredLabel}</Label>
                <Switch checked={formItemIsRequired} onCheckedChange={setFormItemIsRequired} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSaveItem(true)} disabled={saving}>
                {saving ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Feedback Detail Dialog */}
        <Dialog open={feedbackDetailOpen} onOpenChange={setFeedbackDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{adminChecklistsCopy.feedbackSection.detail.header}</DialogTitle>
              <DialogDescription>
                {selectedFeedback?.template_name} → {selectedFeedback?.item_title}
              </DialogDescription>
            </DialogHeader>
            {selectedFeedback && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">User</Label>
                    <p className="text-sm">{selectedFeedback.user_email}</p>
                  </div>
                   <div>
                    <Label className="text-muted-foreground text-xs">{adminChecklistsCopy.feedbackSection.detail.typeLabel}</Label>
                    <p className="text-sm">{FEEDBACK_TYPE_LABELS[selectedFeedback.feedback_type] || selectedFeedback.feedback_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Date</Label>
                    <p className="text-sm">{format(new Date(selectedFeedback.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Status</Label>
                    <Badge variant={selectedFeedback.status === "open" ? "destructive" : "secondary"}>
                      {selectedFeedback.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">{adminChecklistsCopy.feedbackSection.detail.messageLabel}</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">{selectedFeedback.message}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">{adminChecklistsCopy.feedbackSection.detail.attachmentsLabel}</Label>
                  {selectedFeedback.attachment_urls && selectedFeedback.attachment_urls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {selectedFeedback.attachment_urls.map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img 
                            src={url} 
                            alt={`Attachment ${idx + 1}`}
                            className="w-full h-24 object-cover rounded border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">{adminChecklistsCopy.feedbackSection.detail.noAttachments}</p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackDetailOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
