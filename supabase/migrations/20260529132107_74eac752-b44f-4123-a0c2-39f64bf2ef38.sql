-- Allow invited users to read their own pending invitation by email
CREATE POLICY "Invitees can view their own invitation"
ON public.invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower(auth.jwt() ->> 'email') AND accepted_at IS NULL);