const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username))
    return res.status(409).json({ error: 'Username already taken.' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  const user = { id: info.lastInsertRowid, username };
  res.status(201).json({ token: signToken(user), user: { username } });
});

router.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid username or password.' });

  res.json({ token: signToken(user), user: { username: user.username } });
});

module.exports = router;