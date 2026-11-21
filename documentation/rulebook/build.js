const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const editions = require('./editions');
const { artworks } = require('../../media/rulebook/artwork.json');

const root = path.resolve(__dirname, '../..');
const artworkDirectory = path.join(root, 'media/rulebook');
const sourceStart = '<!-- rulebook-source:start -->';
const sourceEnd = '<!-- rulebook-source:end -->';

function escapeAttribute(value) {
	return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function plainText(html) {
	return html.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', '\'').replaceAll('&#x27;', '\'');
}

function slugify(value) {
	return plainText(value).toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-');
}

async function createRenderer() {
	const { Marked } = await import('./vendor/marked.mjs');
	const headings = [];
	const counts = new Map();
	const markdown = new Marked({ gfm: true, breaks: false });
	markdown.use({
		renderer: {
			heading({ tokens, depth }) {
				const inline = this.parser.parseInline(tokens);
				const base = slugify(inline);
				const count = counts.get(base) || 0;
				counts.set(base, count + 1);
				const id = count ? `${base}-${count}` : base;
				headings.push({ id, depth, label: plainText(inline) });
				return `<h${depth} id="${id}" tabindex="-1">${inline}</h${depth}>\n`;
			},
		},
	});
	return { markdown, headings };
}

async function imageElement(art, web = false) {
	const classes = { cover: 'cover-art', opening: 'chapter-art', margin: 'spot-art', tail: 'spot-art tail-art' };
	const bytes = web ? null : await fs.readFile(path.join(artworkDirectory, art.web.path));
	const src = web ? `/rulebook/assets/${path.basename(art.web.path)}` : `data:image/webp;base64,${bytes.toString('base64')}`;
	return `<figure class="illustration ${classes[art.placement.kind]}" aria-hidden="true"><img src="${src}" alt="" width="${art.width}" height="${art.height}" ${art.placement.kind === 'cover' ? 'fetchpriority="high"' : web ? 'loading="lazy"' : 'loading="eager"'} decoding="async" data-artwork="${art.name}"></figure>`;
}

async function renderTopics(tokens, markdown, chapterId, glossaryId, placements, web) {
	const groups = [];
	let current = { id: `${chapterId}-introduction`, tokens: [] };
	for (const token of tokens) {
		const isHeading = token.type === 'heading';
		const anchor = chapterId === glossaryId && token.raw.match(/^<a id="([^"]+)"><\/a>/);
		if (isHeading || anchor) {
			if (current.tokens.some(part => part.type !== 'space')) groups.push(current);
			current = { id: isHeading ? slugify(token.text) : anchor[1], tokens: [] };
		}
		current.tokens.push(token);
	}
	if (current.tokens.some(part => part.type !== 'space')) groups.push(current);
	const rendered = [];
	for (const group of groups) {
		const art = placements.get(group.id);
		if (!art) {
			rendered.push(`<div class="topic" data-topic="${group.id}">${markdown.parser(group.tokens)}</div>`);
			continue;
		}
		const [heading, ...body] = group.tokens;
		const title = markdown.parser([heading]);
		const content = markdown.parser(body);
		const figure = await imageElement(art, web);
		const illustrated = art.placement.kind === 'tail' ? content + figure : figure + content;
		rendered.push(`<div class="topic illustrated-topic" data-topic="${group.id}">${title}${illustrated}</div>`);
	}
	return rendered.join('\n');
}

function navigation(headings, localId) {
	const chapters = headings.filter(heading => heading.depth === 1 && ![localId('ttrpg-random'), localId('table-of-contents')].includes(heading.id));
	return chapters.map((chapter, index) => {
		const first = headings.indexOf(chapter) + 1;
		const next = headings.findIndex((heading, position) => position >= first && heading.depth === 1);
		const children = headings.slice(first, next === -1 ? undefined : next);
		const label = `<span class="nav-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><a href="#${chapter.id}" data-chapter-link="${chapter.id}">${escapeAttribute(chapter.label)}</a>`;
		if (!children.length) return `<div class="nav-chapter nav-leaf">${label}</div>`;
		return `<details class="nav-chapter" data-chapter-nav="${chapter.id}"><summary>${label}<span class="disclosure" aria-hidden="true"></span></summary><ul>${children.map(child => `<li class="nav-depth-${child.depth}"><a href="#${child.id}">${escapeAttribute(child.label)}</a></li>`).join('')}</ul></details>`;
	}).join('\n');
}

