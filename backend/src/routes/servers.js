const express = require('express');

const storage = require('../storage/inMemory');
const { requireAuth } = require('../middleware/auth');
const { requireServerMember, requireServerOwner } = require('../middleware/authorization');

const router = express.Router();

function notifyMembersChanged(req, serverId) {
  req.app.get('io')?.to(`server:${serverId}`).emit('server:members-changed', { serverId });
}

router.use(requireAuth);

// Sadece giriş yapan kullanıcının gerçekten üye olduğu normal sunucular gösterilir.
router.get('/', (req, res) => {
  const servers = storage.getAllServers().filter(server => (
    !server.isDM && storage.isServerMember(server.id, req.user.id)
  ));
  return res.json(servers);
});

router.post('/join', (req, res) => {
  const inviteCode = String(req.body.inviteCode || '').trim();
  const server = storage.getServerByInviteCode(inviteCode);
  if (!server || server.isDM) return res.status(404).json({ error: 'Geçersiz davet kodu.' });

  if (storage.isServerMember(server.id, req.user.id)) {
    return res.status(400).json({ error: 'Bu sunucuya zaten katıldın.' });
  }

  storage.addServerMember(server.id, req.user.id);
  // Kullanıcının açık tüm sekmelerini anında sunucunun Socket.IO odasına al.
  req.app.get('io')?.in(`user:${req.user.id}`).socketsJoin(`server:${server.id}`);
  notifyMembersChanged(req, server.id);
  return res.json(server);
});

router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ error: 'Geçerli bir sunucu adı gerekli.' });

  const server = storage.createServer(name, req.user.id);
  req.app.get('io')?.in(`user:${req.user.id}`).socketsJoin(`server:${server.id}`);
  return res.status(201).json(server);
});

router.post('/:id/transfer-ownership', requireServerOwner, (req, res) => {
  const newOwnerId = String(req.body.userId || '').trim();
  if (!newOwnerId || !storage.isServerMember(req.params.id, newOwnerId)) {
    return res.status(400).json({ error: 'Yeni sahip sunucunun bir üyesi olmalıdır.' });
  }

  const updated = storage.transferServerOwnership(req.params.id, newOwnerId);
  notifyMembersChanged(req, req.params.id);
  req.app.get('io')?.to(`server:${req.params.id}`).emit('server:updated', { server: updated });
  return res.json(updated);
});

router.get('/:id/members', requireServerMember, (req, res) => (
  res.json(storage.getServerMembersWithDetails(req.params.id))
));

router.get('/:id', requireServerMember, (req, res) => res.json(req.server));

router.patch('/:id', requireServerOwner, (req, res) => {
  const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
  if (name !== undefined && (!name || name.length > 100)) {
    return res.status(400).json({ error: 'Geçerli bir sunucu adı gerekli.' });
  }

  const updated = storage.updateServer(req.params.id, {
    name,
    icon: req.body.icon,
  });
  req.app.get('io')?.to(`server:${req.params.id}`).emit('server:updated', { server: updated });
  return res.json(updated);
});

router.post('/:id/leave', requireServerMember, (req, res) => {
  if (req.server.creatorId === req.user.id) {
    return res.status(400).json({ error: 'Sunucu sahibi sunucudan ayrılamaz. Önce sahipliği devret.' });
  }

  storage.removeServerMember(req.params.id, req.user.id);
  req.app.get('io')?.in(`user:${req.user.id}`).socketsLeave(`server:${req.params.id}`);
  notifyMembersChanged(req, req.params.id);
  return res.json({ success: true });
});

router.delete('/:id', requireServerOwner, (req, res) => {
  const serverId = req.params.id;
  if (!storage.deleteServer(serverId)) return res.status(404).json({ error: 'Sunucu bulunamadı.' });

  req.app.get('io')?.to(`server:${serverId}`).emit('server:deleted', { serverId });
  return res.json({ message: 'Sunucu silindi.' });
});

module.exports = router;
