/**
 * Vercel serverless entry point for the RR7 application.
 *
 * Mirrors `server/main.js` (the self-hosted Node entry) without the Node static file server,
 * because Vercel serves `build/client` directly. Every request that is not a static file is
 * rewritten here by `vercel.json`.
 *
 * Note:
 *  The imports resolve against the build output, so this file only works after `npm run build`.
 */
import handle from 'hono-react-router-adapter/node';

import { getLoadContext } from '../build/server/hono/server/load-context.js';
import server from '../build/server/hono/server/router.js';
import * as build from '../build/server/index.js';

const handler = handle(build, server, { getLoadContext });

export default {
  fetch: handler.fetch,
};
