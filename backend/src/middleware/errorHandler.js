module.exports = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  console.error('Request failed:', isDevelopment ? err : err?.message || 'Internal server error');

  const multerMessages = {
    LIMIT_FILE_SIZE: 'Dosya en fazla 10 MB olabilir.',
    LIMIT_FILE_COUNT: 'Aynı anda yalnızca bir dosya yüklenebilir.',
    LIMIT_UNEXPECTED_FILE: 'Dosya alanı veya dosya türü geçersiz.',
    LIMIT_PART_COUNT: 'Yükleme isteği çok fazla bölüm içeriyor.',
  };
  const isMulterError = err?.name === 'MulterError';
  const requestedStatus = Number(err?.status || err?.statusCode);
  const status = isMulterError
    ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
    : (Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus < 500 ? requestedStatus : 500);
  const message = isMulterError
    ? (multerMessages[err.code] || 'Dosya yükleme isteği geçersiz.')
    : (status < 500 ? String(err.message || 'İstek geçersiz.') : 'Sunucuda beklenmeyen bir hata oluştu.');

  res.status(status).json({
    error: message,
    ...(isDevelopment && { stack: err.stack }),
  });
};
