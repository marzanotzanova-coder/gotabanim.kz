-- Supabase SQL Editor-де іске қосыңыз
-- materials кестесіне slides_urls JSONB бағанасын қосу

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS slides_urls JSONB DEFAULT '[]'::jsonb;
