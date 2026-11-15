const express = require('express');
const { db, getPosts } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.query.scope === 'all') return res.json(getPosts(req.user.id));
  res.json(
    getPosts(
      req.user.id,
      'p.user_id = ? OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)',
      [req.user.id, req.user.id]
    )
  );
});

router.post('/', (req, res) => {
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Post cannot be empty.' });
  if (content.length > 280) return res.status(400).json({ error: 'Post must be 280 characters or less.' });

  const info = db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)').run(req.user.id, content);
  const [post] = getPosts(req.user.id, 'p.id = ?', [info.lastInsertRowid], 1);
  res.status(201).json(post);
});

router.delete('/:id', (req, res) => {
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts.' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/like', (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const existing = db
    .prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?')
    .get(req.user.id, post.id);
  if (existing) db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, post.id);
  else db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, post.id);

  const like_count = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?').get(post.id).n;
  res.json({ liked: !existing, like_count });
});

router.get('/:id/comments', (req, res) => {
  const comments = db
    .prepare(`
      SELECT c.id, c.content, c.created_at, u.username
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ? ORDER BY c.id ASC
    `)
    .all(req.params.id);
  res.json(comments);
});

router.post('/:id/comments', (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Comment cannot be empty.' });
  if (content.length > 200) return res.status(400).json({ error: 'Comment must be 200 characters or less.' });

  const info = db
    .prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)')
    .run(post.id, req.user.id, content);
  const comment = db
    .prepare(`
      SELECT c.id, c.content, c.created_at, u.username
      FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
    `)
    .get(info.lastInsertRowid);
  res.status(201).json(comment);
});

module.exports = router;