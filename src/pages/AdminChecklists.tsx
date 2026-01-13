import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";

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
  ExternalLink, Eye
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { adminChecklistsCopy } from "@/copy/adminChecklistsCopy";
import { adminChecklistAssignmentsCopy } from "@/copy/adminChecklistAssignmentsCopy";
import { Checkbox } from "@/components/ui/checkbox";
import { ChecklistUserProgressTable } from "@/components/ChecklistUserProgressTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  user_full_name: string | null;
  user_is_fieldrep: boolean;
  user_is_vendor_admin: boolean;
  rep_anonymous_id: string | null;
  vendor_anonymous_id: string | null;
  feedback_type: string;
  message: string;
  attachment_urls: string[] | null;
  created_at: string;
  status: "open" | "reviewed" | "fixed";
  reviewed_at: string | null;
  fixed_at: string | null;
}

interface AssignableUser {
  id: string;
  email: string;
  full_name: string | null;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
  state: string | null;
  coverageAreas: string[];
  companyName: string | null;
  accountStatus: string;
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
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false);

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
          user_id,
          feedback_type,
          message,
          attachment_urls,
          created_at,
          status,
          reviewed_at,
          fixed_at,
          template:checklist_templates(name),
          item:checklist_items(title),
          user:profiles!checklist_item_feedback_user_id_fkey(
            email,
            full_name,
            is_fieldrep,
            is_vendor_admin
          ),
          resolved_by_profile:profiles!checklist_item_feedback_resolved_by_fkey(email)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch rep/vendor anonymous IDs for users
      const userIds = [...new Set((data || []).map((f: any) => f.user_id).filter(Boolean))];
      
      // Get rep profiles
      const { data: repProfiles } = await supabase
        .from("rep_profile")
        .select("user_id, anonymous_id")
        .in("user_id", userIds.length > 0 ? userIds : ['']);
      
      // Get vendor profiles  
      const { data: vendorProfiles } = await supabase
        .from("vendor_profile")
        .select("user_id, anonymous_id")
        .in("user_id", userIds.length > 0 ? userIds : ['']);
      
      const repMap = new Map((repProfiles || []).map(r => [r.user_id, r.anonymous_id]));
      const vendorMap = new Map((vendorProfiles || []).map(v => [v.user_id, v.anonymous_id]));

      const formattedFeedback: FeedbackItem[] = (data || []).map((f: any) => ({
        id: f.id,
        template_name: f.template?.name || "Unknown",
        item_title: f.item?.title || "Unknown",
        user_email: f.user?.email || "Unknown",
        user_full_name: f.user?.full_name || null,
        user_is_fieldrep: f.user?.is_fieldrep || false,
        user_is_vendor_admin: f.user?.is_vendor_admin || false,
        rep_anonymous_id: repMap.get(f.user_id) || null,
        vendor_anonymous_id: vendorMap.get(f.user_id) || null,
        feedback_type: f.feedback_type,
        message: f.message,
        attachment_urls: f.attachment_urls,
        created_at: f.created_at,
        status: f.status || "open",
        reviewed_at: f.reviewed_at,
        fixed_at: f.fixed_at,
      }));

      setFeedback(formattedFeedback);
    } catch (error) {
      console.error("Error loading feedback:", error);
    }
  };

  const handleUpdateFeedbackStatus = async (id: string, newStatus: "reviewed" | "fixed") => {
    try {
      const timestamps: { reviewed_at?: string; fixed_at?: string } = {};
      if (newStatus === "reviewed") {
        timestamps.reviewed_at = new Date().toISOString();
      } else if (newStatus === "fixed") {
        timestamps.fixed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("checklist_item_feedback")
        .update({ status: newStatus, ...timestamps })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Feedback marked as ${newStatus}`);
      await loadFeedback();
    } catch (error) {
      console.error("Error updating feedback status:", error);
      toast.error("Failed to update feedback status");
    }
  };

  const getUserDisplayLabel = (fb: FeedbackItem): string => {
    const firstName = fb.user_full_name?.split(" ")[0];
    const lastInitial = fb.user_full_name?.split(" ")[1]?.[0];
    const displayName = firstName && lastInitial 
      ? `${firstName} ${lastInitial}.` 
      : fb.user_full_name || null;
    
    if (fb.user_is_fieldrep && fb.rep_anonymous_id) {
      return displayName ? `${displayName} (${fb.rep_anonymous_id})` : fb.rep_anonymous_id;
    }
    if (fb.user_is_vendor_admin && fb.vendor_anonymous_id) {
      return displayName ? `${displayName} (${fb.vendor_anonymous_id})` : fb.vendor_anonymous_id;
    }
    return displayName || fb.user_email;
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

      // Load all users (both reps and vendors)
      const { data: users, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, is_fieldrep, is_vendor_admin, account_status")
        .or("is_fieldrep.eq.true,is_vendor_admin.eq.true")
        .order("email");
      
      if (error) throw error;

      // Get rep profiles and coverage areas
      const { data: repProfiles } = await supabase
        .from("rep_profile")
        .select("user_id, state");
      
      const { data: repCoverageAreas } = await supabase
        .from("rep_coverage_areas")
        .select("user_id, state_name, county_name");
      
      const repStateMap = new Map((repProfiles || []).map(rp => [rp.user_id, rp.state]));
      
      // Group rep coverage areas by user
      const repCoverageMap = new Map<string, string[]>();
      (repCoverageAreas || []).forEach(ca => {
        const areas = repCoverageMap.get(ca.user_id) || [];
        const areaLabel = ca.county_name ? `${ca.county_name}, ${ca.state_name}` : ca.state_name;
        if (!areas.includes(areaLabel)) {
          areas.push(areaLabel);
        }
        repCoverageMap.set(ca.user_id, areas);
      });

      // Get vendor profiles and coverage areas
      const { data: vendorProfiles } = await supabase
        .from("vendor_profile")
        .select("user_id, state, company_name");

      const { data: vendorCoverage } = await supabase
        .from("vendor_coverage_areas")
        .select("user_id, state_name, county_name");
      
      const vendorStateMap = new Map((vendorProfiles || []).map(vp => [vp.user_id, vp.state]));
      const vendorCompanyMap = new Map((vendorProfiles || []).map(vp => [vp.user_id, vp.company_name]));
      
      // Group vendor coverage areas by user
      const vendorCoverageMap = new Map<string, string[]>();
      (vendorCoverage || []).forEach(ca => {
        const areas = vendorCoverageMap.get(ca.user_id) || [];
        const areaLabel = ca.county_name ? `${ca.county_name}, ${ca.state_name}` : ca.state_name;
        if (!areas.includes(areaLabel)) {
          areas.push(areaLabel);
        }
        vendorCoverageMap.set(ca.user_id, areas);
      });

      // Build user list with appropriate data based on their roles
      const usersWithState: AssignableUser[] = (users || []).map(u => {
        // Use rep data for reps, vendor data for vendors
        const isRep = u.is_fieldrep;
        const isVendor = u.is_vendor_admin;
        
        let state: string | null = null;
        let coverageAreas: string[] = [];
        let companyName: string | null = null;
        
        if (isRep) {
          state = repStateMap.get(u.id) || null;
          coverageAreas = repCoverageMap.get(u.id) || [];
        }
        if (isVendor) {
          state = state || vendorStateMap.get(u.id) || null;
          coverageAreas = coverageAreas.length > 0 ? coverageAreas : (vendorCoverageMap.get(u.id) || []);
          companyName = vendorCompanyMap.get(u.id) || null;
        }
        
        return {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          is_fieldrep: u.is_fieldrep,
          is_vendor_admin: u.is_vendor_admin,
          state,
          coverageAreas,
          companyName,
          accountStatus: u.account_status || "active",
          already_assigned: assignedUserIds.has(u.id),
        };
      });

      setAssignableUsers(usersWithState);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Reload users when template changes
  useEffect(() => {
    if (activeTab === "assign" && assignTemplateId) {
      loadUsersForAssignment();
    }
  }, [assignTemplateId, activeTab]);

  // Reset search when switching roles within "both" templates
  useEffect(() => {
    setSearchQuery("");
  }, [assignRoleFilter]);

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

  const handleBulkAssign = async () => {
    if (!selectedTemplateId || !user) return;
    
    if (selectedUserIds.size === 0) {
      toast.error(adminChecklistAssignmentsCopy.actions.assignDisabled);
      return;
    }

    setAssigning(true);
    setConfirmAssignOpen(false);
    
    try {
      // Get all items for the template
      const { data: templateItems, error: itemsError } = await supabase
        .from("checklist_items")
        .select("id")
        .eq("template_id", selectedTemplateId);

      if (itemsError) throw itemsError;

      // Get template to determine if it's vendor-owned
      const template = templates.find(t => t.id === selectedTemplateId);

      let assignedCount = 0;

      for (const userId of selectedUserIds) {
        // Create assignment
        const { data: assignment, error: assignError } = await supabase
          .from("user_checklist_assignments")
          .insert({
            user_id: userId,
            template_id: selectedTemplateId,
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

          // Log the assignment event
          await supabase.from("checklist_assignment_events").insert({
            template_id: selectedTemplateId,
            user_id: userId,
            vendor_id: template?.owner_type === 'vendor' ? template.owner_id : null,
            assigned_by: user.id,
            source: 'manual_admin',
          });
        }
      }

      toast.success(`${adminChecklistAssignmentsCopy.actions.toast.success} (${assignedCount} users)`);
      setSelectedUserIds(new Set());
      // Reload to update "already assigned" status
      await loadUsersForAssignment();
      // Refresh stats
      await loadCompletionStats(templates.map(t => t.id));
    } catch (error) {
      console.error("Error assigning checklist:", error);
      toast.error(adminChecklistAssignmentsCopy.actions.toast.error);
    } finally {
      setAssigning(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const assignTemplate = templates.find(t => t.id === assignTemplateId);
  const repStats = getRepStats();
  const vendorStats = getVendorStats();
  const openFeedbackCount = feedback.filter(f => f.status === "open").length;
  const reviewedFeedbackCount = feedback.filter(f => f.status === "reviewed").length;
  const fixedFeedbackCount = feedback.filter(f => f.status === "fixed").length;

  if (authLoading || permsLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">{adminChecklistsCopy.pageHeader.title}</h1>
            </div>
            <p className="text-muted-foreground">
              {adminChecklistsCopy.pageHeader.subtitle}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/checklists/log")}>
            Assignment Log
          </Button>
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xl font-bold">{openFeedbackCount}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200">Open</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm">{reviewedFeedbackCount}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200">Reviewed</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm">{fixedFeedbackCount}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200">Fixed</span>
                </div>
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
            <TabsTrigger value="users">{adminChecklistsCopy.tabs.users}</TabsTrigger>
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
                          <TableHead>Status</TableHead>
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
                              <span className="text-sm truncate max-w-[180px] block">{getUserDisplayLabel(fb)}</span>
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                fb.status === "open" 
                                  ? "bg-amber-500/20 text-amber-200" 
                                  : fb.status === "reviewed"
                                  ? "bg-sky-500/20 text-sky-200"
                                  : "bg-emerald-500/20 text-emerald-200"
                              }`}>
                                {fb.status === "open" ? "Open" : fb.status === "reviewed" ? "Reviewed" : "Fixed"}
                              </span>
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
                              <div className="flex items-center justify-end gap-2">
                                {fb.status !== "reviewed" && fb.status !== "fixed" && (
                                  <button
                                    className="text-xs underline underline-offset-2 text-sky-300 hover:text-sky-200"
                                    onClick={() => handleUpdateFeedbackStatus(fb.id, "reviewed")}
                                  >
                                    Mark reviewed
                                  </button>
                                )}
                                {fb.status !== "fixed" && (
                                  <button
                                    className="text-xs underline underline-offset-2 text-emerald-300 hover:text-emerald-200"
                                    onClick={() => handleUpdateFeedbackStatus(fb.id, "fixed")}
                                  >
                                    Mark fixed
                                  </button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openFeedbackDetail(fb)}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
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
          </TabsContent>

          {/* Assign Tab */}
          <TabsContent value="assign" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{adminChecklistAssignmentsCopy.tabTitle}</h2>
              <p className="text-sm text-muted-foreground">
                {adminChecklistAssignmentsCopy.tabHelper}
              </p>
            </div>

            {/* Template Selector */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-xs">Select Template to Assign</Label>
                    <Select 
                      value={assignTemplateId || ""} 
                      onValueChange={(v) => {
                        setAssignTemplateId(v || null);
                        setSelectedUserIds(new Set());
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose a template..." />
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
                </div>
              </CardContent>
            </Card>

            {!assignTemplateId ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">
                    {adminChecklistAssignmentsCopy.noTemplateSelected.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {adminChecklistAssignmentsCopy.noTemplateSelected.description}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Field Reps Section */}
                {(assignTemplate?.role === "field_rep" || assignTemplate?.role === "both") && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{adminChecklistAssignmentsCopy.fieldReps.header}</CardTitle>
                      <CardDescription>{adminChecklistAssignmentsCopy.fieldReps.helper}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Search Input */}
                      <Input
                        placeholder={adminChecklistAssignmentsCopy.fieldReps.searchPlaceholder}
                        value={assignRoleFilter === "field_rep" ? searchQuery : ""}
                        onChange={(e) => {
                          setAssignRoleFilter("field_rep");
                          setSearchQuery(e.target.value);
                        }}
                        onFocus={() => setAssignRoleFilter("field_rep")}
                      />

                      {/* Master Checkbox */}
                      {(() => {
                        const repUsers = assignableUsers.filter(u => u.is_fieldrep);
                        const filteredReps = repUsers.filter(u => {
                          if (!searchQuery.trim()) return true;
                          return u.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
                        });
                        const eligibleReps = filteredReps.filter(u => !u.already_assigned);
                        const selectedRepCount = filteredReps.filter(u => selectedUserIds.has(u.id)).length;
                        const allSelected = eligibleReps.length > 0 && eligibleReps.every(u => selectedUserIds.has(u.id));

                        const toggleAllReps = () => {
                          if (allSelected) {
                            // Deselect all
                            setSelectedUserIds(prev => {
                              const next = new Set(prev);
                              filteredReps.forEach(u => next.delete(u.id));
                              return next;
                            });
                          } else {
                            // Select all eligible
                            setSelectedUserIds(prev => {
                              const next = new Set(prev);
                              eligibleReps.forEach(u => next.add(u.id));
                              return next;
                            });
                          }
                        };

                        return (
                          <>
                            <div className="flex items-center gap-2 py-2 border-b">
                              <Checkbox
                                id="masterReps"
                                checked={allSelected && eligibleReps.length > 0}
                                disabled={eligibleReps.length === 0}
                                onCheckedChange={toggleAllReps}
                              />
                              <Label htmlFor="masterReps" className="text-sm font-medium cursor-pointer">
                                {adminChecklistAssignmentsCopy.fieldReps.masterLabel}
                              </Label>
                            </div>

                            {/* Checkbox List */}
                            {loadingUsers ? (
                              <div className="py-8 text-center text-muted-foreground">Loading...</div>
                            ) : repUsers.length === 0 ? (
                              <div className="py-8 text-center text-muted-foreground">
                                {adminChecklistAssignmentsCopy.fieldReps.empty.noUsers}
                              </div>
                            ) : filteredReps.length === 0 ? (
                              <div className="py-8 text-center text-muted-foreground">
                                {adminChecklistAssignmentsCopy.fieldReps.empty.noMatches}
                              </div>
                            ) : (
                              <ScrollArea className="h-[280px]">
                                <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                                  {filteredReps.map(user => {
                                    // Get unique states from coverage areas
                                    const statesSet = new Set<string>();
                                    user.coverageAreas.forEach(area => {
                                      const parts = area.split(", ");
                                      if (parts.length >= 2) {
                                        statesSet.add(parts[parts.length - 1]);
                                      }
                                    });
                                    if (user.state && !statesSet.has(user.state)) {
                                      statesSet.add(user.state);
                                    }
                                    const statesArray = Array.from(statesSet).sort();
                                    const statesLabel = statesArray.length > 0 ? ` (${statesArray.join(", ")})` : "";
                                    const displayName = user.full_name || user.email;

                                    return (
                                      <div 
                                        key={user.id}
                                        className={`flex items-start gap-2 py-1.5 px-1 rounded hover:bg-muted/50 ${user.already_assigned ? "opacity-50" : "cursor-pointer"}`}
                                        onClick={() => !user.already_assigned && toggleUserSelection(user.id)}
                                      >
                                        <Checkbox
                                          checked={selectedUserIds.has(user.id)}
                                          disabled={user.already_assigned}
                                          onCheckedChange={() => toggleUserSelection(user.id)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-0.5 shrink-0"
                                        />
                                        <span className="text-sm break-words">
                                          {displayName}{statesLabel}
                                          {user.already_assigned && (
                                            <Badge variant="outline" className="text-xs ml-1">
                                              {adminChecklistAssignmentsCopy.badges.alreadyAssigned}
                                            </Badge>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            )}

                            {/* Footer */}
                            <div className="pt-2 border-t text-sm text-muted-foreground">
                              {selectedRepCount === 0
                                ? adminChecklistAssignmentsCopy.fieldReps.footer.noneSelected
                                : adminChecklistAssignmentsCopy.fieldReps.footer.someSelected.replace("{count}", String(selectedRepCount))}
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                {/* Vendors Section */}
                {(assignTemplate?.role === "vendor" || assignTemplate?.role === "both") && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{adminChecklistAssignmentsCopy.vendors.header}</CardTitle>
                      <CardDescription>{adminChecklistAssignmentsCopy.vendors.helper}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Search Input */}
                      <Input
                        placeholder={adminChecklistAssignmentsCopy.vendors.searchPlaceholder}
                        value={assignRoleFilter === "vendor" ? searchQuery : ""}
                        onChange={(e) => {
                          setAssignRoleFilter("vendor");
                          setSearchQuery(e.target.value);
                        }}
                        onFocus={() => setAssignRoleFilter("vendor")}
                      />

                      {/* Master Checkbox */}
                      {(() => {
                        const vendorUsers = assignableUsers.filter(u => u.is_vendor_admin);
                        const filteredVendors = vendorUsers.filter(u => {
                          if (!searchQuery.trim()) return true;
                          const searchLower = searchQuery.toLowerCase();
                          return u.full_name?.toLowerCase().includes(searchLower) || 
                                 u.companyName?.toLowerCase().includes(searchLower);
                        });
                        const eligibleVendors = filteredVendors.filter(u => !u.already_assigned);
                        const selectedVendorCount = filteredVendors.filter(u => selectedUserIds.has(u.id)).length;
                        const allSelected = eligibleVendors.length > 0 && eligibleVendors.every(u => selectedUserIds.has(u.id));

                        const toggleAllVendors = () => {
                          if (allSelected) {
                            setSelectedUserIds(prev => {
                              const next = new Set(prev);
                              filteredVendors.forEach(u => next.delete(u.id));
                              return next;
                            });
                          } else {
                            setSelectedUserIds(prev => {
                              const next = new Set(prev);
                              eligibleVendors.forEach(u => next.add(u.id));
                              return next;
                            });
                          }
                        };

                        return (
                          <>
                            <div className="flex items-center gap-2 py-2 border-b">
                              <Checkbox
                                id="masterVendors"
                                checked={allSelected && eligibleVendors.length > 0}
                                disabled={eligibleVendors.length === 0}
                                onCheckedChange={toggleAllVendors}
                              />
                              <Label htmlFor="masterVendors" className="text-sm font-medium cursor-pointer">
                                {adminChecklistAssignmentsCopy.vendors.masterLabel}
                              </Label>
                            </div>

                            {/* Checkbox List */}
                            {loadingUsers ? (
                              <div className="py-8 text-center text-muted-foreground">Loading...</div>
                            ) : vendorUsers.length === 0 ? (
                              <div className="py-8 text-center text-muted-foreground">
                                {adminChecklistAssignmentsCopy.vendors.empty.noUsers}
                              </div>
                            ) : filteredVendors.length === 0 ? (
                              <div className="py-8 text-center text-muted-foreground">
                                {adminChecklistAssignmentsCopy.vendors.empty.noMatches}
                              </div>
                            ) : (
                              <ScrollArea className="h-[280px]">
                                <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                                  {filteredVendors.map(user => {
                                    // Get unique states from coverage areas
                                    const statesSet = new Set<string>();
                                    user.coverageAreas.forEach(area => {
                                      const parts = area.split(", ");
                                      if (parts.length >= 2) {
                                        statesSet.add(parts[parts.length - 1]);
                                      }
                                    });
                                    if (user.state && !statesSet.has(user.state)) {
                                      statesSet.add(user.state);
                                    }
                                    const statesArray = Array.from(statesSet).sort();
                                    const statesLabel = statesArray.length > 0 ? ` (${statesArray.join(", ")})` : "";
                                    const displayName = user.companyName || user.full_name || user.email;

                                    return (
                                      <div 
                                        key={user.id}
                                        className={`flex items-start gap-2 py-1.5 px-1 rounded hover:bg-muted/50 ${user.already_assigned ? "opacity-50" : "cursor-pointer"}`}
                                        onClick={() => !user.already_assigned && toggleUserSelection(user.id)}
                                      >
                                        <Checkbox
                                          checked={selectedUserIds.has(user.id)}
                                          disabled={user.already_assigned}
                                          onCheckedChange={() => toggleUserSelection(user.id)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-0.5 shrink-0"
                                        />
                                        <span className="text-sm break-words">
                                          {displayName}{statesLabel}
                                          {user.already_assigned && (
                                            <Badge variant="outline" className="text-xs ml-1">
                                              {adminChecklistAssignmentsCopy.badges.alreadyAssigned}
                                            </Badge>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            )}

                            {/* Footer */}
                            <div className="pt-2 border-t text-sm text-muted-foreground">
                              {selectedVendorCount === 0
                                ? adminChecklistAssignmentsCopy.vendors.footer.noneSelected
                                : adminChecklistAssignmentsCopy.vendors.footer.someSelected.replace("{count}", String(selectedVendorCount))}
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                {/* Assign Button */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    {selectedUserIds.size === 0
                      ? adminChecklistAssignmentsCopy.actions.assignDisabled
                      : `${selectedUserIds.size} user(s) selected`}
                  </div>
                  <Button 
                    onClick={() => setConfirmAssignOpen(true)} 
                    disabled={assigning || selectedUserIds.size === 0}
                  >
                    {assigning ? "Assigning..." : adminChecklistAssignmentsCopy.actions.assignButton}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">User Progress</h2>
              <p className="text-sm text-muted-foreground">
                Select a template to see who has it assigned and their completion progress.
              </p>
            </div>

            {/* Template selector for Users tab */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Select Template</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {templates.map((template) => (
                    <Button
                      key={template.id}
                      variant={selectedTemplateId === template.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      {template.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedTemplateId ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {selectedTemplate?.name} – Assigned Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChecklistUserProgressTable templateId={selectedTemplateId} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Select a template above to view user progress.
                </CardContent>
              </Card>
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

        {/* Confirm Assignment Dialog */}
        <AlertDialog open={confirmAssignOpen} onOpenChange={setConfirmAssignOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{adminChecklistAssignmentsCopy.actions.confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {adminChecklistAssignmentsCopy.actions.confirm.description.replace("{count}", String(selectedUserIds.size))}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{adminChecklistAssignmentsCopy.actions.confirm.cancelButton}</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkAssign}>
                {adminChecklistAssignmentsCopy.actions.confirm.confirmButton}
              </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
