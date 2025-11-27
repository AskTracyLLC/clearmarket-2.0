-- Allow all authenticated users to read rep coverage areas for matching
CREATE POLICY "Authenticated users can view rep coverage for matching"
ON public.rep_coverage_areas
FOR SELECT
TO authenticated
USING (true);