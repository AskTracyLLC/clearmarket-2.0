import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ClipboardList, CalendarIcon, ArrowLeft, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { adminChecklistLogCopy } from "@/copy/adminChecklistLogCopy";

interface AssignmentEvent {
  id: string;
  created_at: string;
  template_id: string;
  user_id: string;
  vendor_id: string | null;
  assigned_by: string | null;
  source: string;
  notes: string | null;
  // Joined data
  template_name: string | null;
  user_name: string | null;
  user_email: string | null;
  user_is_fieldrep: boolean;
  user_is_vendor: boolean;
  vendor_name: string | null;
  vendor_company: string | null;
}

interface FilterVendor {
  id: string;
  name: string;
}

interface FilterTemplate {
  id: string;
  name: string;
}

type SortColumn = "timestamp" | "template" | "user" | "vendor" | "source";
type SortDirection = "asc" | "desc";

export default function AdminChecklistLog() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permsLoading } = useStaffPermissions();

  const [events, setEvents] = useState<AssignmentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Filter options
  const [vendors, setVendors] = useState<FilterVendor[]>([]);
  const [templates, setTemplates] = useState<FilterTemplate[]>([]);

  useEffect(() => {
    loadEvents();
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    // Load unique vendors from events
    const { data: vendorData } = await supabase
      .from("checklist_assignment_events")
      .select("vendor_id")
      .not("vendor_id", "is", null);

    const uniqueVendorIds = [...new Set((vendorData || []).map(v => v.vendor_id).filter(Boolean))];

    if (uniqueVendorIds.length > 0) {
      const { data: vendorProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uniqueVendorIds);

      const { data: vendorCompanies } = await supabase
        .from("vendor_profile")
        .select("user_id, company_name")
        .in("user_id", uniqueVendorIds);

      const companyMap = new Map((vendorCompanies || []).map(v => [v.user_id, v.company_name]));

      setVendors(
        (vendorProfiles || []).map(v => ({
          id: v.id,
          name: companyMap.get(v.id) || v.full_name || "Unknown Vendor",
        }))
      );
    }

    // Load unique templates from events
    const { data: templateData } = await supabase
      .from("checklist_assignment_events")
      .select("template_id");

    const uniqueTemplateIds = [...new Set((templateData || []).map(t => t.template_id))];

    if (uniqueTemplateIds.length > 0) {
      const { data: templateNames } = await supabase
        .from("checklist_templates")
        .select("id, name")
        .in("id", uniqueTemplateIds);

      setTemplates(
        (templateNames || []).map(t => ({
          id: t.id,
          name: t.name,
        }))
      );
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("checklist_assignment_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (dateFrom) {
        query = query.gte("created_at", dateFrom.toISOString());
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch related data
      const userIds = [...new Set((data || []).map(e => e.user_id))];
      const vendorIds = [...new Set((data || []).filter(e => e.vendor_id).map(e => e.vendor_id!))];
      const templateIds = [...new Set((data || []).map(e => e.template_id))];

      // User profiles
      const { data: userProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_fieldrep, is_vendor_admin")
        .in("id", userIds);
      const userMap = new Map((userProfiles || []).map(u => [u.id, u]));

      // Vendor profiles (company names)
      const { data: vendorProfiles } = vendorIds.length > 0
        ? await supabase
            .from("vendor_profile")
            .select("user_id, company_name")
            .in("user_id", vendorIds)
        : { data: [] };
      const vendorCompanyMap = new Map((vendorProfiles || []).map(v => [v.user_id, v.company_name]));

      // Vendor user names
      const { data: vendorUserProfiles } = vendorIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", vendorIds)
        : { data: [] };
      const vendorNameMap = new Map((vendorUserProfiles || []).map(v => [v.id, v.full_name]));

      // Templates
      const { data: templateData } = await supabase
        .from("checklist_templates")
        .select("id, name")
        .in("id", templateIds);
      const templateMap = new Map((templateData || []).map(t => [t.id, t.name]));

      // Build events with joined data
      const enrichedEvents: AssignmentEvent[] = (data || []).map(e => {
        const userProfile = userMap.get(e.user_id);
        return {
          ...e,
          template_name: templateMap.get(e.template_id) || null,
          user_name: userProfile?.full_name || null,
          user_email: userProfile?.email || null,
          user_is_fieldrep: userProfile?.is_fieldrep || false,
          user_is_vendor: userProfile?.is_vendor_admin || false,
          vendor_name: e.vendor_id ? vendorNameMap.get(e.vendor_id) || null : null,
          vendor_company: e.vendor_id ? vendorCompanyMap.get(e.vendor_id) || null : null,
        };
      });

      setEvents(enrichedEvents);
    } catch (error) {
      console.error("Error loading events:", error);
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

  const sortedAndFilteredEvents = useMemo(() => {
    // First filter
    const filtered = events.filter(e => {
      // Vendor filter
      if (selectedVendorId && e.vendor_id !== selectedVendorId) return false;
      // Template filter
      if (selectedTemplateId && e.template_id !== selectedTemplateId) return false;
      // Source filter
      if (selectedSource && e.source !== selectedSource) return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = e.user_name?.toLowerCase().includes(q);
        const matchesEmail = e.user_email?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      return true;
    });

    // Then sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "timestamp":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "template":
          comparison = (a.template_name || "").localeCompare(b.template_name || "");
          break;
        case "user":
          comparison = (a.user_name || a.user_email || "").localeCompare(b.user_name || b.user_email || "");
          break;
        case "vendor":
          comparison = (a.vendor_company || a.vendor_name || "System/Admin").localeCompare(b.vendor_company || b.vendor_name || "System/Admin");
          break;
        case "source":
          comparison = a.source.localeCompare(b.source);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [events, selectedVendorId, selectedTemplateId, selectedSource, searchQuery, sortColumn, sortDirection]);

  const clearFilters = () => {
    setDateFrom(startOfMonth(new Date()));
    setDateTo(endOfMonth(new Date()));
    setSelectedVendorId("");
    setSelectedTemplateId("");
    setSelectedSource("");
    setSearchQuery("");
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "auto_on_connect":
        return <Badge variant="secondary">{adminChecklistLogCopy.table.sourceBadges.autoOnConnect}</Badge>;
      case "manual_vendor":
        return <Badge variant="outline">{adminChecklistLogCopy.table.sourceBadges.manualVendor}</Badge>;
      case "manual_admin":
        return <Badge>{adminChecklistLogCopy.table.sourceBadges.manualAdmin}</Badge>;
      default:
        return <Badge variant="outline">{adminChecklistLogCopy.table.sourceBadges.unknown}</Badge>;
    }
  };

  const getUserRoleBadge = (event: AssignmentEvent) => {
    if (event.user_is_fieldrep && event.user_is_vendor) return "(Both)";
    if (event.user_is_fieldrep) return "(Field Rep)";
    if (event.user_is_vendor) return "(Vendor)";
    return "";
  };

  if (authLoading || permsLoading) {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!permissions?.canViewAdminDashboard) {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Access denied.</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button variant="ghost" onClick={() => navigate("/admin/checklists")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Checklists
        </Button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{adminChecklistLogCopy.pageTitle}</h1>
          </div>
          <p className="text-muted-foreground">{adminChecklistLogCopy.pageSubtitle}</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Date From */}
              <div>
                <Label className="text-xs">{adminChecklistLogCopy.filters.dateRangeLabel} (From)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div>
                <Label className="text-xs">{adminChecklistLogCopy.filters.dateRangeLabel} (To)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "MMM d, yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Vendor */}
              <div>
                <Label className="text-xs">{adminChecklistLogCopy.filters.vendorLabel}</Label>
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All vendors</SelectItem>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template */}
              <div>
                <Label className="text-xs">{adminChecklistLogCopy.filters.templateLabel}</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All checklists" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All checklists</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Source */}
              <div>
                <Label className="text-xs">{adminChecklistLogCopy.filters.sourceLabel}</Label>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={adminChecklistLogCopy.filters.sourceOptions.all} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{adminChecklistLogCopy.filters.sourceOptions.all}</SelectItem>
                    <SelectItem value="auto_on_connect">{adminChecklistLogCopy.filters.sourceOptions.autoOnConnect}</SelectItem>
                    <SelectItem value="manual_vendor">{adminChecklistLogCopy.filters.sourceOptions.manualVendor}</SelectItem>
                    <SelectItem value="manual_admin">{adminChecklistLogCopy.filters.sourceOptions.manualAdmin}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div>
                <Label className="text-xs">Search</Label>
                <Input
                  placeholder={adminChecklistLogCopy.filters.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                {adminChecklistLogCopy.filters.clearButton}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading...</div>
            ) : sortedAndFilteredEvents.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {adminChecklistLogCopy.table.empty}
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("timestamp")}
                      >
                        <div className="flex items-center">
                          {adminChecklistLogCopy.table.columns.timestamp}
                          <SortIcon column="timestamp" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("template")}
                      >
                        <div className="flex items-center">
                          {adminChecklistLogCopy.table.columns.template}
                          <SortIcon column="template" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("user")}
                      >
                        <div className="flex items-center">
                          {adminChecklistLogCopy.table.columns.user}
                          <SortIcon column="user" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("vendor")}
                      >
                        <div className="flex items-center">
                          {adminChecklistLogCopy.table.columns.vendor}
                          <SortIcon column="vendor" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("source")}
                      >
                        <div className="flex items-center">
                          {adminChecklistLogCopy.table.columns.source}
                          <SortIcon column="source" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAndFilteredEvents.map(event => (
                      <TableRow key={event.id}>
                        <TableCell className="text-sm">
                          {format(new Date(event.created_at), "MMM d, yyyy, h:mm a")}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {event.template_name || "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-sm">
                              {event.user_name || event.user_email || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              {getUserRoleBadge(event)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {event.vendor_company || event.vendor_name || "System/Admin"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getSourceBadge(event.source)}
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
    </AuthenticatedLayout>
  );
}