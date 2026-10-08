-- 1. Блок колонкасы қосу
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- 2. Пайдаланушыны блоктау функциясы
CREATE OR REPLACE FUNCTION public.ban_user(uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    is_banned = true,
    is_paid   = false,
    paid_until = null
  WHERE id = uid;
END;
$$;

-- 3. Блокты алу функциясы
CREATE OR REPLACE FUNCTION public.unban_user(uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET is_banned = false WHERE id = uid;
END;
$$;

-- 4. get_all_profiles жаңарту (is_banned қосамыз)
DROP FUNCTION IF EXISTS public.get_all_profiles();
CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS TABLE(id UUID, name TEXT, phone TEXT, email TEXT, is_admin BOOLEAN,
              created_at TIMESTAMPTZ, is_paid BOOLEAN, paid_until TIMESTAMPTZ, is_banned BOOLEAN)
LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, phone, email, is_admin, created_at, is_paid, paid_until, is_banned
  FROM public.profiles ORDER BY created_at DESC;
$$;
