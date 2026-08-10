const storage = require('../storage/inMemory');

function resolveServerId(req) {
  return req.params.serverId || req.params.id || req.body?.serverId || null;
}

function requireServerMember(req, res, next) {
  const serverId = resolveServerId(req);
  const server = storage.getServerById(serverId);

  if (!server || server.isDM) {
    return res.status(404).json({ error: 'Sunucu bulunamadı.' });
  }

  if (!storage.isServerMember(serverId, req.user.id)) {
    return res.status(403).json({ error: 'Bu sunucuya erişim yetkin yok.' });
  }

  req.server = server;
  return next();
}

function requireServerOwner(req, res, next) {
  const serverId = resolveServerId(req);
  const server = storage.getServerById(serverId);

  if (!server || server.isDM) {
    return res.status(404).json({ error: 'Sunucu bulunamadı.' });
  }

  if (server.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'Bu işlem yalnızca sunucu sahibine açıktır.' });
  }

  req.server = server;
  return next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    const serverId = resolveServerId(req);
    const server = storage.getServerById(serverId);

    if (!server || server.isDM) {
      return res.status(404).json({ error: 'Sunucu bulunamadı.' });
    }

    if (!storage.isServerMember(serverId, req.user.id)) {
      return res.status(403).json({ error: 'Bu sunucuya erişim yetkin yok.' });
    }

    if (!storage.hasPermission(serverId, req.user.id, permission)) {
      return res.status(403).json({ error: 'Bu işlem için gerekli yetkin yok.' });
    }

    req.server = server;
    return next();
  };
}

module.exports = {
  resolveServerId,
  requireServerMember,
  requireServerOwner,
  requirePermission,
};
