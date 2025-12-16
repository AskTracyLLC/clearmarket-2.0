-- Drop existing policies on notifications table
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users or admins can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users or admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users or admins can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users or admins can delete notifications" ON public.notifications;

-- SELECT: Users see only theirs, staff (admin/moderator/support) see everything
CREATE POLICY "Users or staff can view notifications"
ON public.notifications
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_staff_user(auth.uid())
);

-- INSERT: Users or staff can create notifications
CREATE POLICY "Users or staff can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR public.is_staff_user(auth.uid())
);

-- UPDATE: Users can update theirs; staff can update all
CREATE POLICY "Users or staff can update notifications"
ON public.notifications
FOR UPDATE
USING (
  auth.uid() = user_id
  OR public.is_staff_user(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_staff_user(auth.uid())
);

-- DELETE: Users or staff can delete (for hard deletes if needed)
CREATE POLICY "Users or staff can delete notifications"
ON public.notifications
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_staff_user(auth.uid())
);