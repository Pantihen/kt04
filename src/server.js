const app = require('./app');
const { port, prisma } = require('./config');

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