async function renderBook(source, { illustrations = true, language = 'en', web = false } = {}) {
	const edition = editions[language];
	const localId = id => edition.ids[id] || id;
	const placements = new Map(illustrations ? artworks.map(art => [localId(art.placement.section), art]) : []);
	const { markdown, headings } = await createRenderer();
	const tokens = markdown.lexer(source);
	const contentsIndex = tokens.findIndex(token => token.type === 'heading' && token.depth === 1 && slugify(token.text) === localId('table-of-contents'));
	if (contentsIndex < 0) throw new Error('The canonical source must contain its table of contents.');
	const front = tokens.slice(0, contentsIndex);
	const firstRule = front.findIndex(token => token.type === 'hr');
	const lastRule = front.findLastIndex(token => token.type === 'hr');
	const coverArt = placements.get(localId('ttrpg-random'));
	const cover = `<header class="book-cover" aria-labelledby="${localId('ttrpg-random')}">
<div class="front-meta">${markdown.parser(front.slice(0, firstRule))}</div>
<div class="cover-top-rule">${markdown.parser(front.slice(firstRule, firstRule + 1))}</div>
<div class="cover-title">${markdown.parser(front.slice(firstRule + 1, lastRule))}</div>
${coverArt ? await imageElement(coverArt, web) : ''}
<div class="cover-bottom-rule">${markdown.parser(front.slice(lastRule))}</div>
</header>`;
	const chapters = [];
	for (const token of tokens.slice(contentsIndex)) {
		if (token.type === 'heading' && token.depth === 1) chapters.push({ title: token, tokens: [] });
		else chapters.at(-1).tokens.push(token);
	}
	const rendered = [];
	for (const [index, chapter] of chapters.entries()) {
		const id = slugify(chapter.title.text);
		const title = markdown.parser([chapter.title]);
		let body = await renderTopics(chapter.tokens, markdown, id, localId('definitions'), placements, web);
		if (language === 'fr' && id === localId('adventure')) body = body.replace('<u>Niveaux de rareté et valeur générale</u>', '<u id="niveaux-de-rareté">Niveaux de rareté et valeur générale</u>');
		const openingArt = placements.get(id);
		const art = openingArt ? await imageElement(openingArt, web) : '';
		rendered.push(`<section class="chapter ${id === localId('table-of-contents') ? 'contents' : ''}" data-chapter="${id}" aria-labelledby="${id}"><header class="chapter-heading" ${index ? `data-number="${String(index).padStart(2, '0')}"` : ''}>${title}</header>${art}<div class="chapter-body">${body}</div></section>`);
	}
	return { book: `${cover}\n${rendered.join('\n')}`, headings, navigation: navigation(headings, localId), canonical: (await createRenderer()).markdown.parse(source) };
}

async function build(language = 'en', { web = false } = {}) {
	const edition = editions[language];
	if (!edition) throw new Error(`Unsupported rulebook language: ${language}`);
	const { sourcePath } = edition;
	const outputPath = web ? path.join(root, `documentation/website-rules-${language}.html`) : edition.outputPath;
	const bytes = await fs.readFile(sourcePath);
	const source = bytes.toString('utf8');
	const { book, navigation: nav } = await renderBook(source, { language, web });
	const [template, styles, reader, fonts] = await Promise.all([
		fs.readFile(path.join(__dirname, 'template.html'), 'utf8'),
		fs.readFile(path.join(__dirname, 'rulebook.css'), 'utf8'),
		fs.readFile(path.join(__dirname, 'reader.js'), 'utf8'),
		Promise.all(['EBGaramond', 'EBGaramond-Italic', 'Cinzel'].map(async name => [name, (await fs.readFile(path.join(__dirname, `fonts/${name}.ttf`))).toString('base64')])),
	]);
	let css = styles;
	let localizedTemplate = template;
	for (const [english, localized] of Object.entries(edition.ids)) {
		css = css.replaceAll('="' + english + '"', '="' + localized + '"');
		localizedTemplate = localizedTemplate.replaceAll('#' + english, '#' + localized);
	}
	for (const [english, localized] of Object.entries(edition.interface)) localizedTemplate = localizedTemplate.replaceAll(english, localized);
	localizedTemplate = localizedTemplate.replace('<html lang="en">', '<html lang="' + language + '">');
	const readerUi = { ...edition.ui, contentsId: edition.ids['table-of-contents'] || 'table-of-contents' };
	const localizedReader = reader.replace('const ui = __READER_UI__;', `const ui = ${JSON.stringify(readerUi).replaceAll('<', '\\u003c')};`).replace(', __READER_UI__ */', ' */');
	for (const [name, base64] of fonts) css = css.replace(`__FONT_${name}__`, web ? `/fonts/${name}.woff2` : `data:font/ttf;base64,${base64}`);
	if (web) css = css.replaceAll('format("truetype")', 'format("woff2")');
	const hash = createHash('sha256').update(bytes).digest('hex');
	const licenses = (await Promise.all(['EBGaramond-OFL.txt', 'Cinzel-OFL.txt'].map(name => fs.readFile(path.join(__dirname, `fonts/${name}`), 'utf8')))).join('\n\n');
	const html = localizedTemplate.replace('__SOURCE_SHA256__', hash).replace('__FONT_LICENSES__', licenses.replaceAll('--', '—')).replace('__STYLES__', css).replace('__NAVIGATION__', nav).replace('__BOOK__', `${sourceStart}\n${book}\n${sourceEnd}`).replace('__READER__', localizedReader);
	await fs.writeFile(outputPath, html);
	console.log(`Built ${path.relative(root, outputPath)} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB). Source SHA-256: ${hash}`);
	return { outputPath, hash };
}

if (require.main === module) {
  const web = process.argv.includes('--web');
  const language = process.argv.slice(2).find(value => !value.startsWith('--'));
  Promise.all((language ? [language] : Object.keys(editions)).map(lang => build(lang, { web }))).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { build, renderBook, createRenderer, sourcePath: editions.en.sourcePath, outputPath: editions.en.outputPath, sourceStart, sourceEnd, plainText, slugify };
