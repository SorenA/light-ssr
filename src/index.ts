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
const renderHeight = +(process.env.RENDER_HEIGHT || 1024);
const renderWidth = +(process.env.RENDER_WIDTH || 1280);
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
const renderWorker = new RenderWorker(renderTimeout, renderHeight, renderWidth);
renderWorker.initialize();

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
  if (!renderWorker.isReady()) {
    throw new Error('Render worker not ready yet.');
  }

  if (!('url' in ctx.query)) {
    throw new Error('No url provided.');
  }

  const url = ctx.query.url;
  const isMobile = 'mobile' in ctx.query ? true : false;

  const parsedUrl = new URL(url);
  if (renderOriginWhitelist.indexOf(parsedUrl.host) === -1) {
    // Origin not whitelisted
    ctx.status = 400;
    ctx.body = 'Origin not allowed.';
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
