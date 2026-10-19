-- GoTAB: Информатика пәні үшін бөлек төлем жүйесі
-- Supabase Dashboard → SQL Editor → New query → Run

-- 1. profiles кестесіне информатика төлем бағандарын қосу
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_paid_informatics BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_informatics_until TIMESTAMPTZ;

-- 2. payment_requests кестесіне пән бағанасын қосу
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'math';

-- 3. Информатика төлемін тексеру функциясы
CREATE OR REPLACE FUNCTION public.check_paid_informatics(check_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.is_paid_informatics
     FROM public.profiles p
     WHERE p.id = check_id
       AND p.is_paid_informatics = true
       AND (p.paid_informatics_until IS NULL OR p.paid_informatics_until > NOW())
     LIMIT 1),
    false
  );
$$;

-- 4. Информатика төлемін белсендіру функциясы
CREATE OR REPLACE FUNCTION public.approve_informatics_payment(req_id UUID, uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payment_requests SET status = 'approved' WHERE id = req_id;
  UPDATE public.profiles SET
    is_paid_informatics = true,
    paid_informatics_until = NOW() + INTERVAL '30 days'
  WHERE id = uid;
END;
$$;

-- 5. get_payment_requests функциясын subject қосып жаңарту
CREATE OR REPLACE FUNCTION public.get_payment_requests()
RETURNS TABLE(id UUID, user_id UUID, user_email TEXT, user_name TEXT, created_at TIMESTAMPTZ, status TEXT, subject TEXT)
LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT id, user_id, user_email, user_name, created_at, status, COALESCE(subject, 'math') as subject
  FROM public.payment_requests
  ORDER BY created_at DESC;
$$;

-- 6. get_all_profiles функциясын жаңарту
CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS TABLE(id UUID, name TEXT, phone TEXT, email TEXT, is_admin BOOLEAN, created_at TIMESTAMPTZ, is_paid BOOLEAN, paid_until TIMESTAMPTZ, is_banned BOOLEAN, is_paid_informatics BOOLEAN, paid_informatics_until TIMESTAMPTZ)
LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, phone, email, is_admin, created_at, is_paid, paid_until, is_banned,
         COALESCE(is_paid_informatics, false), paid_informatics_until
  FROM public.profiles
  ORDER BY created_at DESC;
$$;

-- 7. Рұқсаттар беру
GRANT EXECUTE ON FUNCTION public.check_paid_informatics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_paid_informatics(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.approve_informatics_payment(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_profiles() TO authenticated;

-- Тексеру
SELECT proname FROM pg_proc
WHERE proname IN ('check_paid_informatics','approve_informatics_payment','get_payment_requests','get_all_profiles');
