-- Supabase SQL Editor-де осыны іске қосыңыз
-- (gotabanim-kz жобасы → SQL Editor)

-- 1. profiles кестесіне is_paid және paid_until қосу
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ;

-- 2. Төлем сұраныстары кестесі
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending'
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_request" ON public.payment_requests;
CREATE POLICY "insert_own_request" ON public.payment_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_request" ON public.payment_requests;
CREATE POLICY "select_own_request" ON public.payment_requests
  FOR SELECT USING (auth.uid() = user_id);

-- 3. get_all_profiles-ты is_paid + paid_until қосып жаңарту
CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS TABLE(id UUID, name TEXT, phone TEXT, email TEXT, is_admin BOOLEAN, created_at TIMESTAMPTZ, is_paid BOOLEAN, paid_until TIMESTAMPTZ)
LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, phone, email, is_admin, created_at, is_paid, paid_until
  FROM public.profiles
  ORDER BY created_at DESC;
$$;

-- 4. set_user_paid — 30 күн мерзім қою
CREATE OR REPLACE FUNCTION public.set_user_paid(user_id UUID, paid BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    is_paid = paid,
    paid_until = CASE WHEN paid THEN NOW() + INTERVAL '30 days' ELSE NULL END
  WHERE id = user_id;
END;
$$;

-- 5. Барлық сұраныстарды алу (админ үшін)
CREATE OR REPLACE FUNCTION public.get_payment_requests()
RETURNS TABLE(id UUID, user_id UUID, user_email TEXT, user_name TEXT, created_at TIMESTAMPTZ, status TEXT)
LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT id, user_id, user_email, user_name, created_at, status
  FROM public.payment_requests
  ORDER BY created_at DESC;
$$;

-- 6. Сұранысты белсендіру (admin action)
CREATE OR REPLACE FUNCTION public.approve_payment_request(req_id UUID, uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payment_requests SET status = 'approved' WHERE id = req_id;
  UPDATE public.profiles SET
    is_paid = true,
    paid_until = NOW() + INTERVAL '30 days'
  WHERE id = uid;
END;
$$;
