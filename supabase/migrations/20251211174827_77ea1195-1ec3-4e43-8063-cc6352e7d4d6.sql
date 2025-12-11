-- Add update/delete policies for non-admin users on pending requests
CREATE POLICY "Users can update their own pending requests"
ON public.tire_claim_requests
FOR UPDATE
USING (requested_by = auth.uid() AND status = 'pending')
WITH CHECK (requested_by = auth.uid() AND status = 'pending');

CREATE POLICY "Users can delete their own pending requests"
ON public.tire_claim_requests
FOR DELETE
USING (requested_by = auth.uid() AND status = 'pending');