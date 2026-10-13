<?php
/**
 * V.LIONOFF · загрузка курса из JSON в базу.
 *
 *   php tools/import_content.php content/course-creator.json
 *   php tools/import_content.php           # все файлы content/*.json
 *
 * Повторный запуск безопасен: курсы, блоки и уроки обновляются по slug,
 * прогресс учеников не трогается.
 */
declare(strict_types=1);
require_once __DIR__ . '/../core/db.php';

$files = array_slice($argv, 1);
if (!$files) { $files = glob(__DIR__ . '/../content/*.json') ?: []; }
// posts.json это лента, а не курс: обрабатывается отдельно и первым.
$files = array_values(array_filter($files, fn($f) => basename($f) !== 'posts.json'));
if (!$files) { fwrite(STDERR, "нет файлов курса\n"); exit(1); }

foreach ($files as $file) {
  $data = json_decode(file_get_contents($file), true);
  if (!$data || empty($data['slug'])) { fwrite(STDERR, "пропуск $file: не курс\n"); continue; }

  $course = [
    'slug' => $data['slug'], 'title' => $data['title'] ?? $data['slug'],
    'subtitle' => $data['subtitle'] ?? '', 'descr' => $data['descr'] ?? '',
    'cover' => $data['cover'] ?? '', 'accent' => $data['accent'] ?? '#7A5CFF',
    'access' => $data['access'] ?? 'free', 'price' => (int)($data['price'] ?? 0),
    'level' => $data['level'] ?? 'С нуля', 'duration' => $data['duration'] ?? '',
    'author' => $data['author'] ?? 'V.LIONOFF', 'cert' => (int)($data['cert'] ?? 1),
    'sort' => (int)($data['sort'] ?? 0), 'status' => $data['status'] ?? 'published',
  ];
  $row = vc_one('SELECT id FROM courses WHERE slug=?', [$course['slug']]);
  if ($row) { $courseId = (int)$row['id']; vc_update('courses', $course, 'id=?', [$courseId]); }
  else { $courseId = vc_insert('courses', $course); }

  $bs = 0; $ls = 0;
  foreach (($data['blocks'] ?? []) as $bi => $b) {
    $block = ['course_id' => $courseId, 'slug' => $b['slug'] ?? ('b' . ($bi + 1)),
              'title' => $b['title'] ?? '', 'descr' => $b['descr'] ?? '',
              'cover' => $b['cover'] ?? '', 'sort' => (int)($b['sort'] ?? $bi)];
    $have = vc_one('SELECT id FROM blocks WHERE course_id=? AND slug=?', [$courseId, $block['slug']]);
    if ($have) { $blockId = (int)$have['id']; vc_update('blocks', $block, 'id=?', [$blockId]); }
    else { $blockId = vc_insert('blocks', $block); }
    $bs++;

    foreach (($b['lessons'] ?? []) as $li => $l) {
      $lesson = [
        'block_id' => $blockId, 'course_id' => $courseId,
        'slug' => $l['slug'] ?? ($block['slug'] . '-' . ($li + 1)),
        'title' => $l['title'] ?? '', 'summary' => $l['summary'] ?? '',
        'minutes' => (int)($l['minutes'] ?? 7), 'xp' => (int)($l['xp'] ?? 10),
        'slides' => json_encode($l['slides'] ?? [], JSON_UNESCAPED_UNICODE),
        'notes' => $l['notes'] ?? '', 'practice' => $l['practice'] ?? '',
        'quiz' => json_encode($l['quiz'] ?? [], JSON_UNESCAPED_UNICODE),
        'audio' => $l['audio'] ?? '', 'video' => $l['video'] ?? '',
        'free' => (int)($l['free'] ?? 0), 'sort' => (int)($l['sort'] ?? $li),
        'status' => $l['status'] ?? 'published',
      ];
      $haveL = vc_one('SELECT id FROM lessons WHERE course_id=? AND slug=?', [$courseId, $lesson['slug']]);
      if ($haveL) { vc_update('lessons', $lesson, 'id=?', [$haveL['id']]); }
      else { vc_insert('lessons', $lesson); }
      $ls++;
    }
  }
  printf("%s: курс «%s», блоков %d, уроков %d\n", basename($file), $course['title'], $bs, $ls);
}

// Лента: тексты лежат в content/posts.json и обновляются по заголовку.
$лента = __DIR__ . '/../content/posts.json';
if (is_file($лента)) {
  $д = json_decode(file_get_contents($лента), true) ?: [];
  foreach (($д['posts'] ?? []) as $пост) {
    $есть = vc_one('SELECT id FROM posts WHERE title=?', [$пост['title']]);
    $поле = ['title' => $пост['title'], 'text' => $пост['text'] ?? '',
             'cover' => $пост['cover'] ?? '', 'link' => $пост['link'] ?? '',
             'pinned' => (int)($пост['pinned'] ?? 0), 'status' => 'published'];
    if ($есть) { vc_update('posts', $поле, 'id=?', [$есть['id']]); }
    else { vc_insert('posts', $поле); }
  }
  printf("лента: %d записей\n", count($д['posts'] ?? []));
}
// Старая запись первой сборки, когда бренд ещё звался иначе.
vc_q("DELETE FROM posts WHERE title='V.CODE открылся' OR title='V.LIONOFF открылся'");

echo "готово\n";
