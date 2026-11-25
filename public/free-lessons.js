// Free preview lessons: slides and ҚМЖ with the GoTAB watermark, the first 15 s of the animation.
// Only lessons whose slides render cleanly and that have a video.
window.GOTAB_FREE_LESSONS = [
  'math:5:9',            // Жай бөлшектерді қосу және азайту
  'math:6:8',            // Рационал сандарды бөлу
  'algebra:7:6',         // Сызықтық функция және оның графигі
  'geometry:7:9',        // Үшбұрыштар теңдігінің белгілері
  'algebra:8:2',         // Квадрат түбір функциясы
  'geometry:8:5',        // Пифагор теоремасы
  'algebra:9:12',        // Арифметикалық және геометриялық прогрессиялар
  'geometry:9:6',        // Гомотетия және оның қасиеттері
  'algebra:10:1',        // Кері тригонометриялық функциялар
  'geometry:10:1',       // Екі жазықтықтың өзара орналасуы
  'geometry_emn:10:1'    // Кеңістіктегі арақашықтықтар
];
window.isGotabFreeLesson = (subject, grade, lessonNum) => window.GOTAB_FREE_LESSONS.includes(`${subject}:${grade}:${lessonNum}`);
