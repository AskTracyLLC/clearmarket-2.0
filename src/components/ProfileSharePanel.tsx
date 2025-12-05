import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Share2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ProfileSharePanelProps {
  roleType: 'rep' | 'vendor';
}

// Generate a random URL-safe slug
function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 32; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

export function ProfileSharePanel({ roleType }: ProfileSharePanelProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  async function loadProfile() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('share_profile_slug, share_profile_enabled, share_profile_last_generated_at')
        .eq('id', user.id)
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
    if (!user) return;
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
        .eq('id', user.id);

      if (error) throw error;

      setProfile({
        ...profile,
        share_profile_slug: newSlug,
        share_profile_enabled: true,
        share_profile_last_generated_at: new Date().toISOString()
      });

      toast({
        title: "Share link created",
        description: "Your public profile link is now available to share."
      });
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: "Failed to create link",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  }

  async function handleRegenerateLink() {
    if (!user) return;
    setUpdating(true);
    try {
      const newSlug = generateSlug();
      const { error } = await supabase
        .from('profiles')
        .update({
          share_profile_slug: newSlug,
          share_profile_last_generated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({
        ...profile,
        share_profile_slug: newSlug,
        share_profile_last_generated_at: new Date().toISOString()
      });

      toast({
        title: "Link regenerated",
        description: "Your old link will no longer work. Share the new link instead."
      });
    } catch (error) {
      console.error('Error regenerating share link:', error);
      toast({
        title: "Failed to regenerate link",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  }

  async function handleToggleEnabled(enabled: boolean) {
    if (!user || !profile?.share_profile_slug) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ share_profile_enabled: enabled })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...profile, share_profile_enabled: enabled });

      toast({
        title: enabled ? "Profile link enabled" : "Profile link disabled",
        description: enabled
          ? "Your public profile is now visible to anyone with the link."
          : "Your public profile link is now disabled."
      });
    } catch (error) {
      console.error('Error toggling share link:', error);
      toast({
        title: "Update failed",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  }

  function handleCopyLink() {
    if (!profile?.share_profile_slug) return;
    const url = `${window.location.origin}/share/${roleType}/${profile.share_profile_slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Share this link on resumes, LinkedIn, or emails."
    });
  }

  function handlePreview() {
    if (!profile?.share_profile_slug) return;
    window.open(`/share/${roleType}/${profile.share_profile_slug}`, '_blank');
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Profile
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!profile?.share_profile_slug) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Profile
          </CardTitle>
          <CardDescription>
            Create a shareable profile link to showcase your ClearMarket profile outside the platform — perfect for resumes, LinkedIn, or client emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerateLink} disabled={updating}>
            {updating ? "Generating..." : "Generate Share Link"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const shareUrl = `${window.location.origin}/share/${roleType}/${profile.share_profile_slug}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Share Profile
        </CardTitle>
        <CardDescription>
          Share your full ClearMarket profile with anyone, even outside the platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="enable-profile-share"
            checked={profile.share_profile_enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={updating}
          />
          <Label htmlFor="enable-profile-share">Enable profile share link</Label>
        </div>

        {profile.share_profile_enabled && (
          <>
            <div className="space-y-2">
              <Label>Share URL</Label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border"
                />
                <Button size="icon" variant="outline" onClick={handleCopyLink} title="Copy link">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={handlePreview} title="Preview">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRegenerateLink} 
              disabled={updating}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate Link
            </Button>
            <p className="text-xs text-muted-foreground">
              Regenerating will invalidate the old link.
            </p>
          </>
        )}

        {!profile.share_profile_enabled && (
          <p className="text-sm text-muted-foreground">
            Your profile link is currently disabled. Enable it to share with potential partners or clients.
          </p>
        )}
      </CardContent>
    </Card>
  );
}