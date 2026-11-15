import { buildApp } from './app.js';

const registrationToken = process.env.SITEFLEET_REGISTRATION_TOKEN;
if (!registrationToken) throw new Error('SITEFLEET_REGISTRATION_TOKEN is required');
const app = buildApp({ registrationToken });
const port = Number(process.env.PORT ?? 3001);

await app.listen({ port, host: '0.0.0.0' });
