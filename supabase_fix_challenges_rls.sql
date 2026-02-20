-- Enable deleting challenges for the creator
CREATE POLICY "Users can delete their own challenges" ON public.challenges
    FOR DELETE
    USING (auth.uid() = creator_id);
    
-- Note: When a challenge is deleted, because of ON DELETE CASCADE (if configured)
-- it should also delete the participants in `challenge_participants` automatically.
-- If no CASCADE is configured, you might need to drop dependent rows first:

-- Alternatively, add a policy to allow deletion of challenge_participants:
CREATE POLICY "Users can delete challenge participation" ON public.challenge_participants
    FOR DELETE
    USING (
      auth.uid() = user_id 
      OR 
      auth.uid() IN (SELECT creator_id FROM public.challenges WHERE id = challenge_id)
    );
