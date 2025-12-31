const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');

// POST /api/users/login - Simple username login
router.post('/login', (req, res) => {
  const { username } = req.body;
  
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username required' });
  }

  let user = storage.getUserByUsername(username.trim());
  
  if (!user) {
    user = storage.createUser(username.trim());
  }

  res.json(user);
});

// GET /api/users - Get all users
router.get('/', (req, res) => {
  const users = storage.getAllUsers();
  res.json(users);
});

module.exports = router;