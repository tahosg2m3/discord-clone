const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');

router.get('/', (req, res) => {
  const { userId } = req.query;
  
  // Sadece isDM olmayan (yani gerçek) sunucuları listele
  const allServers = storage.getAllServers().filter(s => !s.isDM);

  if (userId) {
    const userServers = allServers.filter(server => {
      const members = storage.serverMembers.get(server.id) || [];
      return members.includes(userId);
    });
    return res.json(userServers);
  }
  res.json([]);
});

router.get('/:id', (req, res) => {
  const server = storage.getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: 'Not found' });
  res.json(server);
});

router.get('/:id/members', (req, res) => {
  const members = storage.getServerMembers(req.params.id);
  const withStatus = members.map(m => ({ ...m, status: storage.getUserStatus(m.id) }));
  res.json(withStatus);
});

router.post('/', (req, res) => {
  const { name, creatorId } = req.body;
  const server = storage.createServer(name, creatorId);
  res.status(201).json(server);
});

router.post('/join', (req, res) => {
  const { inviteCode, userId } = req.body;
  const server = storage.getServerByInviteCode(inviteCode);
  if (!server) return res.status(404).json({ error: 'Invalid code' });
  
  const members = storage.serverMembers.get(server.id) || [];
  if (members.includes(userId)) return res.status(400).json({ error: 'Already joined' });

  storage.addMemberToServer(server.id, userId);
  res.json(server);
});

router.patch('/:id', (req, res) => {
  const { name, userId } = req.body;
  const server = storage.getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: 'Not found' });
  if (server.creatorId !== userId) return res.status(403).json({ error: 'Unauthorized' });

  const updated = storage.updateServer(req.params.id, { name });
  res.json(updated);
});

router.post('/:id/leave', (req, res) => {
  const { userId } = req.body;
  const server = storage.getServerById(req.params.id);
  if (server.creatorId === userId) return res.status(400).json({ error: 'Owner cannot leave' });
  
  storage.removeServerMember(req.params.id, userId);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  if (storage.deleteServer(req.params.id)) res.json({ message: 'Deleted' });
  else res.status(404).json({ error: 'Not found' });
});

module.exports = router;