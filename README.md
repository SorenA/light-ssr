# Light SSR

Server side rendering using headless Chrome and Puppeteer.

Inspired by [Rendertron](https://github.com/GoogleChrome/rendertron).

## Configuration

## Response parsing

The render will return the same HTTP status code as the origin, it may however be overriden using a meta tag:

```html
<meta name="render:status_code" content="200">
```

JavaScript will be stripped from the response to prevent further processing in the client side.

## SSR identification at origin

The renderer will pass `ssr=true` in the query string to enable different responses for renders.

This may be used to disable cookie pop-ups, trackings scripts etc.
