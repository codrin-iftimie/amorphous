# amorphous
obsidian.md that crawls your urls and backlinks them to create a graph

## Usage

```bash
mkdir -p ~/volcano/plugins/
cd ~/volcano/plugins/
git clone https://github.com/codrin-iftimie/amorphous.git
cd amorphous
npm i
npx volcano
```

## Please backup your notes first

My plugin will create it's own folder where all of the links will have their own md file (image + link). The crawled text from the page will appear only on search, just to keep the clutter out

It's nice to see how these links are created by opening the graph view

As a precaution I'm only doing backlinks to files that are under a specific folder `Amorphous.beta`. Only these md files will have links in the graph.

lane1

lane2
