import app from './app.js';
import config from './config/index.js';

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   JubileeSearch.com                           ║
  ║   Dark-themed Bible & Content Search          ║
  ║                                               ║
  ║   Server running on port ${PORT}                ║
  ║   http://localhost:${PORT}                      ║
  ║                                               ║
  ║   Environment: ${config.nodeEnv.padEnd(27)}║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forcing shutdown...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default server;
