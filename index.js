const Crawler = require("./Crawler.js");
const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')

function getUrls(text) {
  const results = text.match(/(https?:\/\/[^\s|\]|)]+)/g)
  return results;
}

function getUrlBacklinks(text) {
  const results = text.match(/\[\[(.+)(?:\|)(https?:\/\/[^\s|\]|)]+)(?:]+)/g)
  return results;
}

const BASE_FOLDER = "Amorphous";

class AmorphousPlugin {
	constructor() {
		this.id = 'AmorphousPlugin'
		this.name = 'AmorphousPlugin'
		this.description = 'Plugin that will index all of your links.'
		this.defaultOn = true
  }

  async init(app, instance) {
    this.app = app
    this.instance = instance
    this.instance.registerStatusBarItem()
  }


  async initServices() {
    const adapter = new FileAsync(`${app.vault.adapter.basePath}/${BASE_FOLDER}/db.json`)
    const db = await low(adapter)
    this.db = db;
    await db.defaults({ urls: [] }).write()
    const urls = db.get("urls").value();
    const skipUrls = urls.map(entry => entry.url)
    this.crawler = new Crawler({baseUrl: `${app.vault.adapter.basePath}/${BASE_FOLDER}`, skipUrls})
    this.crawler.on("url-complete", ({id, url, file, html, title}) => {
      const vault = this.app.vault
      this.showStatus(`${title} is complete`)
      const path = `${BASE_FOLDER}/${title.replace('/', ' ')}.md`
      this.db.get("urls").push({id, url, title, path}).write()

      vault.adapter.write(path, `![screenshot](${BASE_FOLDER}/_images/${id}.jpg)
[${title}](${url})
<div hidden data-id="${id}"></div>
<div hidden>${html.replace(/\s\s+/g, ' ')}</div>
`)
      console.log("@url complete", {id, url, file, html, title})
    })

    this.crawler.on("finished", this.replaceLinks.bind(this))
  }


  replaceLinks() {
    console.log("@finished crawling; replacing links")
    const urlCollection = this.db.get("urls");

    this.mdFiles.forEach(async(file, index) => {
      if (!file.path.startsWith("PluginTest/")) {
        return;
      }

      const contents = await this.app.vault.cachedRead(file)
      let links = getUrls(contents);
      const backLinks = getUrlBacklinks(contents)

      console.log({links, backLinks})

      let updated = contents
      links.forEach(link => {
        updated = updated.replace(link, (link, offset, string) => {
          const before = string[offset - 1];
          if (before === "|") {
            return link
          }
          const urlInfo = urlCollection.find({url: link}).value();

          if (!urlInfo) {
            return link
          }

          return `[[${urlInfo.path}|${urlInfo.url}]]`
        })
      })

      backLinks.forEach(link => {
        updated = updated.replace(link, (match) => {
          const originalMatch = match;
          const linkAndLabel = match.replace('[[', '').replace(']]', '');
          const [path, url] = linkAndLabel.split("|")
          const urlInfo = urlCollection.find({url}).value();

          if (!urlInfo) {
            return originalMatch;
          }

          return `[[${urlInfo.path}|${urlInfo.url}]]`
        })
      })

      this.app.vault.adapter.write(file.path, updated)
    })
  }

  async onEnable({ workspace }, instance) {
    this.showStatus("initialized")
    const vault = this.app.vault;

    try {
      await vault.createFolder(`${BASE_FOLDER}`)
      await vault.createFolder(`${BASE_FOLDER}/_images`)
    }catch(err) {
      //ignore
      console.log(err)
    }

    await this.initServices()

    this.mdFiles.forEach(this.queueFile, this)
    this.replaceLinks()
  }

  async queueFile(file) {
    const vault = this.app.vault;
    const contents = await vault.cachedRead(file)
    this.crawler.processFile(contents, file);

    console.log("@file queued", {file})
  }

  showStatus(msg) {
    const { statusBarEl } = this.instance
    if (!statusBarEl) return
    var node = document.createElement("span");
    node.textContent = msg
    statusBarEl.innerHTML = ""
    statusBarEl.appendChild(node)
  }

  get mdFiles() {
    const vault = this.app.vault;
    return vault.getMarkdownFiles().filter(file => !file.path.startsWith(`${BASE_FOLDER}/`))
  }
}

module.exports = () => new AmorphousPlugin()
