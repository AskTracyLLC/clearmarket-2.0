-- Allow staff users (admins) to view notifications for any user (for mimic mode)
CREATE POLICY "Staff can read all notifications" 
ON public.notifications 
FOR SELECT 
USING (is_staff_user(auth.uid()));