-- Allow admins to update any community post (for hiding/moderation)
CREATE POLICY "Admins can update any community post"
ON public.community_posts
FOR UPDATE
USING (is_admin_user(auth.uid()));

-- Allow admins to delete community posts
CREATE POLICY "Admins can delete community posts"
ON public.community_posts
FOR DELETE
USING (is_admin_user(auth.uid()));