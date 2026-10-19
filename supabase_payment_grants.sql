-- GoTAB: RPC функцияларына рұқсат беру
-- Supabase Dashboard → SQL Editor → New query → Run

-- Барлық төлемге қатысты функцияларға authenticated пайдаланушылар кіре алатындай ету

GRANT EXECUTE ON FUNCTION public.check_paid_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_paid_user(UUID) TO anon;

GRANT EXECUTE ON FUNCTION public.check_my_subscription() TO authenticated;

GRANT EXECUTE ON FUNCTION public.approve_payment_request(UUID, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_user_paid(UUID, BOOLEAN) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_payment_requests() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_all_profiles() TO authenticated;

GRANT EXECUTE ON FUNCTION public.ban_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unban_user(UUID) TO authenticated;

-- Profiles кестесіне SELECT рұқсаты (SECURITY DEFINER функциялар үшін)
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;
GRANT UPDATE ON TABLE public.profiles TO authenticated;

-- Тексеру: функциялар бар ма?
SELECT proname, prosecdef FROM pg_proc
WHERE proname IN (
  'check_paid_user',
  'check_my_subscription',
  'approve_payment_request',
  'set_user_paid',
  'get_payment_requests',
  'get_all_profiles'
);
