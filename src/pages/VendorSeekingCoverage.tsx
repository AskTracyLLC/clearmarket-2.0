import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, PlusCircle, Edit2, XCircle, RotateCcw, Trash2, Eye, AlertCircle, Users, 
  ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, ChevronDown
} from "lucide-react";
import { VendorPostPricingAlert } from "@/components/VendorPostPricingAlert";
import { SeekingCoverageDialog } from "@/components/SeekingCoverageDialog";
import { format, differenceInDays } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { PageHeader } from "@/components/PageHeader";
import AdminViewBanner from "@/components/AdminViewBanner";
import { formatVendorOfferedRate } from "@/lib/vendorRateDisplay";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SeekingCoveragePost {
  id: string;
  title: string;
  description: string | null;
  state_code: string | null;
  county_id: string | null;
  covers_entire_state: boolean;
  inspection_types: string[];
  systems_required_array: string[];
  is_accepting_responses: boolean;
  status: string;
  auto_expires_at: string | null;
  created_at: string;
  deleted_at: string | null;
  pay_type: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_notes: string | null;
  filled_by_rep_id: string | null;
  filled_at: string | null;
  closed_reason: string | null;
  us_counties?: {
    county_name: string;
    state_name: string;
  } | null;
  filled_by_rep?: {
    anonymous_id: string | null;
  } | null;
}

type SortMode = "newest" | "oldest" | "interest";
type SortColumn = "title" | "location" | "rate" | "interested" | "status" | "expires" | null;
type SortDirection = "asc" | "desc";
type InterestFilter = "all" | "with_interest" | "no_responses";

