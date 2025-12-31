const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');

// GET /api/servers - Get all servers
router.get('/', (req, res) => {
  const servers = storage.getAllServers();
  res.json(servers);
});

// GET /api/servers/:id - Get server by ID
router.get('/:id', (req, res) => {
  const server = storage.getServerById(req.params.id);
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  res.json(server);
});

// POST /api/servers - Create new server
router.post('/', (req, res) => {
  const { name } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Server name required' });
  }

  const server = storage.createServer(name.trim());
  res.status(201).json(server);
});

// DELETE /api/servers/:id - Delete server
router.delete('/:id', (req, res) => {
  const deleted = storage.deleteServer(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Server not found' });
  }
  res.json({ message: 'Server deleted' });
});

module.exports = router;
