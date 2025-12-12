-- Create atomic credit deduction function to prevent race conditions
CREATE OR REPLACE FUNCTION public.deduct_credit_for_post(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_credits integer;
BEGIN
  -- Lock the row and get current credits
  SELECT credits INTO v_current_credits
  FROM public.user_wallet
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_current_credits IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_current_credits < p_amount THEN
    RETURN false;
  END IF;
  
  -- Atomic decrement
  UPDATE public.user_wallet
  SET credits = credits - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$$;