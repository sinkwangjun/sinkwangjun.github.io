# CLAUDE.md

한국어 법률 블로그를 **마크다운 → 정적 HTML**로 변환하는 프로젝트다. 이 문서는 앞으로의 작업 세션이 일관된 아키텍처·규칙·디자인으로 사이트를 구축·유지하도록 하는 지침서다.

> 현재 상태: 콘텐츠 작업 폴더(`01_아이디어·주제` … `06_템플릿`)와 `README.txt`, 포스팅 템플릿만 존재하는 초기 단계. 웹사이트 코드(`src/`, `posts/` 등)는 아직 없으며, 이 문서의 "목표 구조"를 기준으로 만든다.

---

## 1. 프로젝트 개요

- **성격**: 한국어 법률 실무 블로그 (판례·법령·부동산등기 등).
- **동작**: `posts/*.md`(프론트매터 + 마크다운) → 빌드 스크립트가 정적 HTML 생성 → 정적 호스팅에 배포.
- **핵심 원칙**: **프레임워크 없음.** 순수 HTML/CSS/JS로 구현하고, Node는 빌드 스크립트 실행 용도로만 사용한다.
- **렌더링 방식**: 빌드 타임 정적 생성(클라이언트 런타임 렌더링 아님) — SEO·초기 로딩에 유리하며 법률 블로그의 검색 유입에 중요.

---

## 2. 목표 폴더 구조

```
블로그작성/
├── CLAUDE.md
├── package.json              # build/serve 스크립트(런타임 의존성 없음)
├── .gitignore                # dist/·node_modules·비공개 원고 폴더 제외
├── .gitattributes            # 줄바꿈 LF 정규화 + 바이너리 표시
├── .github/workflows/deploy.yml  # GitHub Pages 자동 배포
├── posts/                    # 발행 원고 .md (frontmatter + markdown)
│   ├── 2026-07-12-부동산등기-소유권이전.md
│   └── 2026-06-28-임대차-계약갱신요구권.md
├── src/
│   ├── build.js              # Node 빌드: posts/ 읽어 dist/에 정적 HTML 생성
│   ├── style.css             # 디자인 시스템(토큰·다크모드·반응형·@font-face)
│   ├── main.js               # 다크모드 토글 + 카테고리 필터
│   ├── favicon.svg           # 탭 아이콘(§ 마크)
│   ├── templates/layout.js   # 페이지 HTML 템플릿(목록·글·404·이전/다음)
│   └── vendor/
│       ├── marked.min.js     # 벤더링한 마크다운 파서(marked v12)
│       └── fonts/PretendardVariable.woff2  # 벤더링한 한글 가변폰트
├── assets/                   # 웹용 이미지(원본은 05_이미지·자료에서 반입)
├── dist/                     # 생성된 정적 사이트(배포 대상, git 무시)
└── 01_아이디어·주제 … 06_템플릿  # 기존 콘텐츠 작업 폴더(그대로 유지)
```

- **기존 한글 작업 폴더(`01_`~`06_`)는 건드리지 않는다.** 웹 발행 소스는 별도의 `posts/`로 분리한다.
- `dist/`는 생성물이므로 직접 편집하지 않는다(항상 빌드로 재생성).

---

## 3. 빌드 파이프라인

- 실행: `node src/build.js`
- 흐름:
  1. `posts/*.md` 순회.
  2. 각 파일의 `---` 프론트매터 블록을 직접 파싱(간단 YAML)하고, 본문만 `vendor/marked.min.js`로 HTML 변환.
  3. 렌더된 HTML의 `h2/h3`에 앵커 `id`를 부여하고 **목차(TOC)**를 수집(제목 2개 이상일 때 글 상단에 표시).
  4. 각 글을 `dist/posts/<slug>.html`(하단에 이전/다음 글 이동 포함)로, 글 목록을 `dist/index.html`로, 없는 주소용 `dist/404.html`을 생성.
  5. `style.css`·`main.js`·`fonts/`·`assets/`를 `dist/`로 복사하고, GitHub Pages용 `.nojekyll`을 생성.
  6. **SEO 파일 생성**: `sitemap.xml`·`robots.txt`·`feed.xml`(Atom). 절대주소는 `SITE_URL`을 사용.
