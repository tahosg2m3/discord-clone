const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');

// GET /api/servers - Kullanıcının üye olduğu sunucuları getir
router.get('/', (req, res) => {
  const { userId } = req.query;
  const allServers = storage.getAllServers();

  if (userId) {
    const userServers = allServers.filter(server => {
      const members = storage.serverMembers.get(server.id) || [];
      return members.includes(userId);
    });
    return res.json(userServers);
  }
  res.json([]);
});

// GET /api/servers/:id - Sunucu detayı
router.get('/:id', (req, res) => {
  const server = storage.getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(server);
});

// YENİ: GET /api/servers/:id/members - Sunucunun tüm üyelerini (durumlarıyla) getir
router.get('/:id/members', (req, res) => {
  const members = storage.getServerMembers(req.params.id);
  // Her üyenin online durumunu da ekle
  const membersWithStatus = members.map(m => ({
    ...m,
    status: storage.getUserStatus(m.id)
  }));
  res.json(membersWithStatus);
});

// POST /api/servers - Sunucu oluştur
router.post('/', (req, res) => {
  const { name, creatorId } = req.body;
  if (!name || !creatorId) return res.status(400).json({ error: 'Missing fields' });
  const server = storage.createServer(name, creatorId);
  res.status(201).json(server);
});

// POST /api/servers/join - Katıl
router.post('/join', (req, res) => {
  const { inviteCode, userId } = req.body;
  const server = storage.getServerByInviteCode(inviteCode);
  
  if (!server) return res.status(404).json({ error: 'Invalid invite code' });
  
  const members = storage.serverMembers.get(server.id) || [];
  if (members.includes(userId)) return res.status(400).json({ error: 'Already a member' });

  storage.addMemberToServer(server.id, userId);
  res.json(server);
});

// YENİ: POST /api/servers/:id/leave - Sunucudan ayrıl
router.post('/:id/leave', (req, res) => {
  const { userId } = req.body;
  const { id } = req.params;

  const server = storage.getServerById(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  // Kurucu ayrılamaz (veya sunucuyu silmesi gerekir, şimdilik engelleyelim)
  if (server.creatorId === userId) {
    return res.status(400).json({ error: 'Owner cannot leave server. Delete it instead.' });
  }

  storage.removeServerMember(id, userId);
  res.json({ message: 'Left server successfully' });
});

// DELETE /api/servers/:id - Sil
router.delete('/:id', (req, res) => {
  if (storage.deleteServer(req.params.id)) {
    res.json({ message: 'Deleted' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

module.exports = router;