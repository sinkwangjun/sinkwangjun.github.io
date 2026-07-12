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

const SITE_DESCRIPTION =
  '부동산등기·판례·법령 등 실무에서 자주 마주치는 쟁점을 알기 쉽게 정리합니다.';

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

  console.log(`빌드 완료: 글 ${posts.length}개, 카테고리 ${categories.length}개 -> dist/`);
}

build();
