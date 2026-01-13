const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');

// GÜNCELLENDİ: Sadece kullanıcının üye olduğu sunucuları getir
router.get('/', (req, res) => {
  const { userId } = req.query; // Frontend'den gelen userId
  
  const allServers = storage.getAllServers();

  if (userId) {
    // Sadece kullanıcının üye olduğu sunucuları filtrele
    const userServers = allServers.filter(server => 
      server.members && server.members.includes(userId)
    );
    return res.json(userServers);
  }

  // userId yoksa boş liste veya hepsi (güvenlik için boş dönmek daha iyi)
  res.json([]);
});

// GET /api/servers/:id
router.get('/:id', (req, res) => {
  const server = storage.getServerById(req.params.id);
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  res.json(server);
});

// POST /api/servers - Sunucu oluştur
router.post('/', (req, res) => {
  const { name, creatorId } = req.body;
  
  if (!name || !creatorId) {
    return res.status(400).json({ error: 'Name and creatorId required' });
  }

  const server = storage.createServer(name, creatorId);
  res.status(201).json(server);
});

// POST /api/servers/join
router.post('/join', (req, res) => {
  const { inviteCode, userId } = req.body;

  if (!inviteCode || !userId) {
    return res.status(400).json({ error: 'Invite code and userId required' });
  }

  const server = storage.getServerByInviteCode(inviteCode);
  
  if (!server) {
    return res.status(404).json({ error: 'Invalid invite code' });
  }

  if (server.members && server.members.includes(userId)) {
    return res.status(400).json({ error: 'You are already a member of this server' });
  }

  storage.addMemberToServer(server.id, userId);
  res.json(server);
});

// DELETE /api/servers/:id
router.delete('/:id', (req, res) => {
  const deleted = storage.deleteServer(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Server not found' });
  }
  res.json({ message: 'Server deleted' });
});

module.exports = router;