import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Save, Send, Users, AlertCircle } from "lucide-react";
import { 
  fetchBroadcast,
  updateBroadcast, 
  estimateAudience, 
  fetchAudienceUsers,
  sortAudienceUsers,
  BroadcastAudience, 
  AudienceUser 
} from "@/lib/adminBroadcasts";
import { useToast } from "@/hooks/use-toast";
import { SelectableUserGrid } from "@/components/admin/SelectableUserGrid";

export default function AdminBroadcastEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const { toast } = useToast();

  // Content state
  const [title, setTitle] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Give Feedback");
  
  // Audience state
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["field_rep", "vendor"]);
  const [activeDays, setActiveDays] = useState<string>("");
  const [audienceMode, setAudienceMode] = useState<"all" | "selected">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audienceEstimate, setAudienceEstimate] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [matchingUsers, setMatchingUsers] = useState<AudienceUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [broadcastNotFound, setBroadcastNotFound] = useState(false);

  // Load existing broadcast data
  useEffect(() => {
    async function loadBroadcast() {
      if (!id || authLoading || permLoading || !user) return;
      
      setLoading(true);
      try {
        const broadcast = await fetchBroadcast(id);
        if (!broadcast) {
          setBroadcastNotFound(true);
          return;
        }
        
        // Only allow editing drafts
        if (broadcast.status !== "draft") {
          toast({
            title: "Cannot edit",
            description: "Only draft broadcasts can be edited.",
            variant: "destructive",
          });
          navigate(`/admin/broadcasts/${id}`);
          return;
        }
        
        // Populate form with existing data
        setTitle(broadcast.title);
        setEmailSubject(broadcast.email_subject || "");
        setMessage(broadcast.message_md);
        setCtaLabel(broadcast.cta_label);
        
        // Populate audience
        const audience = broadcast.audience;
        if (audience.roles && audience.roles.length > 0) {
          setSelectedRoles(audience.roles);
        }
        if (audience.active_days) {
          setActiveDays(String(audience.active_days));
        }
        if (audience.mode) {
          setAudienceMode(audience.mode);
        }
        if (audience.user_ids && audience.user_ids.length > 0) {
          setSelectedUserIds(audience.user_ids);
        }
      } catch (error) {
        console.error("Error loading broadcast:", error);
        setBroadcastNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    
    loadBroadcast();
  }, [id, authLoading, permLoading, user, navigate, toast]);

  // Build audience object for saving
  const audience: BroadcastAudience = useMemo(() => ({
    roles: selectedRoles.length > 0 ? selectedRoles : undefined,
    active_days: activeDays ? parseInt(activeDays) : undefined,
    mode: audienceMode,
    user_ids: audienceMode === "selected" ? selectedUserIds : undefined,
  }), [selectedRoles, activeDays, audienceMode, selectedUserIds]);

  // Fetch matching users when roles or active_days change
  const loadMatchingUsers = useCallback(async () => {
    if (selectedRoles.length === 0) {
      setMatchingUsers([]);
      return;
    }
    
    setLoadingUsers(true);
    try {
      const users = await fetchAudienceUsers(
        selectedRoles,
        activeDays ? parseInt(activeDays) : undefined
      );
      const sorted = sortAudienceUsers(users);
      setMatchingUsers(sorted);
    } catch (error) {
      console.error("Error fetching users:", error);
      setMatchingUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [selectedRoles.join(","), activeDays]);

  // Reload users when filters change
  useEffect(() => {
    if (!authLoading && !permLoading && user && audienceMode === "selected" && !loading) {
      loadMatchingUsers();
    }
  }, [authLoading, permLoading, user, audienceMode, loadMatchingUsers, loading]);

  // Update audience estimate
  const updateAudienceEstimate = useCallback(async () => {
    setEstimating(true);
    try {
      const count = await estimateAudience(audience);
      setAudienceEstimate(count);
    } catch {
      setAudienceEstimate(null);
    } finally {
      setEstimating(false);
    }
  }, [audience]);

  useEffect(() => {
    if (!authLoading && !permLoading && user && !loading) {
      updateAudienceEstimate();
    }
  }, [authLoading, permLoading, user, updateAudienceEstimate, loading]);

  // Split users by role
  const fieldRepUsers = useMemo(() => {
    return matchingUsers.filter((u) => u.is_fieldrep);
  }, [matchingUsers]);

  const vendorUsers = useMemo(() => {
    return matchingUsers.filter((u) => u.is_vendor_admin);
  }, [matchingUsers]);

  const handleRoleToggle = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllInSection = (ids: string[]) => {
    setSelectedUserIds((prev) => {
      const combined = new Set([...prev, ...ids]);
      return Array.from(combined);
    });
  };

  const handleSelectNoneInSection = (ids: string[]) => {
    setSelectedUserIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const handleSave = async (andSend: boolean = false) => {
    if (!id) return;
    
    if (!title.trim() || !message.trim()) {
      toast({
        title: "Missing required fields",
        description: "Title and message are required.",
        variant: "destructive",
      });
      return;
    }

    if (selectedRoles.length === 0) {
      toast({
        title: "No audience selected",
        description: "Select at least one role for the audience.",
        variant: "destructive",
      });
      return;
    }

    if (audienceMode === "selected" && selectedUserIds.length === 0) {
      toast({
        title: "No users selected",
        description: "Select at least one user or switch to 'All matching users'.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await updateBroadcast(id, {
        title: title.trim(),
        email_subject: emailSubject.trim() || undefined,
        message_md: message.trim(),
        cta_label: ctaLabel.trim() || "Give Feedback",
        audience,
      });

      toast({ title: "Broadcast updated" });

      if (andSend) {
        navigate(`/admin/broadcasts/${id}?send=true`);
      } else {
        navigate(`/admin/broadcasts/${id}`);
      }
    } catch (error) {
      console.error("Error updating broadcast:", error);
      toast({
        title: "Error updating broadcast",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  if (authLoading || permLoading || loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!permissions.canManageBroadcasts) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Admin access required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (broadcastNotFound) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Broadcast not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/broadcasts")}>
              Back to Broadcasts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate(`/admin/broadcasts/${id}`)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Broadcast
      </Button>

      <h1 className="text-2xl font-bold mb-6">Edit Broadcast</h1>

      <div className="space-y-6">
        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>What message do you want to send?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., We'd love your feedback!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_subject">Email Subject (optional)</Label>
              <Input
                id="email_subject"
                placeholder="Defaults to title if empty"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                placeholder="Write your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                This will appear in the notification and email body.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta_label">CTA Button Label</Label>
              <Input
                id="cta_label"
                placeholder="Give Feedback"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Audience */}
        <Card>
          <CardHeader>
            <CardTitle>Audience</CardTitle>
            <CardDescription>Who should receive this broadcast?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Roles */}
            <div className="space-y-3">
              <Label>User Roles</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role_field_rep"
                    checked={selectedRoles.includes("field_rep")}
                    onCheckedChange={() => handleRoleToggle("field_rep")}
                  />
                  <Label htmlFor="role_field_rep" className="font-normal cursor-pointer">
                    Field Reps
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role_vendor"
                    checked={selectedRoles.includes("vendor")}
                    onCheckedChange={() => handleRoleToggle("vendor")}
                  />
                  <Label htmlFor="role_vendor" className="font-normal cursor-pointer">
                    Vendors
                  </Label>
                </div>
              </div>
              {selectedRoles.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-500">
                  <AlertCircle className="h-4 w-4" />
                  Select at least one role to build an audience.
                </div>
              )}
            </div>

            {/* Active Days */}
            <div className="space-y-2">
              <Label htmlFor="active_days">Active within last X days (optional)</Label>
              <Input
                id="active_days"
                type="number"
                min="1"
                placeholder="e.g., 30"
                value={activeDays}
                onChange={(e) => setActiveDays(e.target.value)}
                className="max-w-32"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to include all active users regardless of last activity.
              </p>
            </div>

            {/* Audience Mode */}
            <div className="space-y-3">
              <Label>Audience Mode</Label>
              <RadioGroup
                value={audienceMode}
                onValueChange={(value) => setAudienceMode(value as "all" | "selected")}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="mode_all" />
                  <Label htmlFor="mode_all" className="font-normal cursor-pointer">
                    All matching users
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="mode_selected" />
                  <Label htmlFor="mode_selected" className="font-normal cursor-pointer">
                    Select specific users
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* User Selection Panel (only when mode = selected) */}
            {audienceMode === "selected" && selectedRoles.length > 0 && (
              <div className="space-y-6 border rounded-lg p-4 bg-muted/30">
                {/* Field Reps Section */}
                {selectedRoles.includes("field_rep") && (
                  <SelectableUserGrid
                    title="Field Reps"
                    users={fieldRepUsers}
                    selectedIds={selectedUserIds}
                    onToggle={handleUserToggle}
                    onSelectAll={handleSelectAllInSection}
                    onSelectNone={handleSelectNoneInSection}
                    loading={loadingUsers}
                  />
                )}

                {/* Vendors Section */}
                {selectedRoles.includes("vendor") && (
                  <SelectableUserGrid
                    title="Vendors"
                    users={vendorUsers}
                    selectedIds={selectedUserIds}
                    onToggle={handleUserToggle}
                    onSelectAll={handleSelectAllInSection}
                    onSelectNone={handleSelectNoneInSection}
                    loading={loadingUsers}
                  />
                )}

                {/* Total selected audience */}
                <div className="pt-2 border-t text-sm text-muted-foreground">
                  <strong className="text-foreground">{selectedUserIds.length}</strong> user{selectedUserIds.length !== 1 ? "s" : ""} selected total
                </div>
              </div>
            )}

            {/* Audience Estimate */}
            <div className="pt-2 flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              {estimating ? (
                <span className="text-muted-foreground">Estimating...</span>
              ) : audienceEstimate !== null ? (
                <span className="text-muted-foreground">
                  {audienceMode === "selected" ? "Selected" : "Estimated"} audience:{" "}
                  <strong className="text-foreground">{audienceEstimate}</strong> users
                </span>
              ) : (
                <span className="text-muted-foreground">Could not estimate audience</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            <Send className="h-4 w-4 mr-2" />
            Save & Continue to Send
          </Button>
        </div>
      </div>
    </div>
  );
}
