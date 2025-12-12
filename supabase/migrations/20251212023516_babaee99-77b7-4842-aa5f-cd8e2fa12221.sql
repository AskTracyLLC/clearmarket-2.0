-- Allow staff to update territory assignments (for mimic mode testing)
CREATE POLICY "Staff can update all territory assignments" 
ON public.territory_assignments 
FOR UPDATE 
USING (is_staff_user(auth.uid()));

-- Allow staff to read all conversations (for mimic mode)
CREATE POLICY "Staff can read all conversations" 
ON public.conversations 
FOR SELECT 
USING (is_staff_user(auth.uid()));

-- Allow staff to read all messages (for mimic mode)
CREATE POLICY "Staff can read all messages" 
ON public.messages 
FOR SELECT 
USING (is_staff_user(auth.uid()));

-- Allow staff to read all vendor_connections (for mimic mode)
CREATE POLICY "Staff can read all vendor connections" 
ON public.vendor_connections 
FOR SELECT 
USING (is_staff_user(auth.uid()));