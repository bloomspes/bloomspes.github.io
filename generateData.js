#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const OUTPUT_DIRECTORIES = ['./data/tag', './data/metadata'];
const files = [...getMarkdownFiles('./_wiki', 'wiki'), ...getMarkdownFiles('./_posts', 'blog')];
const pages = files.map(readPage).filter(page => page.public !== 'false');
const pageMap = Object.fromEntries(pages.map(page => [page.fileName, {
    type: page.type, title: page.title, summary: page.summary, parent: page.parent,
    url: page.url, updated: page.updated || page.date, children: []
}]));

for (const page of pages) {
    if (page.parent && page.parent !== 'index' && pageMap[page.parent]) pageMap[page.parent].children.push(page.fileName);
}
for (const directory of OUTPUT_DIRECTORIES) fs.rmSync(directory, {recursive: true, force: true});
for (const directory of OUTPUT_DIRECTORIES) fs.mkdirSync(directory, {recursive: true});

const tagMap = {};
for (const page of pages) for (const tag of page.tag || []) (tagMap[tag] ||= []).push(page.fileName);
for (const [tag, ids] of Object.entries(tagMap)) fs.writeFileSync(`./data/tag/${encodeURIComponent(tag)}.json`, JSON.stringify(ids.sort(compare)));
fs.writeFileSync('./data/tag_count.json', JSON.stringify(Object.entries(tagMap).map(([name, ids]) => ({name, size: ids.length})).sort((a, b) => compare(a.name, b.name)), null, 1));
for (const page of Object.values(pageMap)) {
    const output = `./data/metadata/${page.url.replace(/^\/wiki\//, '')}.json`;
    fs.mkdirSync(path.dirname(output), {recursive: true});
    fs.writeFileSync(output, JSON.stringify(page));
}

function getMarkdownFiles(directory, type) {
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) return getMarkdownFiles(filePath, type);
        return entry.name.endsWith('.md') ? [{path: filePath, type}] : [];
    });
}
function readPage(file) {
    const content = fs.readFileSync(file.path, 'utf8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
    if (!match) throw new Error(`${file.path}: YAML front matter is required`);
    const metadata = {};
    for (const line of match[1].split('\n')) {
        const item = line.match(/^\s*([^:#]+):\s*(.*?)\s*$/);
        if (item) metadata[item[1].trim()] = item[2].trim().replace(/^['"]|['"]$/g, '');
    }
    const root = file.type === 'wiki' ? './_wiki' : './_posts';
    const relative = path.relative(root, file.path).replace(/\.md$/, '');
    const fileName = file.type === 'wiki' ? relative : relative.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    return {...metadata, type: file.type, fileName,
        url: file.type === 'wiki' ? `/wiki/${relative}` : `/blog/${metadata.date.slice(0, 10).replaceAll('-', '/')}/${fileName}`,
        tag: metadata.tag ? metadata.tag.split(/\s+/) : []};
}
function compare(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); }
