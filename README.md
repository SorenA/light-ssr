# Light SSR

Server side rendering using headless Chrome and Puppeteer.

Inspired by [Rendertron](https://github.com/GoogleChrome/rendertron).

## Render endpoint

The render endpoint is located at `/render`, and takes the request url either from query string or request headers.

### Headers

The supported request headers are:

```env
X-Forwarded-Host: example.com
X-Forwarded-Port: 80
X-Forwarded-Proto: http
X-Replaced-Path: /about-us
```

Which would result in a render of `http://example.com:80/about-us`.

A matching Traefik ingress route example is located in the `k8s` directory.

### Query string

The request url may be set using the following query string: `?url=http://example.com/about-us`

If both headers and query string options are provided, the query string will be used.

## Health endpoint

A health endpoint is located at `/health`

## Configuration

Configuration is done through environment variables, in development the .env file can be used.

Defaults for environment variables:

```env
RENDER_TIMEOUT=10000
RENDER_HEIGHT=1920
RENDER_WIDTH=1080
RENDER_QUERY_STRING_APPEND_SSR=true
RENDER_ORIGIN_WHITELIST=
```

`RENDER_TIMEOUT` is render timeout in milliseconds.  
`RENDER_QUERY_STRING_APPEND_SSR` is whether to append the `ssr=true` parameter to the query string.
`RENDER_ORIGIN_WHITELIST` should be provided as CSV.

Origin port is required if targeting non-standard ports such as http other than port 80 and https other than port 443.

## Response parsing

The render will return the same HTTP status code as the origin, it may however be overriden using a meta tag:

```html
<meta name="render:status_code" content="200">
```

JavaScript will be stripped from the response to prevent further processing in the client side.

## SSR identification at origin

The renderer will pass `ssr=true` in the query string to enable different responses for renders.

This may be used to disable cookie pop-ups, trackings scripts etc.

## Security

Due to the security issues created by allowing an open proxy into ones network, the application requires origins to be whitelisted before they are rendered.

All requests not matching the whitelist are rejected.

## Development

Create an environment file from the default one:

```bash
cp .env.example .env
```

Install dependencies using `npm ci`.

Run local version using `npm run dev`.

### Built with NodeJS packages

- [dotenv](https://github.com/motdotla/dotenv)
- [Puppeteer](https://github.com/puppeteer/puppeteer)
- [Koa](https://github.com/koajs/koa)

