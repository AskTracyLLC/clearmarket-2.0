import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar, Send, Plus, Edit, Trash2, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, parseISO } from "date-fns";

interface AvailabilityEntry {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  auto_reply_enabled: boolean;
  auto_reply_message: string | null;
  created_at: string;
}

export default function RepAvailability() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [availabilityEntries, setAvailabilityEntries] = useState<AvailabilityEntry[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AvailabilityEntry | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  
  // Form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyMessage, setAutoReplyMessage] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Alert form state
  const [alertType, setAlertType] = useState<"planned" | "emergency" | "update">("planned");
  const [alertStartDate, setAlertStartDate] = useState("");
  const [alertEndDate, setAlertEndDate] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [sendingAlert, setSendingAlert] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    loadData();
  }, [user, authLoading, navigate]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    try {
      // Check if user is a field rep
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_fieldrep, is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_fieldrep && !profile?.is_admin) {
        toast({
          title: "Access Denied",
          description: "This feature is only available for Field Reps.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      // Load availability entries
      await loadAvailabilityEntries();
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailabilityEntries() {
    if (!user) return;

    const { data, error } = await supabase
      .from("rep_availability")
      .select("*")
      .eq("rep_user_id", user.id)
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Error loading availability:", error);
      return;
    }

    setAvailabilityEntries(data || []);
  }

  function openAddDialog() {
    setEditingEntry(null);
    setStartDate("");
    setEndDate("");
    setReason("");
    setAutoReplyEnabled(false);
    setAutoReplyMessage("");
    setShowAddDialog(true);
  }

  function openEditDialog(entry: AvailabilityEntry) {
    setEditingEntry(entry);
    setStartDate(entry.start_date);
    setEndDate(entry.end_date);
    setReason(entry.reason || "");
    setAutoReplyEnabled(entry.auto_reply_enabled);
    setAutoReplyMessage(entry.auto_reply_message || "");
    setShowAddDialog(true);
  }

  async function handleSaveAvailability() {
    if (!user) return;

    // Validation
    if (!startDate) {
      toast({
        title: "Validation Error",
        description: "Start date is required.",
        variant: "destructive",
      });
      return;
    }

    if (!endDate) {
      toast({
        title: "Validation Error",
        description: "End date is required.",
        variant: "destructive",
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Validation Error",
        description: "End date can't be before start date.",
        variant: "destructive",
      });
      return;
    }

    if (autoReplyEnabled && !autoReplyMessage.trim()) {
      toast({
        title: "Validation Error",
        description: "Auto-reply message is required when auto-reply is enabled.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        rep_user_id: user.id,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
        auto_reply_enabled: autoReplyEnabled,
        auto_reply_message: autoReplyEnabled ? autoReplyMessage.trim() : null,
      };

      if (editingEntry) {
        // Update existing
        const { error } = await supabase
          .from("rep_availability")
          .update(dataToSave)
          .eq("id", editingEntry.id);

        if (error) throw error;

        toast({
          title: "Updated",
          description: "Time off entry updated successfully.",
        });
      } else {
        // Insert new
        const { error } = await supabase
          .from("rep_availability")
          .insert(dataToSave);

        if (error) throw error;

        toast({
          title: "Added",
          description: "Time off entry added successfully.",
        });
      }

      setShowAddDialog(false);
      await loadAvailabilityEntries();
    } catch (error: any) {
      console.error("Error saving availability:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save time off entry.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAvailability() {
    if (!deletingEntryId) return;

    try {
      const { error } = await supabase
        .from("rep_availability")
        .delete()
        .eq("id", deletingEntryId);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Time off entry deleted successfully.",
      });

      setShowDeleteDialog(false);
      setDeletingEntryId(null);
      await loadAvailabilityEntries();
    } catch (error: any) {
      console.error("Error deleting availability:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete entry.",
        variant: "destructive",
      });
    }
  }

  async function handleSendAlert() {
    if (!user) return;

    // Validation
    if (!alertMessage.trim()) {
      toast({
        title: "Validation Error",
        description: "Alert message is required.",
        variant: "destructive",
      });
      return;
    }

    if (alertType === "planned" && (!alertStartDate || !alertEndDate)) {
      toast({
        title: "Validation Error",
        description: "Please provide both start and end dates for planned time off.",
        variant: "destructive",
      });
      return;
    }

    setSendingAlert(true);
    try {
      // Get connected vendors from vendor_connections
      const { data: connections, error: connectionsError } = await supabase
        .from("vendor_connections")
        .select("vendor_id")
        .eq("field_rep_id", user.id)
        .eq("status", "connected");

      if (connectionsError) throw connectionsError;

      if (!connections || connections.length === 0) {
        toast({
          title: "No Connected Vendors",
          description: "You don't have any connected vendors to send alerts to.",
          variant: "default",
        });
        setSendingAlert(false);
        return;
      }

      const vendorIds = connections.map(c => c.vendor_id);

      // Get rep profile for anonymous ID
      const { data: repProfile } = await supabase
        .from("rep_profile")
        .select("anonymous_id")
        .eq("user_id", user.id)
        .single();

      const repAnonId = repProfile?.anonymous_id || "FieldRep#???";

      // Prepare alert message with basic placeholder replacement
      let finalMessage = alertMessage;
      if (alertStartDate) {
        finalMessage = finalMessage.replace(/\{\{START_DATE\}\}/g, format(parseISO(alertStartDate), "MM/dd/yyyy"));
      }
      if (alertEndDate) {
        finalMessage = finalMessage.replace(/\{\{END_DATE\}\}/g, format(parseISO(alertEndDate), "MM/dd/yyyy"));
      }

      // Insert vendor alert log
      const { error: alertError } = await supabase
        .from("vendor_alerts")
        .insert({
          rep_user_id: user.id,
          alert_type: alertType === "planned" ? "time_off_start" : alertType === "emergency" ? "emergency" : "availability",
          message: finalMessage,
          affected_start_date: alertStartDate || null,
          affected_end_date: alertEndDate || null,
          recipient_vendor_ids: vendorIds,
        });

      if (alertError) throw alertError;

      // Create notifications for each vendor
      for (const vendorId of vendorIds) {
        await supabase
          .from("notifications")
          .insert({
            user_id: vendorId,
            type: "vendor_alert",
            title: `${repAnonId} has shared an availability update`,
            body: finalMessage.substring(0, 200),
          });
      }

      toast({
        title: "Alert Sent",
        description: `Notification sent to ${vendorIds.length} connected vendor${vendorIds.length !== 1 ? 's' : ''}.`,
      });

      // Reset form
      setAlertType("planned");
      setAlertStartDate("");
      setAlertEndDate("");
      setAlertMessage("");
    } catch (error: any) {
      console.error("Error sending alert:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send alert.",
        variant: "destructive",
      });
    } finally {
      setSendingAlert(false);
    }
  }

  function getAlertTemplate() {
    switch (alertType) {
      case "planned":
        return `Hi, I'll be unavailable from {{START_DATE}} to {{END_DATE}} in my normal coverage areas. Please keep me in mind for future work once I'm back. Thank you!`;
      case "emergency":
        return `Hi, I'm temporarily unavailable due to an emergency. I'll update you as soon as I'm able to take on work again. Thank you for your understanding.`;
      case "update":
        return `Hi, I wanted to update you on my availability. [Provide details about your current status and when you'll be available for work.]`;
      default:
        return "";
    }
  }

  useEffect(() => {
    // Auto-fill alert message when type changes
    setAlertMessage(getAlertTemplate());
  }, [alertType]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Filter entries into future, active, and past
  const today = new Date().toISOString().split("T")[0];
  const futureEntries = availabilityEntries.filter(e => e.start_date > today);
  const activeEntries = availabilityEntries.filter(e => e.start_date <= today && e.end_date >= today);
  const pastEntries = availabilityEntries.filter(e => e.end_date < today);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-xl font-bold text-foreground">Availability & Vendor Alerts</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Section 1: Time Off / Availability */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Time Off / Availability
                </CardTitle>
                <CardDescription className="mt-2">
                  Manage your unavailable periods. When auto-reply is enabled, vendors will receive an automatic message when they send you a message during this time.
                </CardDescription>
              </div>
              <Button onClick={openAddDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Time Off
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {availabilityEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No time off scheduled yet.</p>
                <p className="text-sm mt-1">Add your first unavailable period to let vendors know when you're away.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active entries */}
                {activeEntries.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">Active Now</Badge>
                    </h3>
                    <div className="space-y-3">
                      {activeEntries.map(entry => (
                        <Card key={entry.id} className="bg-secondary/10 border-secondary/30">
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-medium text-foreground">
                                    {format(parseISO(entry.start_date), "MM/dd/yyyy")} – {format(parseISO(entry.end_date), "MM/dd/yyyy")}
                                  </span>
                                  <Badge variant={entry.auto_reply_enabled ? "default" : "outline"} className="text-xs">
                                    {entry.auto_reply_enabled ? "Auto-reply ON" : "Auto-reply OFF"}
                                  </Badge>
                                </div>
                                {entry.reason && (
                                  <p className="text-sm text-muted-foreground mb-2">{entry.reason}</p>
                                )}
                                {entry.auto_reply_enabled && entry.auto_reply_message && (
                                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border mt-2">
                                    <strong>Auto-reply:</strong> {entry.auto_reply_message}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(entry)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDeletingEntryId(entry.id);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Future entries */}
                {futureEntries.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Upcoming</h3>
                    <div className="space-y-3">
                      {futureEntries.map(entry => (
                        <Card key={entry.id}>
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-medium text-foreground">
                                    {format(parseISO(entry.start_date), "MM/dd/yyyy")} – {format(parseISO(entry.end_date), "MM/dd/yyyy")}
                                  </span>
                                  <Badge variant={entry.auto_reply_enabled ? "default" : "outline"} className="text-xs">
                                    {entry.auto_reply_enabled ? "Auto-reply ON" : "Auto-reply OFF"}
                                  </Badge>
                                </div>
                                {entry.reason && (
                                  <p className="text-sm text-muted-foreground">{entry.reason}</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(entry)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDeletingEntryId(entry.id);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Past entries */}
                {pastEntries.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Past</h3>
                    <div className="space-y-2">
                      {pastEntries.slice(0, 3).map(entry => (
                        <div key={entry.id} className="text-sm text-muted-foreground flex items-center justify-between py-2 px-3 bg-muted/30 rounded">
                          <span>
                            {format(parseISO(entry.start_date), "MM/dd/yyyy")} – {format(parseISO(entry.end_date), "MM/dd/yyyy")}
                            {entry.reason && ` • ${entry.reason}`}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingEntryId(entry.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Vendor Network Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Vendor Network Alerts
            </CardTitle>
            <CardDescription className="mt-2">
              Send a single message to your connected vendors (blind-copied) when you're taking time off or have an emergency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                This alert will be sent to all vendors you're currently connected with. Use it to keep them informed about your availability.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label className="mb-3 block">Alert Type</Label>
                <RadioGroup value={alertType} onValueChange={(val: any) => setAlertType(val)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="planned" id="planned" />
                    <Label htmlFor="planned" className="font-normal cursor-pointer">
                      Planned time off
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="emergency" id="emergency" />
                    <Label htmlFor="emergency" className="font-normal cursor-pointer">
                      Emergency / temporarily unavailable
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update" />
                    <Label htmlFor="update" className="font-normal cursor-pointer">
                      Availability update
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {alertType === "planned" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="alert-start-date">Start Date</Label>
                    <Input
                      id="alert-start-date"
                      type="date"
                      value={alertStartDate}
                      onChange={(e) => setAlertStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="alert-end-date">End Date</Label>
                    <Input
                      id="alert-end-date"
                      type="date"
                      value={alertEndDate}
                      onChange={(e) => setAlertEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="alert-message">Message</Label>
                <Textarea
                  id="alert-message"
                  placeholder="Enter your alert message..."
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  rows={6}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use {`{{START_DATE}}`} and {`{{END_DATE}}`} placeholders for automatic date substitution.
                </p>
              </div>

              <Button onClick={handleSendAlert} disabled={sendingAlert} className="w-full">
                <Send className="w-4 h-4 mr-2" />
                {sendingAlert ? "Sending..." : "Send to My Vendors"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Time Off Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Time Off" : "Add Time Off"}</DialogTitle>
            <DialogDescription>
              Schedule a period when you'll be unavailable. Optionally enable auto-reply to send automatic messages to vendors who contact you during this time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Vacation, surgery, limited availability..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground mt-1">Max 200 characters</p>
            </div>

            <div className="flex items-center justify-between space-x-2 py-2">
              <Label htmlFor="auto-reply-toggle" className="cursor-pointer">
                Enable auto-reply during this time
              </Label>
              <Switch
                id="auto-reply-toggle"
                checked={autoReplyEnabled}
                onCheckedChange={setAutoReplyEnabled}
              />
            </div>

            {autoReplyEnabled && (
              <div>
                <Label htmlFor="auto-reply-message">Auto-reply Message *</Label>
                <Textarea
                  id="auto-reply-message"
                  placeholder="I'm currently unavailable. I'll follow up when I'm back."
                  value={autoReplyMessage}
                  onChange={(e) => setAutoReplyMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This message will be sent once to each vendor who messages you during this period.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAvailability} disabled={saving}>
              {saving ? "Saving..." : editingEntry ? "Update" : "Add Time Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Off Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this time off entry. Any scheduled auto-reply will no longer be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAvailability}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
