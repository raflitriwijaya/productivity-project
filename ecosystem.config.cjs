module.exports = {
  apps: [
    {
      name: 'productivity-api',
      script: './server/index.js',
      cwd: '/var/www/productivity',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/productivity-error.log',
      out_file: '/var/log/pm2/productivity-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
