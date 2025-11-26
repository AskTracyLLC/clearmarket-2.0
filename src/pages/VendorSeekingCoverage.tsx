import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, PlusCircle, Edit2, XCircle, Copy } from "lucide-react";
import { SeekingCoverageDialog } from "@/components/SeekingCoverageDialog";
import { format } from "date-fns";

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
  us_counties?: {
    county_name: string;
    state_name: string;
  } | null;
}

const VendorSeekingCoverage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [activePosts, setActivePosts] = useState<SeekingCoveragePost[]>([]);
  const [closedPosts, setClosedPosts] = useState<SeekingCoveragePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SeekingCoveragePost | null>(null);

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

    // Redirect if not vendor
    if (!profileData.is_vendor_admin) {
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

    // Fetch all posts
    const { data: posts, error: postsError } = await supabase
      .from("seeking_coverage_posts")
      .select("*")
      .eq("vendor_id", user.id)
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

    // Split into active and closed
    setActivePosts(postsWithCounties.filter((p) => p.status === "active"));
    setClosedPosts(postsWithCounties.filter((p) => p.status === "expired" || p.status === "closed"));
  };

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
        description: "Failed to close post.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Post Closed",
      description: "Your seeking coverage post has been closed.",
    });

    loadPosts();
  };

  const handleDuplicate = () => {
    toast({
      title: "Coming Soon",
      description: "Duplicate will be available in a later release.",
    });
  };

  const handleReopen = () => {
    toast({
      title: "Coming Soon",
      description: "Reopen / Renew will be available in a later release.",
    });
  };

  const getLocationDisplay = (post: SeekingCoveragePost) => {
    if (post.covers_entire_state) {
      const stateName = post.us_counties?.state_name || post.state_code || "Unknown";
      return `Statewide – ${stateName}`;
    }

    const countyName = post.us_counties?.county_name || "Unknown County";
    const stateName = post.us_counties?.state_name || post.state_code || "Unknown";
    return `${countyName}, ${stateName}`;
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

        {/* Active Requests Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Active Requests</h2>
          {activePosts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No active requests yet. Create your first Seeking Coverage post to get started.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {activePosts.map((post) => (
                <Card key={post.id} className="p-6 bg-card-elevated border border-border">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">{post.title}</h3>
                      <p className="text-sm text-muted-foreground mb-1">{getLocationDisplay(post)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.is_accepting_responses ? (
                        <Badge className="bg-secondary/20 text-secondary border-secondary/30">
                          Accepting Responses
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not Accepting
                        </Badge>
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

                  {/* Auto-Expiry */}
                  {post.auto_expires_at && (
                    <p className="text-xs text-muted-foreground mb-4">
                      Auto-expires on {format(new Date(post.auto_expires_at), "MMM d, yyyy")}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button variant="secondary" size="sm" onClick={() => handleEdit(post)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleClose(post.id)}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Close Request
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDuplicate}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate (Coming Soon)
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Expired / Closed Requests Section */}
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-4">Expired / Closed Requests</h2>
          {closedPosts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No expired or closed requests.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {closedPosts.map((post) => (
                <Card key={post.id} className="p-6 bg-muted/20 border border-border opacity-75">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{post.title}</h3>
                      <p className="text-sm text-muted-foreground mb-1">{getLocationDisplay(post)}</p>
                    </div>
                    <Badge variant="outline" className="text-muted-foreground">
                      {post.status === "expired" ? "Expired" : "Closed"}
                    </Badge>
                  </div>

                  {post.auto_expires_at && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Originally expired on {format(new Date(post.auto_expires_at), "MMM d, yyyy")}
                    </p>
                  )}

                  <Button variant="ghost" size="sm" onClick={handleReopen}>
                    Reopen / Renew (Coming Soon)
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
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
    </div>
  );
};

export default VendorSeekingCoverage;
