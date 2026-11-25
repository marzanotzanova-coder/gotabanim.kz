// Lessons offered free on the dashboard and in the catalog (slides and ҚМЖ with the GoTAB watermark,
// the first 15 s of the animation with sound). Only lessons whose slide previews were checked by eye
// and show their diagrams cleanly are listed. Format: 'subject:grade:lesson_num'.
// Checked 2026-11-25: of the newest lessons with an animation, only these two showed their diagrams.
window.GOTAB_FREE_LESSONS = [
  'algebra:8:12',  // Квадрат үшмүше
  'algebra:9:12'   // Арифметикалық және геометриялық прогрессиялар
];
window.isGotabFreeLesson = (subject, grade, lessonNum) => window.GOTAB_FREE_LESSONS.includes(`${subject}:${grade}:${lessonNum}`);
