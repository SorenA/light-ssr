import Koa from 'koa';
import KoaCompress from 'koa-compress';
import KoaBodyParser from 'koa-bodyparser';
import KoaLogger from 'koa-logger';
import KoaRoute from 'koa-route';
import { RenderWorker } from './render-worker';

/**
 * Configuration - Render
 */
const renderTimeout = +(process.env.RENDER_TIMEOUT || 10000);
const renderHeight = +(process.env.RENDER_HEIGHT || 1920);
const renderWidth = +(process.env.RENDER_WIDTH || 1080);
const renderQueryStringAppendSsr = 'RENDER_QUERY_STRING_APPEND_SSR' in process.env ? process.env.RENDER_QUERY_STRING_APPEND_SSR == 'true' : true;
const renderOriginWhitelist = (process.env.RENDER_ORIGIN_WHITELIST || '').split(',');

const koaHostname = '0.0.0.0';
const koaPort = 3000;

/**
 * Error handling
 */
process.on('uncaughtException', (error: Error) => {
  console.error('Fatal error: Uncaught exception');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (error: Error) => {
  console.error('Fatal error: Unhandled rejection');
  console.error(error);
  process.exit(1);
});

/**
 * Render Worker
 */
const renderWorker = new RenderWorker(renderTimeout, renderHeight, renderWidth, renderQueryStringAppendSsr);
renderWorker.initialize();

// Start browser processes recyling timer
let lastRenderRequestTimestamp: Date = new Date();
setInterval(async () => {
  // Check if last request came over 30 seconds ago
  const thresMs = 30*1000; // 30 seconds
  if (new Date().getTime() - lastRenderRequestTimestamp.getTime() < thresMs) {
    console.log(`Skipped browser recycle, renderer used within ${thresMs/1000} seconds`);
    return;
  }

  // Recycle browser
  await renderWorker.recycleBrowser();
}, 5*60*1000); // Run every 5 minutes

/**
 * Koa
 */
const app = new Koa();

// Enable middlewares
app.use(KoaLogger());
app.use(KoaCompress());
app.use(KoaBodyParser());

// Register healthcheck route
app.use(KoaRoute.get('/health', (ctx: Koa.Context) => {
  if (!renderWorker.isReady()) {
    ctx.status = 500;
  } else {
    ctx.body = 'OK';
  }
}));

// Register render route
app.use(KoaRoute.get('/render', async (ctx: Koa.Context) => {
  lastRenderRequestTimestamp = new Date();

  if (!renderWorker.isReady()) {
    throw new Error('Render worker not ready yet.');
  }

  let url: string | null = null;
  if ('x-forwarded-host' in ctx.headers) {
    // Read from proxy headers
    const host = ctx.headers['x-forwarded-host'];
    const protocol = ctx.headers['x-forwarded-proto'] || 'https';
    const port = ctx.headers['x-forwarded-port'] || '80';
    const path = ctx.headers['x-replaced-path'] || '/';
    url = `${protocol}://${host}:${port}${path}`;
  }

  if ('url' in ctx.query) {
    // Read from querystring
    url = ctx.query.url;
  }

  if (url === null) {
    ctx.status = 400;
    ctx.body = 'No url provided.';
    return;
  }

  const isMobile = 'mobile' in ctx.query ? true : false;

  const parsedUrl = new URL(url);
  if (renderOriginWhitelist.indexOf(parsedUrl.host) === -1) {
    // Origin not whitelisted
    ctx.status = 400;
    ctx.body = 'Origin not allowed.';
    console.log(`Request rejected: Origin not allowed: ${parsedUrl.host}`);
    return;
  }

  // Render url
  const renderResult = await renderWorker.render(url, isMobile);

  // Add result headers, status code and content
  renderResult.headers.forEach((v: string, k: string) => ctx.set(k, v));
  ctx.status = renderResult.statusCode;
  ctx.body = renderResult.content;
}));

// Start Koa
app.listen(koaPort, koaHostname, () => {
  console.log(`Started Light-SSR on ${koaHostname}:${koaPort}`);
  console.log(`Origin whitelist:`);
  renderOriginWhitelist.forEach((value: string) => console.log(`- ${value}`));
});
