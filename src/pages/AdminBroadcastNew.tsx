import { useState, useEffect, useCallback } from "react";
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
import { ArrowLeft, Save, Send, Users } from "lucide-react";
import { createBroadcast, estimateAudience, BroadcastAudience } from "@/lib/adminBroadcasts";
import { useToast } from "@/hooks/use-toast";

export default function AdminBroadcastNew() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Give Feedback");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["field_rep", "vendor"]);
  const [activeDays, setActiveDays] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [audienceEstimate, setAudienceEstimate] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);

  const audience: BroadcastAudience = {
    roles: selectedRoles.length > 0 ? selectedRoles : undefined,
    active_days: activeDays ? parseInt(activeDays) : undefined,
  };

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
  }, [selectedRoles.join(","), activeDays]);

  useEffect(() => {
    if (!authLoading && !permLoading && user) {
      updateAudienceEstimate();
    }
  }, [authLoading, permLoading, user, updateAudienceEstimate]);

  const handleRoleToggle = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
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
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>User Roles</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role_field_rep"
                    checked={selectedRoles.includes("field_rep")}
                    onCheckedChange={() => handleRoleToggle("field_rep")}
                  />
                  <Label htmlFor="role_field_rep" className="font-normal">
                    Field Reps
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role_vendor"
                    checked={selectedRoles.includes("vendor")}
                    onCheckedChange={() => handleRoleToggle("vendor")}
                  />
                  <Label htmlFor="role_vendor" className="font-normal">
                    Vendors
                  </Label>
                </div>
              </div>
            </div>

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

            <div className="pt-2 flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              {estimating ? (
                <span className="text-muted-foreground">Estimating...</span>
              ) : audienceEstimate !== null ? (
                <span className="text-muted-foreground">
                  Estimated audience: <strong className="text-foreground">{audienceEstimate}</strong> users
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
