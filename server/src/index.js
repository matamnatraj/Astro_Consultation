import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { attachRealtime } from './realtime/server.js';
import { startScheduler } from './jobs/scheduler.js';
import { migrate } from './db/migrate.js';

await migrate();
const server = http.createServer(createApp());
attachRealtime(server);
if (config.jobsEnabled) startScheduler();
server.listen(config.port, () => console.log(`API listening on :${config.port} (${config.env})`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
