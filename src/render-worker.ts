import Puppeteer from 'puppeteer';
import { IRenderResult } from './models/render-result.interface';
import { dirname } from 'path';

export class RenderWorker {
  private timeout: number;
  private height: number;
  private width: number;
  private puppeteerArg: string[] = [
    '--no-sandbox',
  ];

  private puppeteerBrowser: Puppeteer.Browser | null = null;

  /**
   * @param timeout Render timeout in milliseconds
   * @param height Render screen height
   * @param width  Render screen width
   */
  constructor(timeout: number, height: number, width: number) {
    this.timeout = timeout;
    this.height = height;
    this.width = width;
  }

  public isReady(): boolean {
    return this.puppeteerBrowser !== undefined && this.puppeteerBrowser !== null;
  }

  /**
   * Initialize Render worker
   */
  public async initialize(): Promise<void> {
    await this.startBrowser();
  }

  /**
   * Render URL
   * @param url URL to render
   * @param isMobile Whether to render as mobile or not
   */
  public async render(url: string, isMobile: boolean): Promise<IRenderResult> {
    if (this.puppeteerBrowser === null) {
      throw new Error('Render worker not ready yet.');
    }

    const parsedUrl = new URL(url);

    // Append SSR to query string to allow origin to differ response for rendering
    url += url.indexOf('?') === -1
    ? '?ssr=true'
    : '&ssr=true';

    // Open new page and set viewport
    const puppeteerPage = await this.puppeteerBrowser.newPage();
    puppeteerPage.setViewport({
      width: this.width,
      height: this.height,
      isMobile,
    });

    // Render page
    let puppeteerResponse: Puppeteer.Response | null = null;
    try {
      puppeteerResponse = await puppeteerPage.goto(url, {
        timeout: this.timeout,
        waitUntil: 'networkidle0',
      });
    } catch (ex) {
      console.error(ex);
    }

    // Check for invalid responses
    if (!puppeteerResponse) {
      console.error('No valid response');
      await puppeteerPage.close();
      return {
        statusCode: 400,
        headers: new Map<string, string>(),
        content: ''
      };
    }

    // Read status code from response
    let statusCode = puppeteerResponse.status();
    if (statusCode === 304) {
      // Remap not modified to 200
      statusCode = 200;
    }

    // Read status code from response markup if status code 200
    if (statusCode === 200) {
      const markupStatusCode =
        await puppeteerPage
          .$eval('meta[name="render:status_code"]', (element) => parseInt(element.getAttribute('content') || '', 10))
          .catch(() => undefined);

      if (markupStatusCode) {
        statusCode = markupStatusCode;
      }
    }

    // Strip JavaScript and imports from page
    await puppeteerPage.evaluate(() => {
      const elements = document.querySelectorAll('script:not([type]), script[type*="javascript"], script[type="module"], link[rel=import]');
      for (const element of Array.from(elements)) {
        element.remove();
      }
    });

    // Inject <base> tag with the origin of the request (ie. no path).
    await puppeteerPage.evaluate((origin: string) => {
      const baseArr = document.head.querySelectorAll('base');
      if (baseArr.length) {
        // Append to existing <base> if relative
        const existingBase = baseArr[0].getAttribute('href') || '';
        if (existingBase.startsWith('/')) {
          baseArr[0].setAttribute('href', origin + existingBase);
        }
      } else {
        // Inject <base> as it doesn't exist
        const base = document.createElement('base');
        base.setAttribute('href', origin);
        document.head.insertAdjacentElement('afterbegin', base);
      }
    }, `${parsedUrl.protocol}//${parsedUrl.host}${dirname(parsedUrl.pathname || '')}`);

    const headers = new Map<string, string>();
    headers.set('X-Renderer', 'Light-SSR');

    const content = await puppeteerPage.content();
    await puppeteerPage.close();

    return {
      statusCode,
      headers,
      content,
    };
  }

  /**
   * Start Puppeteer browser
   */
  private async startBrowser(): Promise<void> {
    this.puppeteerBrowser = await Puppeteer.launch({ args: this.puppeteerArg });

    // Restart on browser closed
    this.puppeteerBrowser.on('disconnected', () => {
      this.startBrowser();
    });
  }
}
