const express = require('express');
const { db, getPosts } = require('../db');

const router = express.Router();

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  const users = db
    .prepare('SELECT username, bio FROM users WHERE username LIKE ? ORDER BY username LIMIT 20')
    .all(`%${q}%`);
  res.json(users);
});

router.put('/me', (req, res) => {
  const bio = String(req.body.bio || '').trim();
  if (bio.length > 160) return res.status(400).json({ error: 'Bio must be 160 characters or less.' });
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.user.id);
  res.json({ bio });
});

router.get('/:username', (req, res) => {
  const user = db
    .prepare('SELECT id, username, bio, created_at FROM users WHERE username = ?')
    .get(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const count = (sql) => db.prepare(sql).get(user.id).n;
  res.json({
    username: user.username,
    bio: user.bio,
    created_at: user.created_at,
    followers: count('SELECT COUNT(*) AS n FROM follows WHERE following_id = ?'),
    following: count('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?'),
    post_count: count('SELECT COUNT(*) AS n FROM posts WHERE user_id = ?'),
    is_me: user.id === req.user.id,
    is_following: !!db
      .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
      .get(req.user.id, user.id),
    posts: getPosts(req.user.id, 'p.user_id = ?', [user.id]),
  });
});

router.post('/:username/follow', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: "You can't follow yourself." });

  const existing = db
    .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(req.user.id, target.id);

  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
  } else {
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target.id);
  }
  const followers = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE following_id = ?').get(target.id).n;
  res.json({ is_following: !existing, followers });
});

module.exports = router;
