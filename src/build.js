'use strict';

/*
 * 정적 블로그 빌드 스크립트
 * posts/*.md (프론트매터 + 마크다운) -> dist/ 정적 HTML
 * 실행:  node src/build.js
 * 의존성: src/vendor/marked.min.js (벤더링) 외 런타임 의존성 없음
 */

const fs = require('fs');
const path = require('path');
const { renderIndex, renderPost } = require('./templates/layout');

// marked 벤더 로드 (UMD)
const markedMod = require('./vendor/marked.min.js');
const marked = markedMod.marked || markedMod;
marked.setOptions({ gfm: true, breaks: false });

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const ASSETS_DIR = path.join(ROOT, 'assets');
const SRC_DIR = __dirname;
const DIST_DIR = path.join(ROOT, 'dist');

const SITE_TITLE = '법률 실무 노트';
const SITE_DESCRIPTION =
  '부동산등기·판례·법령 등 실무에서 자주 마주치는 쟁점을 알기 쉽게 정리합니다.';

// 배포 도메인. GitHub Pages 프로젝트 페이지는 경로 접두사를 포함한다.
// 예:  SITE_URL=https://myname.github.io/law-blog node src/build.js
// (또는 아래 기본값을 본인 주소로 직접 수정)
const SITE_URL = (
  process.env.SITE_URL || 'https://sin96677596.github.io'
).replace(/\/+$/, '');

// --- 유틸 ---------------------------------------------------------------

function rmrf(dir) {
  // OneDrive/Windows의 일시적 파일 잠금(EPERM) 대비: 재시도 옵션 사용
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 아주 단순한 프론트매터 파서 (key: value, key: [a, b, c])
function parseFrontMatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, '');
    }
    data[key] = val;
  }
  return { data, body: m[2] };
}

// XML 이스케이프 (sitemap / feed 용)
function xmlEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// YYYY-MM-DD -> RFC3339 (KST). Atom/lastmod 용.
function toRfc3339(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00` : '';
}

// sitemap.xml / robots.txt / feed.xml(Atom) 생성
function writeSeoFiles(posts) {
  const home = `${SITE_URL}/`;

  // sitemap
  const urls = [{ loc: home, lastmod: posts[0] ? posts[0].date : '' }].concat(
    posts.map((p) => ({ loc: `${SITE_URL}/posts/${p.slug}.html`, lastmod: p.date }))
  );
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${xmlEsc(u.loc)}</loc>${
            u.lastmod ? `<lastmod>${xmlEsc(u.lastmod)}</lastmod>` : ''
          }</url>`
      )
      .join('\n') +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf8');

  // robots.txt
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robots, 'utf8');

  // Atom feed
  const updated = toRfc3339(posts[0] ? posts[0].date : '') || `${new Date().getFullYear()}-01-01T00:00:00+09:00`;
  const entries = posts
    .map(
      (p) => `  <entry>
    <title>${xmlEsc(p.title)}</title>
    <link href="${xmlEsc(`${SITE_URL}/posts/${p.slug}.html`)}"/>
    <id>${xmlEsc(`${SITE_URL}/posts/${p.slug}.html`)}</id>
    <updated>${xmlEsc(toRfc3339(p.date))}</updated>
    <category term="${xmlEsc(p.category)}"/>
    <summary>${xmlEsc(p.summary)}</summary>
  </entry>`
    )
    .join('\n');
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEsc(SITE_TITLE)}</title>
  <subtitle>${xmlEsc(SITE_DESCRIPTION)}</subtitle>
  <link href="${xmlEsc(`${SITE_URL}/feed.xml`)}" rel="self"/>
  <link href="${xmlEsc(home)}"/>
  <id>${xmlEsc(home)}</id>
  <updated>${xmlEsc(updated)}</updated>
${entries}
</feed>
`;
  fs.writeFileSync(path.join(DIST_DIR, 'feed.xml'), feed, 'utf8');
}

// 제목 텍스트 -> 앵커 id (한글 유지)
function slugify(text) {
  const s = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣ㄱ-ㆎ-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'section';
}

// 렌더된 HTML의 h2/h3에 id 부여 + 목차(TOC) 수집
function addHeadingIds(html) {
  const toc = [];
  const used = Object.create(null);
  const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (m, lvl, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let id = slugify(text);
    if (used[id]) {
      used[id] += 1;
      id = `${id}-${used[id]}`;
    } else {
      used[id] = 1;
    }
    toc.push({ level: Number(lvl), id, text });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
  return { html: out, toc };
}

// --- 빌드 ---------------------------------------------------------------

function build() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`posts/ 폴더가 없습니다: ${POSTS_DIR}`);
    process.exit(1);
  }

  // dist 초기화
  rmrf(DIST_DIR);
  fs.mkdirSync(path.join(DIST_DIR, 'posts'), { recursive: true });

  // 원고 수집
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.md'));

  const posts = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const { data, body } = parseFrontMatter(raw);
    const slug = file.replace(/\.md$/i, '');
    const post = {
      slug,
      title: data.title || slug,
      category: data.category || '기타',
      date: data.date || '',
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      summary: data.summary || '',
      body,
    };
    posts.push(post);
  }

  // 최신순 정렬
  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // 카테고리 목록 (등장 순 유지)
  const categories = [];
  for (const p of posts) {
    if (p.category && !categories.includes(p.category)) categories.push(p.category);
  }

  // 개별 글 페이지
  for (const post of posts) {
    const rawHtml = marked.parse(post.body);
    const { html: contentHtml, toc } = addHeadingIds(rawHtml);
    const html = renderPost({ post, contentHtml, toc });
    fs.writeFileSync(path.join(DIST_DIR, 'posts', `${post.slug}.html`), html, 'utf8');
  }

  // 목록 페이지
  const indexHtml = renderIndex({ posts, categories, siteDescription: SITE_DESCRIPTION });
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexHtml, 'utf8');

  // 정적 자산 복사
  fs.copyFileSync(path.join(SRC_DIR, 'style.css'), path.join(DIST_DIR, 'style.css'));
  fs.copyFileSync(path.join(SRC_DIR, 'main.js'), path.join(DIST_DIR, 'main.js'));
  copyDir(path.join(SRC_DIR, 'vendor', 'fonts'), path.join(DIST_DIR, 'fonts'));
  copyDir(ASSETS_DIR, path.join(DIST_DIR, 'assets'));

  // GitHub Pages가 _폴더 등을 Jekyll로 처리하지 않도록
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');

  // SEO: sitemap.xml / robots.txt / feed.xml
  writeSeoFiles(posts);

  console.log(`빌드 완료: 글 ${posts.length}개, 카테고리 ${categories.length}개 -> dist/`);
  if (/YOURNAME/.test(SITE_URL)) {
    console.log(
      `  ⚠ SITE_URL이 기본 placeholder입니다. sitemap/feed의 절대주소를 바꾸려면\n` +
        `    SITE_URL=https://<사용자>.github.io/<저장소> 로 빌드하거나 src/build.js의 기본값을 수정하세요.`
    );
  }
}

build();
