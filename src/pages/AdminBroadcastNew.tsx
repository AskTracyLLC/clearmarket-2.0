import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Send, Users, Search, X, AlertCircle } from "lucide-react";
import { 
  createBroadcast, 
  estimateAudience, 
  fetchAudienceUsers,
  sortAudienceUsers,
  formatAudienceUserLabel,
  BroadcastAudience, 
  AudienceUser 
} from "@/lib/adminBroadcasts";
import { useToast } from "@/hooks/use-toast";

export default function AdminBroadcastNew() {
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
  const [userSearch, setUserSearch] = useState("");
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [audienceEstimate, setAudienceEstimate] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [matchingUsers, setMatchingUsers] = useState<AudienceUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
    if (!authLoading && !permLoading && user && audienceMode === "selected") {
      loadMatchingUsers();
    }
  }, [authLoading, permLoading, user, audienceMode, loadMatchingUsers]);

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
    if (!authLoading && !permLoading && user) {
      updateAudienceEstimate();
    }
  }, [authLoading, permLoading, user, updateAudienceEstimate]);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return matchingUsers;
    
    const searchLower = userSearch.toLowerCase();
    return matchingUsers.filter((u) => {
      const fullName = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return fullName.includes(searchLower) || email.includes(searchLower);
    });
  }, [matchingUsers, userSearch]);

  // Check if a user ID is in the current filtered list
  const matchingUserIds = useMemo(() => new Set(matchingUsers.map(u => u.id)), [matchingUsers]);

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

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredUsers.map((u) => u.id);
    setSelectedUserIds((prev) => {
      const combined = new Set([...prev, ...filteredIds]);
      return Array.from(combined);
    });
  };

  const handleClearSelection = () => {
    setSelectedUserIds([]);
  };

  const handleSave = async (andSend: boolean = false) => {
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
      const broadcast = await createBroadcast({
        title: title.trim(),
        email_subject: emailSubject.trim() || undefined,
        message_md: message.trim(),
        cta_label: ctaLabel.trim() || "Give Feedback",
        audience,
      });

      toast({ title: "Broadcast saved" });

      if (andSend) {
        navigate(`/admin/broadcasts/${broadcast.id}?send=true`);
      } else {
        navigate(`/admin/broadcasts/${broadcast.id}`);
      }
    } catch (error) {
      console.error("Error saving broadcast:", error);
      toast({
        title: "Error saving broadcast",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Get role label for user
  const getRoleLabel = (user: AudienceUser) => {
    if (user.is_fieldrep && user.is_vendor_admin) return "Rep & Vendor";
    if (user.is_fieldrep) return "Field Rep";
    if (user.is_vendor_admin) return "Vendor";
    return "User";
  };

  if (authLoading || permLoading) {
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

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate("/admin/broadcasts")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Broadcasts
      </Button>

      <h1 className="text-2xl font-bold mb-6">New Feedback Broadcast</h1>

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
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                {/* Search and controls */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9"
                    />
                    {userSearch && (
                      <button
                        onClick={() => setUserSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllFiltered}
                      disabled={filteredUsers.length === 0}
                    >
                      Select all ({filteredUsers.length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearSelection}
                      disabled={selectedUserIds.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Selected count */}
                {selectedUserIds.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{selectedUserIds.length}</strong> user{selectedUserIds.length !== 1 ? "s" : ""} selected
                    {selectedUserIds.some(id => !matchingUserIds.has(id)) && (
                      <span className="text-amber-500 ml-2">
                        (includes users no longer matching filters)
                      </span>
                    )}
                  </div>
                )}

                {/* User list */}
                {loadingUsers ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Loading users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    {userSearch ? "No users match your search." : "No matching users found."}
                  </div>
                ) : (
                  <ScrollArea className="h-64 border rounded-md bg-background">
                    <div className="p-2 space-y-1">
                      {filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleUserToggle(user.id)}
                        >
                          <Checkbox
                            checked={selectedUserIds.includes(user.id)}
                            onCheckedChange={() => handleUserToggle(user.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {formatAudienceUserLabel(user)}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {getRoleLabel(user)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
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
            Save Draft
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
