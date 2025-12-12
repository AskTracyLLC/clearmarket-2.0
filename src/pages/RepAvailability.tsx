import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar, Send, Plus, Edit, Trash2, ArrowLeft, AlertTriangle, MapPin } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO, isToday } from "date-fns";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { RepVendorContactsCard } from "@/components/RepVendorContactsCard";
import { PlannedRouteConfirmBanner } from "@/components/PlannedRouteConfirmBanner";

interface AvailabilityEntry {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  auto_reply_enabled: boolean;
  auto_reply_message: string | null;
  created_at: string;
}

interface CoverageArea {
  state_code: string;
  state_name: string;
  county_name: string | null;
}

interface PlannedRoute {
  id: string;
  message: string;
  route_date: string;
  route_state: string;
  route_counties: string[];
}

type AlertType = "planned" | "emergency" | "update" | "route";

export default function RepAvailability() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [availabilityEntries, setAvailabilityEntries] = useState<AvailabilityEntry[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AvailabilityEntry | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  
  // Form state for time off
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyMessage, setAutoReplyMessage] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Alert form state
  const [alertType, setAlertType] = useState<AlertType>("planned");
  const [alertStartDate, setAlertStartDate] = useState("");
  const [alertEndDate, setAlertEndDate] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [sendingAlert, setSendingAlert] = useState(false);
  
  // Planned route state
  const [routeDate, setRouteDate] = useState<Date | undefined>(undefined);
  const [routeState, setRouteState] = useState("");
  const [routeCounties, setRouteCounties] = useState<string[]>([]);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [pendingRoutes, setPendingRoutes] = useState<PlannedRoute[]>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

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

      // Load all data in parallel
      await Promise.all([
        loadAvailabilityEntries(),
        loadCoverageAreas(),
        loadPendingRoutes(),
      ]);
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

  async function loadCoverageAreas() {
    if (!user) return;

    const { data, error } = await supabase
      .from("rep_coverage_areas")
      .select("state_code, state_name, county_name")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error loading coverage:", error);
      return;
    }

    setCoverageAreas(data || []);
  }

  async function loadPendingRoutes() {
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("vendor_alerts")
      .select("id, message, route_date, route_state, route_counties")
      .eq("rep_user_id", user.id)
      .eq("is_scheduled", true)
      .eq("scheduled_status", "pending_confirmation")
      .eq("route_date", today);

    if (error) {
      console.error("Error loading pending routes:", error);
      return;
    }

    setPendingRoutes((data || []).map(d => ({
      id: d.id,
      message: d.message,
      route_date: d.route_date,
      route_state: d.route_state || "",
      route_counties: d.route_counties || [],
    })));
  }

  // Get unique states from coverage
  const coverageStates = useMemo(() => {
    const states = new Map<string, string>();
    coverageAreas.forEach(area => {
      states.set(area.state_code, area.state_name);
    });
    return Array.from(states.entries()).map(([code, name]) => ({ code, name }));
  }, [coverageAreas]);

  // Get counties for selected state
  const stateCounties = useMemo(() => {
    if (!routeState) return [];
    return coverageAreas
      .filter(area => area.state_code === routeState && area.county_name)
      .map(area => area.county_name!)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
  }, [coverageAreas, routeState]);

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

    if (!startDate) {
      toast({ title: "Validation Error", description: "Start date is required.", variant: "destructive" });
      return;
    }

    if (!endDate) {
      toast({ title: "Validation Error", description: "End date is required.", variant: "destructive" });
      return;
    }

    if (endDate < startDate) {
      toast({ title: "Validation Error", description: "End date can't be before start date.", variant: "destructive" });
      return;
    }

    if (autoReplyEnabled && !autoReplyMessage.trim()) {
      toast({ title: "Validation Error", description: "Auto-reply message is required when enabled.", variant: "destructive" });
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
        const { error } = await supabase
          .from("rep_availability")
          .update(dataToSave)
          .eq("id", editingEntry.id);

        if (error) throw error;
        toast({ title: "Updated", description: "Time off entry updated." });
      } else {
        const { error } = await supabase
          .from("rep_availability")
          .insert(dataToSave);

        if (error) throw error;
        toast({ title: "Added", description: "Time off entry added." });
      }

      setShowAddDialog(false);
      await loadAvailabilityEntries();
    } catch (error: any) {
      console.error("Error saving availability:", error);
      toast({ title: "Error", description: error.message || "Failed to save.", variant: "destructive" });
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

      toast({ title: "Deleted", description: "Time off entry deleted." });
      setShowDeleteDialog(false);
      setDeletingEntryId(null);
      await loadAvailabilityEntries();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast({ title: "Error", description: error.message || "Failed to delete.", variant: "destructive" });
    }
  }

  async function handleSendAlert() {
    if (!user) return;

    // Validation
    if (!alertMessage.trim()) {
      toast({ title: "Validation Error", description: "Alert message is required.", variant: "destructive" });
      return;
    }

    if (alertType === "planned" && (!alertStartDate || !alertEndDate)) {
      toast({ title: "Validation Error", description: "Please provide both start and end dates.", variant: "destructive" });
      return;
    }

    if (alertType === "route") {
      if (!routeDate) {
        toast({ title: "Validation Error", description: "Please select the route date.", variant: "destructive" });
        return;
      }
      if (!routeState) {
        toast({ title: "Validation Error", description: "Please select the state.", variant: "destructive" });
        return;
      }
      if (routeCounties.length === 0) {
        toast({ title: "Validation Error", description: "Please select at least one county.", variant: "destructive" });
        return;
      }
    }

    setSendingAlert(true);
    try {
      // Get connected vendors count
      const { data: connections, error: connectionsError } = await supabase
        .from("vendor_connections")
        .select("vendor_id")
        .eq("field_rep_id", user.id)
        .eq("status", "connected");

      if (connectionsError) throw connectionsError;

      const { count: manualContactCount } = await supabase
        .from("rep_vendor_contacts")
        .select("id", { count: "exact", head: true })
        .eq("rep_user_id", user.id)
        .eq("is_active", true);

      const vendorIds = connections?.map(c => c.vendor_id) || [];
      const totalRecipients = vendorIds.length + (manualContactCount || 0);

      if (totalRecipients === 0) {
        toast({
          title: "No Recipients",
          description: "You don't have any connected vendors or manual contacts.",
          variant: "default",
        });
        setSendingAlert(false);
        return;
      }

      // Handle Planned Route differently - schedule instead of send
      if (alertType === "route") {
        const routeDateStr = format(routeDate!, "yyyy-MM-dd");
        const stateName = coverageStates.find(s => s.code === routeState)?.name || routeState;

        const alertData = {
          rep_user_id: user.id,
          alert_type: "planned_route",
          message: alertMessage,
          affected_start_date: routeDateStr,
          affected_end_date: routeDateStr,
          recipient_vendor_ids: vendorIds,
          route_date: routeDateStr,
          route_state: stateName,
          route_counties: routeCounties,
          is_scheduled: true,
          scheduled_status: editingRouteId ? "pending_confirmation" : "pending_confirmation",
        };

        if (editingRouteId) {
          // Update existing
          const { error } = await supabase
            .from("vendor_alerts")
            .update(alertData)
            .eq("id", editingRouteId);

          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from("vendor_alerts")
            .insert(alertData);

          if (error) throw error;
        }

        toast({
          title: "Route Scheduled",
          description: `Your planned route for ${format(routeDate!, "MMMM d, yyyy")} is saved. You'll be prompted to confirm and send it on that day.`,
        });

        // Reset form
        resetAlertForm();
        await loadPendingRoutes();
        return;
      }

      // Prepare message with placeholder replacement for other types
      let finalMessage = alertMessage;
      if (alertStartDate) {
        finalMessage = finalMessage.replace(/\{\{START_DATE\}\}/g, format(parseISO(alertStartDate), "MM/dd/yyyy"));
      }
      if (alertEndDate) {
        finalMessage = finalMessage.replace(/\{\{END_DATE\}\}/g, format(parseISO(alertEndDate), "MM/dd/yyyy"));
      }

      // Insert vendor alert
      const { data: alertRecord, error: alertError } = await supabase
        .from("vendor_alerts")
        .insert({
          rep_user_id: user.id,
          alert_type: alertType === "planned" ? "time_off_start" : alertType === "emergency" ? "emergency" : "availability",
          message: finalMessage,
          affected_start_date: alertStartDate || null,
          affected_end_date: alertEndDate || null,
          recipient_vendor_ids: vendorIds,
          is_scheduled: false,
        })
        .select()
        .single();

      if (alertError) throw alertError;

      // Call edge function to send notifications
      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        "send-rep-network-alert",
        {
          body: {
            alertId: alertRecord.id,
            repUserId: user.id,
          },
        }
      );

      if (sendError) throw sendError;

      const inAppCount = sendResult?.inAppNotifications || 0;
      const emailCount = sendResult?.emailsSent || 0;
      let description = `Alert sent to ${inAppCount} vendor${inAppCount !== 1 ? 's' : ''}`;
      if (emailCount > 0) {
        description += ` and ${emailCount} manual contact${emailCount !== 1 ? 's' : ''}`;
      }

      toast({ title: "Alert Sent", description });
      resetAlertForm();
    } catch (error: any) {
      console.error("Error sending alert:", error);
      toast({ title: "Error", description: error.message || "Failed to send.", variant: "destructive" });
    } finally {
      setSendingAlert(false);
    }
  }

  function resetAlertForm() {
    setAlertType("planned");
    setAlertStartDate("");
    setAlertEndDate("");
    setAlertMessage(getAlertTemplate("planned"));
    setRouteDate(undefined);
    setRouteState("");
    setRouteCounties([]);
    setEditingRouteId(null);
  }

  function getAlertTemplate(type: AlertType) {
    switch (type) {
      case "planned":
        return `Hi, I'll be unavailable from {{START_DATE}} to {{END_DATE}} in my normal coverage areas. Please keep me in mind for future work once I'm back. Thank you!`;
      case "emergency":
        return `Hi, I'm temporarily unavailable due to an emergency. I'll update you as soon as I'm able to take on work again. Thank you for your understanding.`;
      case "update":
        return `Hi, I wanted to update you on my availability. [Provide details about your current status and when you'll be available for work.]`;
      case "route":
        return `I'm planning to be in {COUNTIES}, {STATE} on {DATE}.\nIf you have any work or orders in this area, please let me know.`;
      default:
        return "";
    }
  }

  useEffect(() => {
    setAlertMessage(getAlertTemplate(alertType));
  }, [alertType]);

  function handleEditRoute(route: PlannedRoute) {
    setAlertType("route");
    setEditingRouteId(route.id);
    setRouteDate(parseISO(route.route_date));
    
    // Find state code from name
    const stateCode = coverageStates.find(s => s.name === route.route_state)?.code || "";
    setRouteState(stateCode);
    setRouteCounties(route.route_counties);
    setAlertMessage(route.message);
  }

  function toggleCounty(county: string) {
    setRouteCounties(prev => 
      prev.includes(county) 
        ? prev.filter(c => c !== county)
        : [...prev, county]
    );
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const futureEntries = availabilityEntries.filter(e => e.start_date > today);
  const activeEntries = availabilityEntries.filter(e => e.start_date <= today && e.end_date >= today);
  const pastEntries = availabilityEntries.filter(e => e.end_date < today);

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-xl font-bold text-foreground">Availability & Vendor Alerts</h1>
        </div>

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
                  Manage your unavailable periods. Vendors receive an auto-reply when they message you during this time.
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
              </div>
            ) : (
              <div className="space-y-6">
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
                                {entry.reason && <p className="text-sm text-muted-foreground">{entry.reason}</p>}
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(entry)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setDeletingEntryId(entry.id); setShowDeleteDialog(true); }}>
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
                                {entry.reason && <p className="text-sm text-muted-foreground">{entry.reason}</p>}
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(entry)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setDeletingEntryId(entry.id); setShowDeleteDialog(true); }}>
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
                          <Button variant="ghost" size="sm" onClick={() => { setDeletingEntryId(entry.id); setShowDeleteDialog(true); }}>
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
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Vendor Network Alerts
            </CardTitle>
            <CardDescription className="mt-2">
              Send a message to your connected vendors when you're taking time off, have an emergency, or will be working in a specific area.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pending route confirmation banners */}
            <PlannedRouteConfirmBanner
              routes={pendingRoutes}
              onConfirmed={() => loadPendingRoutes()}
              onEdit={handleEditRoute}
              repUserId={user?.id || ""}
            />

            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                This alert will go to vendors in your ClearMarket network plus any vendor contacts you've added below.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label className="mb-3 block">Alert Type</Label>
                <RadioGroup value={alertType} onValueChange={(val: AlertType) => setAlertType(val)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="planned" id="planned" />
                    <Label htmlFor="planned" className="font-normal cursor-pointer">Planned time off</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="emergency" id="emergency" />
                    <Label htmlFor="emergency" className="font-normal cursor-pointer">Emergency / temporarily unavailable</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update" />
                    <Label htmlFor="update" className="font-normal cursor-pointer">Availability update</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="route" id="route" />
                    <Label htmlFor="route" className="font-normal cursor-pointer flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Planned route / Working in this area
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

              {alertType === "route" && (
                <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
                  <div>
                    <Label className="mb-2 block">Which day will you be in this area?</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !routeDate && "text-muted-foreground")}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {routeDate ? format(routeDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={routeDate}
                          onSelect={setRouteDate}
                          initialFocus
                          className="p-3 pointer-events-auto"
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 block">State</Label>
                      <Select value={routeState} onValueChange={(val) => { setRouteState(val); setRouteCounties([]); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {coverageStates.map(s => (
                            <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-2 block">Counties</Label>
                      {stateCounties.length > 0 ? (
                        <div className="border border-border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                          {stateCounties.map(county => (
                            <label key={county} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={routeCounties.includes(county)}
                                onChange={() => toggleCounty(county)}
                                className="rounded"
                              />
                              <span className="text-sm">{county}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Select a state first</p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Choose the state and counties you plan to work in on this day. We'll let your vendors know you'll be in these areas.
                  </p>
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
                  {alertType === "route" 
                    ? "Use {DATE}, {STATE}, and {COUNTIES} placeholders for automatic substitution."
                    : "Use {{START_DATE}} and {{END_DATE}} placeholders for automatic date substitution."
                  }
                </p>
              </div>

              <Button onClick={handleSendAlert} disabled={sendingAlert} className="w-full">
                {alertType === "route" ? (
                  <>
                    <MapPin className="w-4 h-4 mr-2" />
                    {sendingAlert ? "Scheduling..." : editingRouteId ? "Update Planned Route" : "Schedule Planned Route"}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {sendingAlert ? "Sending..." : "Send to My Vendors"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Manual Vendor Contacts */}
        {user && <RepVendorContactsCard repUserId={user.id} />}
      </div>

      {/* Add/Edit Time Off Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Time Off" : "Add Time Off"}</DialogTitle>
            <DialogDescription>
              Schedule a period when you'll be unavailable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date *</Label>
                <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="end-date">End Date *</Label>
                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Vacation, surgery..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between space-x-2 py-2">
              <Label htmlFor="auto-reply-toggle" className="cursor-pointer">Enable auto-reply</Label>
              <Switch id="auto-reply-toggle" checked={autoReplyEnabled} onCheckedChange={setAutoReplyEnabled} />
            </div>

            {autoReplyEnabled && (
              <div>
                <Label htmlFor="auto-reply-message">Auto-reply Message *</Label>
                <Textarea
                  id="auto-reply-message"
                  placeholder="I'm currently unavailable..."
                  value={autoReplyMessage}
                  onChange={(e) => setAutoReplyMessage(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAvailability} disabled={saving}>
              {saving ? "Saving..." : editingEntry ? "Update" : "Add Time Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Off Entry?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this entry.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAvailability}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthenticatedLayout>
  );
}