const VendorSeekingCoverage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightPostId = searchParams.get("highlightPostId");
  const vendorIdParam = searchParams.get("vendorId");
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [allPosts, setAllPosts] = useState<SeekingCoveragePost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<SeekingCoveragePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SeekingCoveragePost | null>(null);
  const [viewingPost, setViewingPost] = useState<SeekingCoveragePost | null>(null);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "closed" | "expired">("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [countySearch, setCountySearch] = useState("");
  const [titleSearch, setTitleSearch] = useState("");
  const [interestFilter, setInterestFilter] = useState<InterestFilter>("all");
  
  // Sorting
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // Interested reps count per post
  const [interestedCounts, setInterestedCounts] = useState<Record<string, number>>({});
  
  // For admin viewing another vendor's posts
  const [targetVendorId, setTargetVendorId] = useState<string | null>(null);
  const [targetVendorName, setTargetVendorName] = useState<string | null>(null);
  const isAdminViewingOther = profile?.is_admin && vendorIdParam && vendorIdParam !== user?.id;
  
  // Ref for scrolling to highlighted post
  const highlightedPostRef = useRef<HTMLTableRowElement>(null);
  
  // Scroll to highlighted post when it becomes available
  useEffect(() => {
    if (highlightPostId && highlightedPostRef.current && !loading) {
      highlightedPostRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightPostId, filteredPosts, loading]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    if (!user) return;

    // Load profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error loading profile:", profileError);
      return;
    }

    setProfile(profileData);

    // Redirect if not vendor and not admin
    if (!profileData.is_vendor_admin && !profileData.is_admin) {
      navigate("/dashboard");
      return;
    }

    // Determine which vendor's posts to load
    const isAdmin = profileData.is_admin === true;
    const effectiveVendorId = isAdmin && vendorIdParam ? vendorIdParam : user.id;
    setTargetVendorId(effectiveVendorId);

    // Load vendor profile (for the target vendor, not necessarily current user)
    const { data: vendorData } = await supabase
      .from("vendor_profile")
      .select("*")
      .eq("user_id", effectiveVendorId)
      .maybeSingle();

    setVendorProfile(vendorData);
    
    // If admin viewing another vendor, store their name for display
    if (isAdmin && vendorIdParam && vendorIdParam !== user.id) {
      setTargetVendorName(vendorData?.company_name || null);
    }

    // Load seeking coverage posts with auto-expiry logic
    await loadPosts(effectiveVendorId);

    setLoading(false);
  };

  const loadPosts = async (vendorId?: string) => {
    if (!user) return;
    
    const effectiveVendorId = vendorId || targetVendorId || user.id;

    // Auto-expire old active posts (only for own posts, not admin viewing)
    if (effectiveVendorId === user.id) {
      const { error: updateError } = await supabase
        .from("seeking_coverage_posts")
        .update({
          status: "expired",
          is_accepting_responses: false,
        })
        .eq("vendor_id", effectiveVendorId)
        .eq("status", "active")
        .lt("auto_expires_at", new Date().toISOString());

      if (updateError) {
        console.error("Error auto-expiring posts:", updateError);
      }
    }

    // Fetch all non-deleted posts
    const { data: posts, error: postsError } = await supabase
      .from("seeking_coverage_posts")
      .select("*")
      .eq("vendor_id", effectiveVendorId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (postsError) {
      console.error("Error loading posts:", postsError);
      toast({
        title: "Error",
        description: "Failed to load seeking coverage posts.",
        variant: "destructive",
      });
      return;
    }

    // Fetch county data and rep profile for filled posts separately
    const postsWithDetails = await Promise.all(
      (posts || []).map(async (post) => {
        let enrichedPost = { ...post, us_counties: null as { county_name: string; state_name: string } | null, filled_by_rep: null as { anonymous_id: string | null } | null };
        
        // Fetch county data
        if (post.county_id) {
          const { data: countyData } = await supabase
            .from("us_counties")
            .select("county_name, state_name")
            .eq("id", post.county_id)
            .maybeSingle();
          
          enrichedPost.us_counties = countyData;
        }
        
        // Fetch rep anonymous ID for filled posts
        if (post.filled_by_rep_id) {
          const { data: repData } = await supabase
            .from("rep_profile")
            .select("anonymous_id")
            .eq("user_id", post.filled_by_rep_id)
            .maybeSingle();
          
          enrichedPost.filled_by_rep = repData;
        }
        
        return enrichedPost;
      })
    );

    setAllPosts(postsWithDetails);

    // Load interested rep counts for all posts (exclude declined)
    if (posts && posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const { data: interestData } = await supabase
        .from("rep_interest")
        .select("post_id")
        .in("post_id", postIds)
        .neq("status", "declined_by_vendor");

      if (interestData) {
        const counts: Record<string, number> = {};
        interestData.forEach((item: any) => {
          counts[item.post_id] = (counts[item.post_id] || 0) + 1;
        });
        setInterestedCounts(counts);
      }
    }
  };

  // Get unique states from posts
  const availableStates = useMemo(() => {
    const states = new Set<string>();
    allPosts.forEach(post => {
      if (post.state_code) states.add(post.state_code);
    });
    return Array.from(states).sort();
  }, [allPosts]);

  // Compute summary stats for open posts
  const openPostStats = useMemo(() => {
    const openPosts = allPosts.filter(p => p.status === "active");
    const openTotal = openPosts.length;
    const openWithInterest = openPosts.filter(p => (interestedCounts[p.id] || 0) > 0).length;
    const openWithoutInterest = openTotal - openWithInterest;
    return { openTotal, openWithInterest, openWithoutInterest };
  }, [allPosts, interestedCounts]);

  // Filter and sort posts
  useEffect(() => {
    const now = new Date();
    let filtered: SeekingCoveragePost[];
    
    // Status filter
    switch (filterStatus) {
      case "open":
        filtered = allPosts.filter((p) => p.status === "active");
        break;
      case "closed":
        filtered = allPosts.filter((p) => p.status === "closed");
        break;
      case "expired":
        filtered = allPosts.filter((p) => p.status === "expired" || (p.auto_expires_at && new Date(p.auto_expires_at) < now));
        break;
      case "all":
      default:
        filtered = [...allPosts];
        break;
    }

    // State filter
    if (stateFilter !== "all") {
      filtered = filtered.filter(p => p.state_code === stateFilter);
    }

    // County search
    if (countySearch.trim()) {
      const search = countySearch.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.us_counties?.county_name?.toLowerCase().includes(search) ||
        (p.covers_entire_state && "all counties".includes(search))
      );
    }

    // Title search
    if (titleSearch.trim()) {
      const search = titleSearch.toLowerCase().trim();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(search));
    }

    // Interest filter
    if (interestFilter === "with_interest") {
      filtered = filtered.filter(p => (interestedCounts[p.id] || 0) > 0);
    } else if (interestFilter === "no_responses") {
      filtered = filtered.filter(p => (interestedCounts[p.id] || 0) === 0);
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (sortColumn) {
          case "title":
            comparison = a.title.localeCompare(b.title);
            break;
          case "location":
            const locA = `${a.state_code || ""}-${a.us_counties?.county_name || ""}`;
            const locB = `${b.state_code || ""}-${b.us_counties?.county_name || ""}`;
            comparison = locA.localeCompare(locB);
            break;
          case "rate":
            const rateA = a.pay_max || a.pay_min || 0;
            const rateB = b.pay_max || b.pay_min || 0;
            comparison = rateA - rateB;
            break;
          case "interested":
            comparison = (interestedCounts[a.id] || 0) - (interestedCounts[b.id] || 0);
            break;
          case "status":
            comparison = a.status.localeCompare(b.status);
            break;
          case "expires":
            const expA = a.auto_expires_at ? new Date(a.auto_expires_at).getTime() : 0;
            const expB = b.auto_expires_at ? new Date(b.auto_expires_at).getTime() : 0;
            comparison = expA - expB;
            break;
        }
        
        return sortDirection === "asc" ? comparison : -comparison;
      });
    } else if (sortMode === "interest") {
      filtered.sort((a, b) => {
        const countA = interestedCounts[a.id] || 0;
        const countB = interestedCounts[b.id] || 0;
        if (countB !== countA) {
          return countB - countA;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else if (sortMode === "oldest") {
      filtered.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      filtered.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    setFilteredPosts(filtered);
  }, [filterStatus, allPosts, sortMode, sortColumn, sortDirection, interestedCounts, stateFilter, countySearch, titleSearch, interestFilter]);

  const handleColumnSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const handleQuickFilter = (type: "with_interest" | "no_responses") => {
    setFilterStatus("open");
    setInterestFilter(type);
  };

  const clearQuickFilters = () => {
    setInterestFilter("all");
  };

  const handleCreateNew = () => {
    if (!vendorProfile) {
      toast({
        title: "Profile Required",
        description: "Please complete your Vendor Profile before posting Seeking Coverage.",
        variant: "destructive",
      });
      navigate("/vendor/profile");
      return;
    }

    const isComplete =
      vendorProfile.company_name &&
      vendorProfile.city &&
      vendorProfile.state &&
      vendorProfile.systems_used?.length > 0 &&
      vendorProfile.primary_inspection_types?.length > 0;

    if (!isComplete) {
      toast({
        title: "Complete Your Profile First",
        description:
          "Please complete your Vendor Profile (company details, location, systems, and inspection types) before posting Seeking Coverage.",
        variant: "destructive",
      });
      navigate("/vendor/profile");
      return;
    }

    setEditingPost(null);
    setDialogOpen(true);
  };

  const handleEdit = (post: SeekingCoveragePost) => {
    setEditingPost(post);
    setDialogOpen(true);
  };

  const handleClose = async (postId: string) => {
    const { error } = await supabase
      .from("seeking_coverage_posts")
      .update({
        status: "closed",
        is_accepting_responses: false,
      })
      .eq("id", postId);

    if (error) {
      toast({
        title: "Error",
        description: "Unable to update this request. Please try again or contact support.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request Closed",
      description: "Your seeking coverage request has been closed.",
    });

    await sendPostClosedMessages(postId);
    loadPosts();
  };

  const sendPostClosedMessages = async (postId: string) => {
    if (!user) return;

    try {
      const { data: post } = await supabase
        .from("seeking_coverage_posts")
        .select("title")
        .eq("id", postId)
        .maybeSingle();

      if (!post) return;

      const { data: interests } = await supabase
        .from("rep_interest")
        .select("rep_id")
        .eq("post_id", postId)
        .neq("status", "declined_by_vendor");

      if (!interests || interests.length === 0) return;

      const repProfileIds = interests.map(i => i.rep_id);
      const { data: repProfiles } = await supabase
        .from("rep_profile")
        .select("user_id, anonymous_id")
        .in("id", repProfileIds);

      if (!repProfiles || repProfiles.length === 0) return;

      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, participant_one, participant_two")
        .eq("origin_post_id", postId)
        .or(
          repProfiles.map(rp => 
            `participant_one.eq.${rp.user_id},participant_two.eq.${rp.user_id}`
          ).join(",")
        );

      if (!conversations || conversations.length === 0) return;

      const { data: customTemplates } = await supabase
        .from("vendor_message_templates")
        .select("body")
        .eq("user_id", user.id)
        .eq("name", "Post Closed – Coverage Established")
        .eq("scope", "seeking_coverage")
        .maybeSingle();

      const defaultTemplate = `Hi {{REP_ANON}},

Coverage has now been established for {{POST_TITLE}}. Please keep an eye on ClearMarket for future opportunities in your coverage areas.

Thank you again for your interest!`;

      const templateBody = customTemplates?.body || defaultTemplate;
      const repAnonMap = new Map(repProfiles.map(rp => [rp.user_id, rp.anonymous_id]));

      for (const conv of conversations) {
        const repUserId = conv.participant_one === user.id ? conv.participant_two : conv.participant_one;
        const repAnon = repAnonMap.get(repUserId);

        const messageBody = templateBody
          .replace(/{{REP_ANON}}/g, repAnon || "")
          .replace(/{{POST_TITLE}}/g, post.title || "");

        await supabase
          .from("messages")
          .insert({
            conversation_id: conv.id,
            sender_id: user.id,
            recipient_id: repUserId,
            body: messageBody,
            read: false,
          });

        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: messageBody.substring(0, 100),
          })
          .eq("id", conv.id);
      }
    } catch (error) {
      console.error("Error sending post closed messages:", error);
    }
  };

  const handleReopen = async (postId: string) => {
    const { error } = await supabase
      .from("seeking_coverage_posts")
      .update({
        status: "active",
        is_accepting_responses: true,
      })
      .eq("id", postId);

    if (error) {
      toast({
        title: "Error",
        description: "Unable to update this request. Please try again or contact support.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request Reopened",
      description: "Your seeking coverage request is now active again.",
    });

    loadPosts();
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this Seeking Coverage post? This will hide it from all reps but preserve it in your internal history.")) {
      return;
    }

    const { error } = await supabase
      .from("seeking_coverage_posts")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (error) {
      toast({
        title: "Error",
        description: "Unable to update this request. Please try again or contact support.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request Deleted",
      description: "Your seeking coverage request has been deleted.",
    });

    loadPosts();
  };

  const getLocationDisplay = (post: SeekingCoveragePost) => {
    if (post.covers_entire_state) {
      return `All counties, ${post.state_code}`;
    }
    const countyName = post.us_counties?.county_name || "Unknown County";
    return `${countyName}, ${post.state_code}`;
  };

  const getStatusBadge = (post: SeekingCoveragePost) => {
    const now = new Date();
    const isExpired = post.auto_expires_at && new Date(post.auto_expires_at) < now;

    if (post.status === "active" && !isExpired) {
      return <Badge className="bg-green-600/20 text-green-600 border-green-600/30 text-xs">Open</Badge>;
    } else if (post.status === "closed") {
      // Check if filled by a rep
      if (post.closed_reason === "filled" && post.filled_by_rep?.anonymous_id) {
        return (
          <Badge variant="outline" className="text-muted-foreground text-xs">
            Filled – {post.filled_by_rep.anonymous_id}
          </Badge>
        );
      }
      return <Badge variant="outline" className="text-muted-foreground text-xs">Closed</Badge>;
    } else if (post.status === "in_discussion") {
      return <Badge className="bg-blue-600/20 text-blue-600 border-blue-600/30 text-xs">In discussion</Badge>;
    } else if (post.status === "expired" || isExpired) {
      return <Badge className="bg-orange-600/20 text-orange-600 border-orange-600/30 text-xs">Expired</Badge>;
    }
    return null;
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "…";
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Admin View Banner */}
        {profile?.is_admin && (
          <div className="mb-3 rounded-md bg-amber-900/40 border border-amber-500/40 px-3 py-2 text-xs text-amber-100 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              You are viewing this page with <span className="font-semibold">Admin</span> access.
              {isAdminViewingOther && targetVendorName && (
                <> Viewing posts for <span className="font-semibold">{targetVendorName}</span>.</>
              )}
              {isAdminViewingOther && !targetVendorName && vendorIdParam && (
                <> Viewing posts for vendor <span className="font-mono text-[10px]">{vendorIdParam.slice(0,8)}...</span>.</>
              )}
            </span>
          </div>
        )}
        
        {/* Page Header */}
        <PageHeader
          title="Seeking Coverage"
          subtitle={isAdminViewingOther 
            ? `Viewing Seeking Coverage posts for ${targetVendorName || 'this vendor'}.`
            : "Post where you need Field Reps. Requests auto-expire after 30 days."}
          showBackToDashboard
        />

        {/* Create New Button */}
        <div className="mb-6">
          {isAdminViewingOther ? (
            <Button size="lg" disabled className="opacity-60 cursor-not-allowed" title="Admins can view vendor posts here; posting on their behalf is not available yet.">
              <PlusCircle className="h-5 w-5 mr-2" />
              New Seeking Coverage Request
            </Button>
          ) : (
            <Button onClick={handleCreateNew} size="lg">
              <PlusCircle className="h-5 w-5 mr-2" />
              New Seeking Coverage Request
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="mb-4">
          <Tabs value={filterStatus} onValueChange={(v) => { setFilterStatus(v as typeof filterStatus); clearQuickFilters(); }}>
            <TabsList>
              <TabsTrigger value="all">All ({allPosts.length})</TabsTrigger>
              <TabsTrigger value="open">Open ({openPostStats.openTotal})</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
              <TabsTrigger value="expired">Expired</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Summary Chips for Open Posts */}
        <div className="mb-4 flex flex-wrap gap-3">
          <button
            onClick={() => handleQuickFilter("with_interest")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              interestFilter === "with_interest" && filterStatus === "open"
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <Users className="h-4 w-4" />
            <div className="text-left">
              <p className="text-sm font-medium">Open with interested reps</p>
              <p className="text-xs text-muted-foreground">{openPostStats.openWithInterest} posts</p>
            </div>
          </button>
          
          <button
            onClick={() => handleQuickFilter("no_responses")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              interestFilter === "no_responses" && filterStatus === "open"
                ? "bg-muted border-border text-foreground"
                : "bg-card border-border hover:border-muted-foreground/40 hover:bg-muted/50"
            }`}
          >
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <div className="text-left">
              <p className="text-sm font-medium">Open with no responses</p>
              <p className="text-xs text-muted-foreground">{openPostStats.openWithoutInterest} posts</p>
            </div>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
          <div className="flex flex-wrap items-center gap-3">
            {/* State Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">State:</span>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {availableStates.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* County Search */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">County:</span>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input 
                  placeholder="Search..."
                  value={countySearch}
                  onChange={(e) => setCountySearch(e.target.value)}
                  className="w-[120px] h-8 text-xs pl-7"
                />
              </div>
            </div>

            {/* Title Search */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Title:</span>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input 
                  placeholder="Search..."
                  value={titleSearch}
                  onChange={(e) => setTitleSearch(e.target.value)}
                  className="w-[140px] h-8 text-xs pl-7"
                />
              </div>
            </div>

            {/* Interest Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Interest:</span>
              <Select value={interestFilter} onValueChange={(v) => setInterestFilter(v as InterestFilter)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="with_interest">With interested reps</SelectItem>
                  <SelectItem value="no_responses">No responses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 ml-auto">
              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              <Select value={sortMode} onValueChange={(v) => { setSortMode(v as SortMode); setSortColumn(null); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="interest">Interest at top</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Posts Table */}
        {filteredPosts.length === 0 ? (
          <Card className="p-12 text-center border-2 border-dashed">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {isAdminViewingOther 
                  ? "No Seeking Coverage posts found"
                  : "No Seeking Coverage posts yet"}
              </h3>
              <p className="text-muted-foreground mb-6">
                {isAdminViewingOther
                  ? `This vendor has no Seeking Coverage posts${filterStatus !== "all" ? " matching this filter" : ""}.`
                  : "Create your first post to let reps know where you need coverage."}
              </p>
              {!isAdminViewingOther && (
                <Button onClick={handleCreateNew}>
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Create Seeking Coverage Post
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => handleColumnSort("title")}
                  >
                    <div className="flex items-center">
                      Title
                      {getSortIcon("title")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => handleColumnSort("location")}
                  >
                    <div className="flex items-center">
                      Location
                      {getSortIcon("location")}
                    </div>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Inspection Types</TableHead>
                  <TableHead className="hidden xl:table-cell">Systems</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => handleColumnSort("rate")}
                  >
                    <div className="flex items-center">
                      Offered Rate
                      {getSortIcon("rate")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 transition-colors text-center"
                    onClick={() => handleColumnSort("interested")}
                  >
                    <div className="flex items-center justify-center">
                      <Users className="h-3.5 w-3.5 mr-1" />
                      Interest
                      {getSortIcon("interested")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => handleColumnSort("status")}
                  >
                    <div className="flex items-center">
                      Status
                      {getSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="hidden md:table-cell cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => handleColumnSort("expires")}
                  >
                    <div className="flex items-center">
                      Auto-expires
                      {getSortIcon("expires")}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TooltipProvider>
                  {filteredPosts.map((post) => {
                    const isActive = post.status === "active";
                    const isClosed = post.status === "closed";
                    const now = new Date();
                    const isExpired = post.auto_expires_at && new Date(post.auto_expires_at) < now;
                    const canReopen = (isClosed || post.status === "expired") && (!post.auto_expires_at || new Date(post.auto_expires_at) >= now);
                    const isHighlighted = highlightPostId === post.id;
                    const interestedCount = interestedCounts[post.id] || 0;
                    const expiringSoon = post.auto_expires_at && isActive && differenceInDays(new Date(post.auto_expires_at), now) <= 7 && differenceInDays(new Date(post.auto_expires_at), now) >= 0;

                    return (
                      <TableRow 
                        key={post.id}
                        ref={isHighlighted ? highlightedPostRef : undefined}
                        className={`${isActive ? '' : 'opacity-60'} ${isHighlighted ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                      >
                        {/* Title */}
                        <TableCell className="font-medium max-w-[200px]">
                          <button 
                            onClick={() => setViewingPost(post)}
                            className="text-left hover:text-primary transition-colors"
                          >
                            {truncateText(post.title, 30)}
                          </button>
                        </TableCell>

                        {/* Location */}
                        <TableCell className="text-sm whitespace-nowrap">
                          {getLocationDisplay(post)}
                        </TableCell>

                        {/* Inspection Types */}
                        <TableCell className="hidden lg:table-cell max-w-[150px]">
                          {post.inspection_types.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground cursor-help">
                                  {truncateText(post.inspection_types.join(", "), 25)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <p className="text-xs">{post.inspection_types.join(", ")}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Systems */}
                        <TableCell className="hidden xl:table-cell max-w-[120px]">
                          {post.systems_required_array.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground cursor-help">
                                  {truncateText(post.systems_required_array.join(", "), 20)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <p className="text-xs">{post.systems_required_array.join(", ")}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Offered Rate */}
                        <TableCell className="text-sm font-medium text-primary whitespace-nowrap">
                          {formatVendorOfferedRate(post.pay_min, post.pay_max, post.pay_type)}
                        </TableCell>

                        {/* Interested Reps */}
                        <TableCell className="text-center">
                          {interestedCount > 0 ? (
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                              {interestedCount}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getStatusBadge(post)}
                            {expiringSoon && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Expiring in {differenceInDays(new Date(post.auto_expires_at!), now)} days</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>

                        {/* Auto-expires */}
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {post.auto_expires_at && (isActive || post.status === "expired") 
                            ? format(new Date(post.auto_expires_at), "MMM d, yyyy")
                            : "—"
                          }
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 px-2">
                                <span className="text-xs">Actions</span>
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => setViewingPost(post)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {interestedCount > 0 && (
                                <DropdownMenuItem onClick={() => navigate(`/vendor/seeking-coverage/${post.id}/interested`)}>
                                  <Users className="h-4 w-4 mr-2" />
                                  View Interested Reps ({interestedCount})
                                </DropdownMenuItem>
                              )}
                              {isActive && (
                                <>
                                  <DropdownMenuItem onClick={() => handleEdit(post)}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleClose(post.id)}>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Close
                                  </DropdownMenuItem>
                                </>
                              )}
                              {!isActive && (
                                <>
                                  {canReopen && (
                                    <DropdownMenuItem onClick={() => handleReopen(post.id)}>
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                      Reopen
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(post.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TooltipProvider>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Results count */}
        {filteredPosts.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Showing {filteredPosts.length} of {allPosts.length} posts
          </p>
        )}
      </div>

      {/* Dialog for Create/Edit */}
      <SeekingCoverageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingPost={editingPost}
        onSave={() => {
          setDialogOpen(false);
          loadPosts();
        }}
      />

      {/* View Detail Dialog */}
      <Dialog open={!!viewingPost} onOpenChange={(open) => !open && setViewingPost(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Seeking Coverage Details</DialogTitle>
          </DialogHeader>
          {viewingPost && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">{viewingPost.title}</h3>
                <p className="text-sm text-muted-foreground">{getLocationDisplay(viewingPost)}</p>
              </div>

              {viewingPost.description && (
                <div>
                  <p className="text-sm font-medium mb-1">Description</p>
                  <p className="text-sm text-muted-foreground">{viewingPost.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Inspection Types</p>
                <div className="flex flex-wrap gap-2">
                  {viewingPost.inspection_types.map((type, idx) => (
                    <Badge key={idx} variant="outline">{type}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Systems Required</p>
                <div className="flex flex-wrap gap-2">
                  {viewingPost.systems_required_array.map((system, idx) => (
                    <Badge key={idx} variant="outline">{system}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Offered Rate</p>
                <p className="text-lg font-semibold text-primary">
                  {formatVendorOfferedRate(viewingPost.pay_min, viewingPost.pay_max, viewingPost.pay_type)}
                </p>
                {viewingPost.pay_notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{viewingPost.pay_notes}</p>
                )}
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <div className="mt-1">{getStatusBadge(viewingPost)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium">Interested Reps</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {interestedCounts[viewingPost.id] || 0}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-sm text-muted-foreground">{format(new Date(viewingPost.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>

              {viewingPost.auto_expires_at && (
                <div>
                  <p className="text-sm font-medium">Auto-expires</p>
                  <p className="text-sm text-muted-foreground">{format(new Date(viewingPost.auto_expires_at), "MMM d, yyyy")}</p>
                </div>
              )}

              {/* Quick Actions in Dialog */}
              <div className="flex gap-2 pt-4 border-t border-border">
                {(interestedCounts[viewingPost.id] || 0) > 0 && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => {
                      setViewingPost(null);
                      navigate(`/vendor/seeking-coverage/${viewingPost.id}/interested`);
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    View Interested Reps
                  </Button>
                )}
                {viewingPost.status === "active" && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => {
                      setViewingPost(null);
                      handleEdit(viewingPost);
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AuthenticatedLayout>
  );
};

export default VendorSeekingCoverage;
