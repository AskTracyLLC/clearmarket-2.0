import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ExternalLink, MessageSquare, Clock, CheckCircle, Hourglass } from "lucide-react";
import { US_STATES } from "@/lib/constants";

interface PendingOpportunity {
  id: string;
  post_id: string;
  status: string;
  created_at: string;
  post: {
    id: string;
    title: string;
    state_code: string | null;
    county_name: string | null;
    inspection_types: string[];
    systems_required_array: string[];
    vendor_id: string;
  };
  vendor: {
    anonymous_id: string | null;
    company_name: string | null;
  };
  conversation_id: string | null;
  has_pending_assignment: boolean;
}

type SortField = "created_at" | "state" | "status" | "vendor";
type SortDirection = "asc" | "desc";

export default function RepPendingOpportunities() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<PendingOpportunity[]>([]);
  const [repProfileId, setRepProfileId] = useState<string | null>(null);

  // Filters
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [countySearch, setCountySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (user) {
      loadData();
    }
  }, [authLoading, user]);

  const loadData = async () => {
    if (!user) return;

    try {
      // Get rep profile
      const { data: repProfile } = await supabase
        .from("rep_profile")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!repProfile) {
        toast.error("Rep profile not found");
        navigate("/dashboard");
        return;
      }

      setRepProfileId(repProfile.id);

      // Get all interest records where status = 'interested' (pending vendor action)
      const { data: interests, error } = await supabase
        .from("rep_interest")
        .select(`
          id,
          post_id,
          status,
          created_at,
          seeking_coverage_posts!inner (
            id,
            title,
            state_code,
            vendor_id,
            inspection_types,
            systems_required_array,
            has_pending_assignment,
            us_counties!county_id (county_name)
          )
        `)
        .eq("rep_id", repProfile.id)
        .eq("status", "interested")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get vendor profiles for these posts
      const vendorIds = [...new Set((interests || []).map((i: any) => i.seeking_coverage_posts?.vendor_id).filter(Boolean))];
      
      let vendorMap: Record<string, { anonymous_id: string | null; company_name: string | null }> = {};
      if (vendorIds.length > 0) {
        const { data: vendors } = await supabase
          .from("vendor_profile")
          .select("user_id, anonymous_id, company_name")
          .in("user_id", vendorIds);
        
        vendorMap = Object.fromEntries(
          (vendors || []).map((v: any) => [v.user_id, { anonymous_id: v.anonymous_id, company_name: v.company_name }])
        );
      }

      // Get conversations for these posts to detect "in conversation" status
      const postIds = (interests || []).map((i: any) => i.post_id);
      let conversationMap: Record<string, string> = {};
      
      if (postIds.length > 0) {
        const { data: conversations } = await supabase
          .from("conversations")
          .select("id, origin_post_id")
          .in("origin_post_id", postIds)
          .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);
        
        for (const conv of conversations || []) {
          if (conv.origin_post_id) {
            conversationMap[conv.origin_post_id] = conv.id;
          }
        }
      }

      // Transform data
      const transformed: PendingOpportunity[] = (interests || []).map((i: any) => {
        const post = i.seeking_coverage_posts;
        return {
          id: i.id,
          post_id: i.post_id,
          status: i.status,
          created_at: i.created_at,
          post: {
            id: post.id,
            title: post.title,
            state_code: post.state_code,
            county_name: post.us_counties?.county_name || null,
            inspection_types: post.inspection_types || [],
            systems_required_array: post.systems_required_array || [],
            vendor_id: post.vendor_id,
          },
          vendor: vendorMap[post.vendor_id] || { anonymous_id: null, company_name: null },
          conversation_id: conversationMap[post.id] || null,
          has_pending_assignment: post.has_pending_assignment || false,
        };
      });

      setOpportunities(transformed);
    } catch (error) {
      console.error("Error loading pending opportunities:", error);
      toast.error("Failed to load pending opportunities");
    } finally {
      setLoading(false);
    }
  };

  // Get unique states for filter
  const availableStates = [...new Set(opportunities.map(o => o.post.state_code).filter(Boolean))];

  // Apply filters and sorting
  const filteredOpportunities = opportunities
    .filter((opp) => {
      if (stateFilter !== "all" && opp.post.state_code !== stateFilter) return false;
      if (countySearch && !opp.post.county_name?.toLowerCase().includes(countySearch.toLowerCase())) return false;
      if (statusFilter !== "all") {
        const derivedStatus = getDisplayStatus(opp);
        if (statusFilter === "waiting" && derivedStatus !== "waiting") return false;
        if (statusFilter === "in_conversation" && derivedStatus !== "in_conversation") return false;
        if (statusFilter === "assignment_pending" && derivedStatus !== "assignment_pending") return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "state":
          comparison = (a.post.state_code || "").localeCompare(b.post.state_code || "");
          break;
        case "status":
          comparison = getDisplayStatus(a).localeCompare(getDisplayStatus(b));
          break;
        case "vendor":
          comparison = (a.vendor.anonymous_id || a.vendor.company_name || "").localeCompare(
            b.vendor.anonymous_id || b.vendor.company_name || ""
          );
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  function getDisplayStatus(opp: PendingOpportunity): "waiting" | "in_conversation" | "assignment_pending" {
    if (opp.has_pending_assignment) return "assignment_pending";
    if (opp.conversation_id) return "in_conversation";
    return "waiting";
  }

  function getStatusBadge(opp: PendingOpportunity) {
    const status = getDisplayStatus(opp);
    switch (status) {
      case "assignment_pending":
        return (
          <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Assignment pending
          </Badge>
        );
      case "in_conversation":
        return (
          <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
            <MessageSquare className="h-3 w-3 mr-1" />
            In conversation
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-muted-foreground">
            <Hourglass className="h-3 w-3 mr-1" />
            Waiting on vendor
          </Badge>
        );
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  if (authLoading || loading) {
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
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Pending Opportunities</h1>
              <p className="text-muted-foreground mt-1">
                Opportunities you've shown interest in that are waiting for vendor action.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">State</Label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    {availableStates.map((code) => (
                      <SelectItem key={code} value={code!}>
                        {US_STATES.find(s => s.value === code)?.label || code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">County</Label>
                <Input
                  placeholder="Search county..."
                  value={countySearch}
                  onChange={(e) => setCountySearch(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="waiting">Waiting on vendor</SelectItem>
                    <SelectItem value="in_conversation">In conversation</SelectItem>
                    <SelectItem value="assignment_pending">Assignment pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Sort by</Label>
                <Select
                  value={`${sortField}-${sortDirection}`}
                  onValueChange={(val) => {
                    const [field, dir] = val.split("-") as [SortField, SortDirection];
                    setSortField(field);
                    setSortDirection(dir);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at-desc">Newest first</SelectItem>
                    <SelectItem value="created_at-asc">Oldest first</SelectItem>
                    <SelectItem value="state-asc">State (A-Z)</SelectItem>
                    <SelectItem value="vendor-asc">Vendor (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {filteredOpportunities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">
                No pending opportunities
              </p>
              <p className="text-muted-foreground mb-4">
                {opportunities.length > 0
                  ? "No opportunities match your current filters."
                  : "You haven't expressed interest in any opportunities yet."}
              </p>
              <Button onClick={() => navigate("/rep/find-work")}>
                Find Work
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("created_at")}
                    >
                      Opportunity
                      {sortField === "created_at" && (
                        <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("vendor")}
                    >
                      Vendor
                      {sortField === "vendor" && (
                        <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("state")}
                    >
                      Location
                      {sortField === "state" && (
                        <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </TableHead>
                    <TableHead>Inspection Types</TableHead>
                    <TableHead>Systems</TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("status")}
                    >
                      Status
                      {sortField === "status" && (
                        <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </TableHead>
                    <TableHead>Interest Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOpportunities.map((opp) => (
                    <TableRow key={opp.id}>
                      <TableCell>
                        <Link
                          to={`/rep/seeking-coverage/${opp.post.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {opp.post.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {opp.vendor.anonymous_id || opp.vendor.company_name || "Unknown"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {opp.post.county_name ? `${opp.post.county_name}, ` : ""}
                        {opp.post.state_code || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {opp.post.inspection_types.slice(0, 2).map((type, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs truncate max-w-[120px]">
                              {type}
                            </Badge>
                          ))}
                          {opp.post.inspection_types.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{opp.post.inspection_types.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {opp.post.systems_required_array.slice(0, 2).map((sys, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs truncate max-w-[100px]">
                              {sys}
                            </Badge>
                          ))}
                          {opp.post.systems_required_array.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{opp.post.systems_required_array.length - 2}
                            </Badge>
                          )}
                          {opp.post.systems_required_array.length === 0 && (
                            <span className="text-xs text-muted-foreground">Any</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(opp)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(parseISO(opp.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {opp.conversation_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/messages/${opp.conversation_id}`)}
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Open
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/rep/seeking-coverage/${opp.post.id}`)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </AuthenticatedLayout>
  );
}