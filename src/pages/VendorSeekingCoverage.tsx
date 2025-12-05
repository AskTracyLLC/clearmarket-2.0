import { useEffect, useState, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, PlusCircle, Edit2, XCircle, RotateCcw, Trash2, Eye, AlertCircle, Users } from "lucide-react";
import { SeekingCoverageDialog } from "@/components/SeekingCoverageDialog";
import { format, differenceInDays } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AdminViewBanner from "@/components/AdminViewBanner";

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
  us_counties?: {
    county_name: string;
    state_name: string;
  } | null;
}

const VendorSeekingCoverage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightPostId = searchParams.get("highlightPostId");
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
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "closed" | "expired">("all");
  
  // Interested reps count per post
  const [interestedCounts, setInterestedCounts] = useState<Record<string, number>>({});
  
  // Ref for scrolling to highlighted post
  const highlightedPostRef = useRef<HTMLDivElement>(null);
  
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

    // Load vendor profile
    const { data: vendorData } = await supabase
      .from("vendor_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    setVendorProfile(vendorData);

    // Load seeking coverage posts with auto-expiry logic
    await loadPosts();

    setLoading(false);
  };

  const loadPosts = async () => {
    if (!user) return;

    // Auto-expire old active posts
    const { error: updateError } = await supabase
      .from("seeking_coverage_posts")
      .update({
        status: "expired",
        is_accepting_responses: false,
      })
      .eq("vendor_id", user.id)
      .eq("status", "active")
      .lt("auto_expires_at", new Date().toISOString());

    if (updateError) {
      console.error("Error auto-expiring posts:", updateError);
    }

    // Fetch all non-deleted posts
    const { data: posts, error: postsError } = await supabase
      .from("seeking_coverage_posts")
      .select("*")
      .eq("vendor_id", user.id)
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

    // Fetch county data separately for posts that have county_id
    const postsWithCounties = await Promise.all(
      (posts || []).map(async (post) => {
        if (post.county_id) {
          const { data: countyData } = await supabase
            .from("us_counties")
            .select("county_name, state_name")
            .eq("id", post.county_id)
            .maybeSingle();
          
          return { ...post, us_counties: countyData };
        }
        return post;
      })
    );

    setAllPosts(postsWithCounties);

    // Load interested rep counts for all posts
    if (posts && posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const { data: interestData } = await supabase
        .from("rep_interest")
        .select("post_id")
        .in("post_id", postIds)
        .neq("status", "declined");

      if (interestData) {
        const counts: Record<string, number> = {};
        interestData.forEach((item: any) => {
          counts[item.post_id] = (counts[item.post_id] || 0) + 1;
        });
        setInterestedCounts(counts);
      }
    }
  };

  // Filter posts based on selected filter
  useEffect(() => {
    const now = new Date();
    
    switch (filterStatus) {
      case "open":
        setFilteredPosts(allPosts.filter((p) => p.status === "active"));
        break;
      case "closed":
        setFilteredPosts(allPosts.filter((p) => p.status === "closed"));
        break;
      case "expired":
        setFilteredPosts(allPosts.filter((p) => p.status === "expired" || (p.auto_expires_at && new Date(p.auto_expires_at) < now)));
        break;
      case "all":
      default:
        setFilteredPosts(allPosts);
        break;
    }
  }, [filterStatus, allPosts]);

  const handleCreateNew = () => {
    // Check vendor profile completion
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

    // Send auto-messages to interested reps with conversations
    await sendPostClosedMessages(postId);

    loadPosts();
  };

  const sendPostClosedMessages = async (postId: string) => {
    if (!user) return;

    try {
      // Get the post details for template
      const { data: post } = await supabase
        .from("seeking_coverage_posts")
        .select("title")
        .eq("id", postId)
        .maybeSingle();

      if (!post) return;

      // Find all interested reps for this post
      const { data: interests } = await supabase
        .from("rep_interest")
        .select("rep_id")
        .eq("post_id", postId)
        .neq("status", "declined");

      if (!interests || interests.length === 0) return;

      // Get rep profile user IDs
      const repProfileIds = interests.map(i => i.rep_id);
      const { data: repProfiles } = await supabase
        .from("rep_profile")
        .select("user_id, anonymous_id")
        .in("id", repProfileIds);

      if (!repProfiles || repProfiles.length === 0) return;

      // Find conversations with these reps for this specific post
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

      // Load vendor's custom template or use default
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

      // Build a map of rep user ID to anonymous ID
      const repAnonMap = new Map(repProfiles.map(rp => [rp.user_id, rp.anonymous_id]));

      // Send messages to each conversation
      for (const conv of conversations) {
        const repUserId = conv.participant_one === user.id ? conv.participant_two : conv.participant_one;
        const repAnon = repAnonMap.get(repUserId);

        // Render template with placeholders
        const messageBody = templateBody
          .replace(/{{REP_ANON}}/g, repAnon || "")
          .replace(/{{POST_TITLE}}/g, post.title || "");

        // Insert the message
        await supabase
          .from("messages")
          .insert({
            conversation_id: conv.id,
            sender_id: user.id,
            recipient_id: repUserId,
            body: messageBody,
            read: false,
          });

        // Update conversation metadata
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
      // Don't show error to user - this is a background operation
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
    // Show confirmation dialog
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
      return `Statewide – ${post.state_code}`;
    }

    const countyName = post.us_counties?.county_name || "Unknown County";
    return `${countyName}, ${post.state_code}`;
  };

  const getStatusBadge = (post: SeekingCoveragePost) => {
    const now = new Date();
    const isExpired = post.auto_expires_at && new Date(post.auto_expires_at) < now;

    if (post.status === "active" && !isExpired) {
      return <Badge className="bg-green-600/20 text-green-600 border-green-600/30">Open</Badge>;
    } else if (post.status === "closed") {
      return <Badge variant="outline" className="text-muted-foreground">Closed</Badge>;
    } else if (post.status === "expired" || isExpired) {
      return <Badge className="bg-orange-600/20 text-orange-600 border-orange-600/30">Expired</Badge>;
    }
    return null;
  };

  const isExpiringSoon = (post: SeekingCoveragePost) => {
    if (!post.auto_expires_at || post.status !== "active") return false;
    const daysUntilExpiry = differenceInDays(new Date(post.auto_expires_at), new Date());
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                ClearMarket
              </Link>
            </div>
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Admin View Banner */}
        {profile?.is_admin && <AdminViewBanner />}
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Seeking Coverage</h1>
          <p className="text-muted-foreground">
            Post where you need Field Reps. Requests auto-expire after 30 days.
          </p>
        </div>

        {/* Create New Button */}
        <div className="mb-8">
          <Button onClick={handleCreateNew} size="lg">
            <PlusCircle className="h-5 w-5 mr-2" />
            New Seeking Coverage Request
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
              <TabsTrigger value="expired">Expired</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Posts List */}
        {filteredPosts.length === 0 ? (
          <Card className="p-12 text-center border-2 border-dashed">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No Seeking Coverage posts yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Create your first post to let reps know where you need coverage.
              </p>
              <Button onClick={handleCreateNew}>
                <PlusCircle className="h-5 w-5 mr-2" />
                Create Seeking Coverage Post
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => {
              const isActive = post.status === "active";
              const isClosed = post.status === "closed";
              const now = new Date();
              const isExpired = post.auto_expires_at && new Date(post.auto_expires_at) < now;
              const canReopen = (isClosed || post.status === "expired") && (!post.auto_expires_at || new Date(post.auto_expires_at) >= now);

              const isHighlighted = highlightPostId === post.id;
              
              return (
                <Card 
                  key={post.id} 
                  ref={isHighlighted ? highlightedPostRef : undefined}
                  className={`p-6 ${isActive ? 'bg-card-elevated' : 'bg-muted/20 opacity-75'} border ${isHighlighted ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-foreground">{post.title}</h3>
                        {getStatusBadge(post)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{getLocationDisplay(post)}</p>
                      {isExpiringSoon(post) && (
                        <div className="flex items-center gap-2 text-orange-600 text-sm mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Expiring soon ({differenceInDays(new Date(post.auto_expires_at!), new Date())} days left)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inspection Types */}
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-2">Inspection Types:</p>
                    <div className="flex flex-wrap gap-2">
                      {post.inspection_types.map((type, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Systems Required */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Systems Required:</p>
                    <div className="flex flex-wrap gap-2">
                      {post.systems_required_array.map((system, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {system}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Pricing */}
                  {post.pay_min && (
                    <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">Offered Rate:</p>
                      <p className="text-lg font-semibold text-primary">
                        {post.pay_type === "fixed" 
                          ? `$${post.pay_min.toFixed(2)} / order`
                          : `$${post.pay_min.toFixed(2)} – $${post.pay_max?.toFixed(2)} / order`
                        }
                      </p>
                      {post.pay_notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{post.pay_notes}</p>
                      )}
                    </div>
                  )}

                  {/* Auto-Expiry */}
                  {post.auto_expires_at && (
                    <p className="text-xs text-muted-foreground mb-4">
                      {isExpired ? 'Expired on' : 'Auto-expires on'} {format(new Date(post.auto_expires_at), "MMM d, yyyy")}
                    </p>
                  )}

                  {/* Interested Reps Badge */}
                  {interestedCounts[post.id] > 0 && (
                    <div className="pt-3 border-t border-border">
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {interestedCounts[post.id]} Interested Rep{interestedCounts[post.id] !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button variant="secondary" size="sm" onClick={() => setViewingPost(post)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    {interestedCounts[post.id] > 0 && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => navigate(`/vendor/seeking-coverage/${post.id}/interested`)}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        View Interested Reps
                      </Button>
                    )}
                    {isActive && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => handleEdit(post)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleClose(post.id)}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Close
                        </Button>
                      </>
                    )}
                    {!isActive && (
                      <>
                        {canReopen && (
                          <Button variant="secondary" size="sm" onClick={() => handleReopen(post.id)}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reopen
                          </Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(post.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
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

              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <div className="mt-1">{getStatusBadge(viewingPost)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium">Accepting Responses</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {viewingPost.is_accepting_responses ? "Yes" : "No"}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorSeekingCoverage;
