const puppeteer = require("puppeteer")
const CryptoJs = require("crypto-js")
const EventEmitter = require("events").EventEmitter
const fs = require("fs")
const path = require("path")
const Readability = fs.readFileSync(
  path.resolve(__dirname, "./node_modules/@mozilla/readability/Readability.js"),
  { encoding: 'utf-8' }
);

function getUrls(text) {
  const results = text.match(/(https?:\/\/[^\s|\]|)]+)/g)
  return results || [];
}

const executor = `
  (function() {
    ${Readability}
    function executor() {
      return new Readability({}, document).parse();
    }
  return executor();
  }())
`

class NightCrawler extends EventEmitter {
  constructor({ urls = [], baseUrl, skipUrls }) {
    super();
    this.queue = new Set(urls)
    this.keepTheFlame = this.keepTheFlame.bind(this);
    this.nightWatch = setInterval(this.keepTheFlame, 4000)
    this.keepTheFlame();
    this.baseUrl = baseUrl
    this.skipUrls = skipUrls
    this.browser = puppeteer.launch({ headless: true });
  }

  keepTheFlame() {
    if (this.currentUrl) {
      return;
    }

    this.crawl();
  }

  async crawl() {
    const link = [...this.queue]?.[0] || {}
    const { url, id, file } = link
    if (!id) {
      this.emit("finished")
      return;
    }
    this.currentUrl = id;
    let screenshot = `${this.baseUrl}/_images/${id}.jpg`
    try {
      let browser = await this.browser;
      let page = await browser.newPage();
      await page.goto(url);
      await page.screenshot({ path: screenshot, type: 'jpeg' });
      const excerpt = await page.evaluate(executor);
      this.emit("url-complete", { id, url, file, screenshot, html: excerpt.textContent, title: excerpt.title })
      await page.close();
    } catch (err) {
      console.log(err)
      this.emit("crawl-error", { err })
      try {
        await page.close();
      } catch (err) { }
    }

    this.queue.delete(link)
    this.crawl();
  }

  processFile(content, file) {
    const newLinks = getUrls(content)
      .filter(url => !this.skipUrls.includes(url))
      .map(url => ({ url, file, id: CryptoJs.MD5(url) }))
    this.queue = new Set([...this.queue, ...newLinks])
    this.skipUrls = [...this.skipUrls, ...newLinks]
  }
}

module.exports = NightCrawler
