# 2026 K예술영재 프로젝트 — 홍보 사이트

대한민국발레축제(bafeko.com) 디자인 시스템을 적용한 정적 사이트입니다.
공통 레이아웃(헤더·전체메뉴·푸터)을 JS 템플릿으로 분리해 페이지는 본문만 작성합니다.

## 폴더 구조

```
/
├─ index.html          메인 (히어로 슬라이드 / PROGRAMS / 소개 / 심화과정 / 소식)
├─ about.html          사업소개   — 프로젝트 개요 · 추진체계 · 연간 로드맵 · 오시는 길
├─ programs.html       분야별 프로그램 — 무용 · 음악 · 미술 · 전통예술 · 전체일정
├─ course.html         심화과정   — 심화 멘토링 · 겨울캠프 · 참여 신청
├─ news.html           소식·아카이브 — 공지사항 · 아카이브 · 갤러리
└─ assets/
   ├─ css/common.css   토큰 · 헤더 · 서브비주얼 · 탭 · 본문 컴포넌트 · 푸터 (전 페이지 공통)
   ├─ css/main.css     메인 전용
   ├─ js/common.js     SITEMAP + 헤더/전체메뉴/푸터 렌더 + 탭 · 리빌 · 스크롤
   ├─ js/main.js       메인 히어로 슬라이더 · 프로그램 레일
   └─ img/             이미지 넣는 곳
```

## 자주 바꾸는 것 3가지

1. **메뉴 구조** — `assets/js/common.js` 상단의 `SITEMAP` 배열만 수정하면
   상단 GNB · 전체메뉴 · 푸터가 모두 함께 바뀝니다.
2. **연락처·기관명** — 같은 파일 상단의 `SITE` 객체.
3. **이미지** — `assets/css/common.css` 의 `:root { --img-sub-* }`,
   `assets/css/main.css` 의 `:root { --img-hero*, --img-news, --img-p1~5 }`
   값을 `url("assets/img/파일명.jpg")` 로 교체. 비워두면 그라디언트가 표시됩니다.

## 세부 페이지 추가하는 법

1. 기존 서브페이지(예: `about.html`)를 복사
2. `<body class="sub" data-page="약칭">` 과 `#sv[data-page]` 값 변경
3. `#tabs` 의 `<button data-tab="아이디">` 와 `<section class="panel" id="아이디">` 를 쌍으로 추가
4. `common.js` 의 `SITEMAP` 에 항목 추가

## 본문에서 바로 쓰는 공통 컴포넌트

`.h-sec` 섹션제목 · `.h-sub` 중제목 · `.lead` 세리프 리드문 · `.txt` 본문
`.split` 2단 레이아웃 · `.tbl` 정보표 · `.boxes.c2/.c3/.c4` + `.box` 카드
`.dot` 도트리스트 · `.tl` 타임라인 · `.note` 안내박스 · `.btn`/`.btn.ghost` 버튼
`.bbs` 게시판 목록 + `.paging` · `.gal` 갤러리 그리드 · `.mapbox` 지도자리
스크롤 등장 효과는 요소에 `data-rv`(지연은 `data-d="1~4"`) 만 붙이면 됩니다.

## 남은 작업

- 전화번호 `02-0000-0000` → 실제 사무국 번호 (`common.js` 의 `SITE.tel`, `index.html` 다크 섹션)
- 아카이브·수요조사 버튼의 `href="#"` → 실제 주소
- `about.html#map` 지도 영역에 카카오/네이버 지도 embed
- 사진 교체

---

## 편집 모드

정적 사이트이므로 **편집 → content.json 내보내기 → GitHub 업로드** 순서로 반영됩니다.

### 1) 인라인 편집 — 페이지 주소 뒤에 `?edit=1`

```
index.html?edit=1     about.html?edit=1     programs.html?edit=1
course.html?edit=1    news.html?edit=1
```

- 점선으로 표시된 텍스트를 클릭하면 그 자리에서 바로 수정됩니다. (Esc = 취소)
- 목록(메인 카드, 공지사항, 갤러리) 항목에 마우스를 올리면 `↑ ↓ ✕` 가 나타나고, 아래 `+ 항목 추가` 로 새 항목을 넣을 수 있습니다.
- 하단 바의 **이미지** 버튼에서 모든 이미지 주소를 한 번에 지정합니다.

### 2) 관리자 화면 — `admin.html`

- **사이트 공통** 전화·이메일·푸터 표기 (푸터와 메인 연락처에 동시 반영)
- **이미지** 서브비주얼·히어로·카드 이미지 주소
- **목록 관리** 항목 추가/삭제/순서 변경
- **페이지 텍스트** 5개 페이지의 모든 문구를 한 화면에서 수정

### 3) 저장 방식

| 버튼 | 동작 |
|---|---|
| 임시 저장 | 이 브라우저에만 저장 (나만 미리보기) |
| content.json 내보내기 | 파일을 내려받아 **사이트 최상위 폴더에 덮어쓰기** → 커밋하면 전체 공개 |
| JSON 불러오기 | 다른 PC에서 만든 content.json 이어서 편집 |
| 초기화 | 임시 저장분을 지우고 content.json 기준으로 되돌리기 |

> ⚠️ 파일을 더블클릭(`file://`)으로 열면 브라우저 보안 정책 때문에 `content.json` 과 페이지 목록을 읽지 못합니다.
> VS Code Live Server 등 **로컬 서버**나 **GitHub Pages 주소**로 열어주세요.

### 편집 가능 범위를 넓히려면

HTML 요소에 `data-k="고유키"` 를 붙이면 그 요소가 편집 대상이 됩니다.
반복되는 목록은 컨테이너에 `data-list="이름"` 을 주고 `assets/js/cms.js` 의 `LIST` 에 템플릿을 추가하면 됩니다.
