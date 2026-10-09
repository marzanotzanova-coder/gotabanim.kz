-- Add thumbnail URL columns to materials table
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS ppt_thumb_url text,
  ADD COLUMN IF NOT EXISTS qmj_thumb_url text;
