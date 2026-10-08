-- 1. Private bucket жасау
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('slide-previews', 'slide-previews', false, 5242880)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Аутентификацияланған пайдаланушы объектілерді ОҚЫЙ алады (signed URL үшін)
DROP POLICY IF EXISTS "auth_read_slides" ON storage.objects;
CREATE POLICY "auth_read_slides" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'slide-previews');

-- 3. Тек service role жүктей алады (INSERT) — бұл автоматты, policy қажет емес
