'use strict';

// HTML 이스케이프 (메타/텍스트 삽입용)
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// YYYY-MM-DD -> YYYY.MM.DD (표시용)
function fmtDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${m[1]}.${m[2]}.${m[3]}` : esc(d);
}

// 공통 문서 셸. rootPrefix: 하위 페이지에서 './' 또는 '../'
function shell({ title, description, bodyClass = '', main, rootPrefix = './' }) {
  const desc = esc(description || '');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${desc}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:type" content="website" />
  <link rel="alternate" type="application/atom+xml" title="법률 실무 노트" href="${rootPrefix}feed.xml" />
  <link rel="stylesheet" href="${rootPrefix}style.css" />
  <script>
    // 다크모드 FOUC 방지: 사용자가 명시 선택한 경우에만 즉시 반영
    (function () {
      try {
        var t = localStorage.getItem('theme');
        if (t === 'dark' || t === 'light') {
          document.documentElement.setAttribute('data-theme', t);
        }
      } catch (e) {}
    })();
  </script>
</head>
<body class="${bodyClass}">
  <a class="skip-link" href="#main">본문 바로가기</a>
  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="${rootPrefix}index.html">법률 실무 노트</a>
      <button id="theme-toggle" class="theme-toggle" type="button"
              aria-label="테마 전환" title="라이트/다크 전환">
        <span class="theme-toggle__icon" aria-hidden="true"></span>
      </button>
    </div>
  </header>
  <main id="main" class="wrap">
${main}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <p>© 법률 실무 노트 · 이 글은 일반적 정보 제공을 위한 것으로 법률 자문이 아닙니다.</p>
    </div>
  </footer>
  <script src="${rootPrefix}main.js" defer></script>
</body>
</html>
`;
}

// 목록(홈) 페이지
function renderIndex({ posts, categories, siteDescription }) {
  const chips = ['전체', ...categories]
    .map((c, i) => `<button class="chip${i === 0 ? ' is-active' : ''}" type="button" data-filter="${esc(c)}">${esc(c)}</button>`)
    .join('\n        ');

  const cards = posts.map((p) => `
      <article class="card" data-category="${esc(p.category)}">
        <a class="card__link" href="posts/${esc(p.slug)}.html">
          <div class="card__meta">
            <span class="tag">${esc(p.category)}</span>
            <time datetime="${esc(p.date)}">${fmtDate(p.date)}</time>
          </div>
          <h2 class="card__title">${esc(p.title)}</h2>
          ${p.summary ? `<p class="card__summary">${esc(p.summary)}</p>` : ''}
        </a>
      </article>`).join('\n');

  const main = `
    <section class="intro">
      <h1 class="intro__title">법률 실무 노트</h1>
      <p class="intro__lede">${esc(siteDescription)}</p>
    </section>
    <nav class="filters" aria-label="카테고리 필터">
        ${chips}
    </nav>
    <section class="post-list" aria-live="polite">${cards || '<p class="empty">아직 발행된 글이 없습니다.</p>'}
    </section>`;

  return shell({
    title: '법률 실무 노트',
    description: siteDescription,
    bodyClass: 'page-index',
    main,
    rootPrefix: './',
  });
}

// 개별 글 페이지
function renderPost({ post, contentHtml, toc = [] }) {
  const kw = (post.keywords || [])
    .map((k) => `<li class="kw">#${esc(k)}</li>`)
    .join('');

  const tocHtml =
    toc.length >= 2
      ? `
      <nav class="toc" aria-label="목차">
        <p class="toc__title">목차</p>
        <ul class="toc__list">
          ${toc
            .map(
              (h) =>
                `<li class="toc__item toc__item--h${h.level}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`
            )
            .join('\n          ')}
        </ul>
      </nav>`
      : '';

  const main = `
    <a class="back-link" href="../index.html">← 목록으로</a>
    <article class="post">
      <header class="post__header">
        <div class="post__meta">
          <span class="tag">${esc(post.category)}</span>
          <time datetime="${esc(post.date)}">${fmtDate(post.date)}</time>
        </div>
        <h1 class="post__title">${esc(post.title)}</h1>
        ${post.summary ? `<p class="post__lede">${esc(post.summary)}</p>` : ''}
        ${kw ? `<ul class="post__keywords">${kw}</ul>` : ''}
      </header>
      ${tocHtml}
      <div class="prose">
${contentHtml}
      </div>
    </article>
    <a class="back-link back-link--bottom" href="../index.html">← 목록으로</a>`;

  return shell({
    title: `${post.title} · 법률 실무 노트`,
    description: post.summary || '',
    bodyClass: 'page-post',
    main,
    rootPrefix: '../',
  });
}

module.exports = { renderIndex, renderPost, esc, fmtDate };
