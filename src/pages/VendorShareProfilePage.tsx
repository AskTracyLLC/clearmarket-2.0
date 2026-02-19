import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Share2, Copy, ExternalLink, RefreshCw, AlertCircle, Briefcase, Megaphone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SeekingCoverageToggle } from "@/components/SeekingCoverageToggle";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMimic } from "@/hooks/useMimic";
import { getPublicShareUrl, isPreviewEnvironment } from "@/lib/publicUrl";

function generateSlug(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 10 + Math.floor(Math.random() * 3);
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

export default function VendorShareProfilePage() {
  const { effectiveUserId } = useMimic();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const STORAGE_KEY_SHOW_COUNTIES = "cm_share_showCountyDetails";
  const [showCountyDetails, setShowCountyDetails] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SHOW_COUNTIES) === '1';
    } catch { return false; }
  });
  const { toast } = useToast();

  // Persist county details toggle
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SHOW_COUNTIES, showCountyDetails ? '1' : '0');
    } catch {}
  }, [showCountyDetails]);

  useEffect(() => {
    if (effectiveUserId) loadProfile();
  }, [effectiveUserId]);

  async function loadProfile() {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('share_profile_slug, share_profile_enabled, share_profile_last_generated_at')
        .eq('id', effectiveUserId)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile share settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateLink() {
    if (!effectiveUserId) return;
    setUpdating(true);
    try {
      const newSlug = generateSlug();
      const { error } = await supabase
        .from('profiles')
        .update({
          share_profile_slug: newSlug,
          share_profile_enabled: true,
          share_profile_last_generated_at: new Date().toISOString()
        })
        .eq('id', effectiveUserId);
      if (error) throw error;
      setProfile({ ...profile, share_profile_slug: newSlug, share_profile_enabled: true, share_profile_last_generated_at: new Date().toISOString() });
      toast({ title: "Share links created", description: "Your public profile links are now available." });
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({ title: "Failed to create links", description: "Please try again.", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  }

  async function handleRegenerateLink() {
    if (!effectiveUserId) return;
    setUpdating(true);
    try {
      const newSlug = generateSlug();
      const { error } = await supabase
        .from('profiles')
        .update({ share_profile_slug: newSlug, share_profile_last_generated_at: new Date().toISOString() })
        .eq('id', effectiveUserId);
      if (error) throw error;
      setProfile({ ...profile, share_profile_slug: newSlug, share_profile_last_generated_at: new Date().toISOString() });
      toast({ title: "Links regenerated", description: "Old links will no longer work. Share the new ones instead." });
    } catch (error) {
      console.error('Error regenerating share link:', error);
      toast({ title: "Failed to regenerate links", description: "Please try again.", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  }

  async function handleToggleEnabled(enabled: boolean) {
    if (!effectiveUserId || !profile?.share_profile_slug) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ share_profile_enabled: enabled })
        .eq('id', effectiveUserId);
      if (error) throw error;
      setProfile({ ...profile, share_profile_enabled: enabled });
      toast({
        title: enabled ? "Profile links enabled" : "Profile links disabled",
        description: enabled ? "Your public profile is now visible to anyone with the link." : "Your public profile links are now disabled."
      });
    } catch (error) {
      console.error('Error toggling share link:', error);
      toast({ title: "Update failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  }

  function buildUrl(viewParam: 'client' | 'recruiting') {
    if (!profile?.share_profile_slug) return '';
    const base = getPublicShareUrl(profile.share_profile_slug);
    const url = new URL(base);
    url.searchParams.set('view', viewParam);
    if (showCountyDetails) {
      url.searchParams.set('counties', '1');
    }
    return url.toString();
  }

  function copyUrl(viewParam: 'client' | 'recruiting') {
    const url = buildUrl(viewParam);
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: `${viewParam === 'client' ? 'Client' : 'Recruiting'} share link copied to clipboard.` });
  }

  function previewUrl(viewParam: 'client' | 'recruiting') {
    if (!profile?.share_profile_slug) return;
    const url = new URL(`/share/vendor/${profile.share_profile_slug}`, window.location.origin);
    url.searchParams.set('view', viewParam);
    if (showCountyDetails) {
      url.searchParams.set('counties', '1');
    }
    window.open(url.toString(), '_blank');
  }

  const showPreviewWarning = isPreviewEnvironment();

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Share2 className="h-8 w-8" />
          Share Profile
        </h1>
        <p className="text-muted-foreground">
          Create shareable links to showcase your vendor profile outside ClearMarket
        </p>
      </div>

      {/* Main share card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Profile Share Links
          </CardTitle>
          <CardDescription>
            Generate two versions of your public profile link — one for clients and one for recruiting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !profile?.share_profile_slug ? (
            <Button onClick={handleGenerateLink} disabled={updating}>
              {updating ? "Generating..." : "Generate Share Links"}
            </Button>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enable-profile-share"
                  checked={profile.share_profile_enabled}
                  onCheckedChange={handleToggleEnabled}
                  disabled={updating}
                />
                <Label htmlFor="enable-profile-share">Enable profile share links</Label>
              </div>

              {profile.share_profile_enabled ? (
                <>
                  {showPreviewWarning && (
                    <div className="flex items-start gap-2 p-3 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium text-amber-500">Preview Mode:</span>{" "}
                        <span className="text-muted-foreground">
                          Links below point to the production site. Use "Preview" to test locally.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Client Share Link */}
                  <LinkCard
                    icon={<Briefcase className="h-5 w-5 text-primary" />}
                    label="Client Share Link"
                    description="Best for clients and partners. Highlights your coverage footprint and company profile."
                    url={buildUrl('client')}
                    onCopy={() => copyUrl('client')}
                    onPreview={() => previewUrl('client')}
                    tips={["Add to proposals, RFPs, and client emails", "Include in your company website or email signature"]}
                  />

                  {/* Recruiting Share Link */}
                  <LinkCard
                    icon={<Megaphone className="h-5 w-5 text-primary" />}
                    label="Recruiting Share Link"
                    description="Best for field reps. Includes your 'Seeking Coverage' areas and recruiting callouts."
                    url={buildUrl('recruiting')}
                    onCopy={() => copyUrl('recruiting')}
                    onPreview={() => previewUrl('recruiting')}
                    tips={["Share on LinkedIn, forums, or rep outreach", "Use in recruiting materials to attract new reps"]}
                  />

                  <Separator />

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateLink}
                      disabled={updating}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Regenerate Links
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Regenerating will invalidate both old links.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enable sharing to generate your client and recruiting links.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Seeking Coverage Areas Toggle */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
        <h3 className="font-semibold mb-3">Public Profile Options</h3>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show-county-details"
            checked={showCountyDetails}
            onCheckedChange={(checked) => setShowCountyDetails(!!checked)}
          />
          <Label htmlFor="show-county-details" className="text-sm font-normal cursor-pointer">
            Show county details for partial coverage states
          </Label>
        </div>
        <SeekingCoverageToggle />
      </div>
    </div>
  );
}

/** Reusable link card for Client / Recruiting */
function LinkCard({
  icon,
  label,
  description,
  url,
  onCopy,
  onPreview,
  tips,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  url: string;
  onCopy: () => void;
  onPreview: () => void;
  tips: string[];
}) {
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={url}
          className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border truncate"
        />
        <Button size="icon" variant="outline" onClick={onCopy} title="Copy link">
          <Copy className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={onPreview} title="Preview">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {tips.map((tip) => (
          <li key={tip}>• {tip}</li>
        ))}
      </ul>
    </div>
  );
}
