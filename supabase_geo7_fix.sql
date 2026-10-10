-- 7-сынып геометриясын тазалау
-- Үшбұрыш жолын (lesson_num=1) жою
DELETE FROM public.materials
WHERE grade = 7 AND subject = 'geometry' AND lesson_num = 1;

-- Сыбайлас жолын lesson_num=2-ден 1-ге жылжыту
UPDATE public.materials
SET lesson_num = 1
WHERE grade = 7 AND subject = 'geometry' AND lesson_num = 2;

-- Артық жолдарды (3, 4) жою
DELETE FROM public.materials
WHERE grade = 7 AND subject = 'geometry' AND lesson_num >= 2;