- **SITE_URL**: sitemap/feed의 절대주소용. 기본값은 placeholder(`https://YOURNAME.github.io/law-blog`)이며, 배포 주소에 맞게 `src/build.js`의 기본값을 수정하거나 `SITE_URL=... node src/build.js`로 지정. (Pages 워크플로에 `env: SITE_URL:`을 추가해도 됨.)
- 목록 정렬: **날짜 최신순**, 카테고리 필터 지원(`main.js`).
- 마크다운 파서는 반드시 **벤더링한 로컬 파일**을 쓴다. CDN·런타임 npm 의존성 추가 금지.
- `dist/` 삭제 시 OneDrive 잠금 대비로 `rmSync`에 재시도 옵션 사용. **로컬 미리보기 서버를 켠 채로 재빌드하면 폴더 잠금(EPERM)이 날 수 있으니 서버를 끄고 빌드**한다.

---

## 4. 원고(.md) 규칙

- **파일명**: `YYYY-MM-DD-슬러그.md` (예: `2026-07-12-부동산등기-소유권이전.md`).
- **프론트매터**(포스팅 템플릿 항목과 매핑):

```yaml
---
title: 부동산 소유권이전등기 실무 정리
category: 부동산등기
date: 2026-07-12
keywords: [소유권이전, 등기, 부동산]
summary: 소유권이전등기의 쟁점과 실무 절차를 한눈에 정리합니다.
---
```

- **본문 구성**은 `06_템플릿/포스팅템플릿.txt`의 흐름을 따른다:
  도입(독자의 고민) → 본문(① 쟁점 · ② 관련 법령·판례 · ③ 실무 절차·유의사항) → 결론(핵심 요약·안내) → 첨부·출처(관련 법령/판례번호).
- 글에 쓰는 이미지는 `assets/`에 두고 마크다운에서 상대경로로 참조한다.

---

## 5. 디자인 시스템

- **콘셉트**: 신뢰감 있고 차분한 "법률 실무" 톤. AI 기본값(크림+테라코타, 보라 그라데이션, 과한 히어로 등)은 피한다. **잉크빛 중립색 + 절제된 청색/청록 계열 액센트 1개**로 통일.
- **타이포그래피**: 한국어 가독성 우선. **Pretendard 가변폰트를 로컬 벤더링**(`src/vendor/fonts/PretendardVariable.woff2`, `@font-face`로 로드, CDN 미사용). 미설치 환경에서도 시스템 한글 폰트로 폴백. 본문 폭 약 65자, 명확한 타입 스케일, 제목엔 `text-wrap: balance`. 폰트 교체 시 `src/vendor/fonts/`의 파일과 `style.css`의 `@font-face`만 수정.
- **다크모드**: 팔레트를 CSS 커스텀 프로퍼티(토큰)로 `:root`에 정의한다. `@media (prefers-color-scheme: dark)`로 OS 설정을 반영하고, `:root[data-theme="dark"]` / `:root[data-theme="light"]`로 사용자 토글이 양방향으로 우선하도록 한다. 선택값은 `localStorage`에 저장. **컴포넌트는 토큰을 통해서만** 색을 참조하고, 라이트/다크 양쪽 대비·액센트를 모두 검증한다.
- **반응형**: 형제 그룹은 flex/grid + `gap`으로 배치(개별 margin 남발 금지). 표·코드 등 넓은 콘텐츠는 자체 `overflow-x: auto` 컨테이너에 넣어 본문이 가로 스크롤되지 않게 한다. 모바일 우선 브레이크포인트, 충분한 터치 타깃·여백.
- **접근성**: 키보드 포커스 가시 상태 제공, `prefers-reduced-motion` 존중, 의미 있는 색 대비. 숫자 정렬에는 `font-variant-numeric: tabular-nums`.

---

## 6. 명령어(Commands)

- **빌드**: `node src/build.js` (또는 `npm run build`)
- **로컬 미리보기**: `npm run serve` → 빌드 후 `dist/` 서빙. 또는 `dist/`에서 `python -m http.server`.
  - 미리보기 서버는 `dist/`를 잠글 수 있으니 **재빌드 전에 종료**한다.
- **배포(GitHub Pages)**: `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 자동으로 빌드→배포.
  - 저장소 설정 → Pages → Source를 **GitHub Actions**로 지정(최초 1회).
  - 상대경로만 사용하므로 사용자/프로젝트 페이지 모두 base 경로 설정 불필요.

---

## 7. 작업 규칙 (for future sessions)

- **프레임워크·런타임 npm 의존성 추가 금지.** 필요한 라이브러리는 소스로 `src/vendor/`에 포함한다.
- **새 글 추가 = `posts/`에 .md 한 개(+ `assets/`에 이미지).** 글을 늘려도 코드 수정이 필요 없도록 유지한다.
- **디자인 변경은 `src/style.css`의 토큰을 우선**으로 한다. 컴포넌트에 색을 하드코딩하지 않는다.
- `dist/`는 편집하지 말고 항상 빌드로 재생성한다.
