const fs = require('fs');
const dotenv = require('/opt/tahosapp/current/node_modules/dotenv');

Object.assign(
  process.env,
  dotenv.parse(fs.readFileSync('/etc/tahosapp/tahosapp.env')),
  dotenv.parse(fs.readFileSync('/etc/tahosapp/smtp.env')),
);

const { createTransporter } = require('/opt/tahosapp/current/src/services/emailService');

createTransporter()
  .verify()
  .then(() => console.log('SMTP verification: OK'))
  .catch((error) => {
    console.error('SMTP verification failed:', error.message);
    process.exitCode = 1;
  });
