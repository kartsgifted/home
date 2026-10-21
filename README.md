# 2026 K예술영재 프로젝트 — 홍보 사이트

대한민국발레축제(bafeko.com) 디자인 시스템을 적용한 정적 사이트입니다.
공통 레이아웃(헤더·전체메뉴·푸터)을 JS 템플릿으로 분리해 페이지는 본문만 작성합니다.

## 폴더 구조

```
/
├─ index.html          메인 (히어로 슬라이드 / PROGRAMS / 소개 / 심화과정 / 소식)
├─ about.html          사업소개   — 프로젝트 개요 · 추진체계 · 연간 로드맵 · 오시는 길
├─ programs.html       분야별 프로그램 — 무용 · 음악 · 미술 · 전통예술 · 전체일정
├─ mentoring.html      심화 멘토링 (메뉴 「프로그램」 아래)
├─ camp.html           겨울캠프   (메뉴 「프로그램」 아래)
├─ course.html         예전 심화과정 주소 — mentoring.html · camp.html로 넘김
├─ news.html           소식·아카이브 — 공지사항 · 아카이브 · 갤러리
└─ assets/
   ├─ css/common.css   토큰 · 헤더 · 서브비주얼 · 탭 · 본문 컴포넌트 · 푸터 (전 페이지 공통)
   ├─ css/main.css     메인 전용
   ├─ js/common.js     SITEMAP + 헤더/전체메뉴/푸터 렌더 + 탭 · 리빌 · 스크롤
   ├─ js/main.js       메인 히어로 슬라이더 · 프로그램 레일
   ├─ js/program-photos.js  프로그램 페이지의 「갤러리」 사진 줄 (분야가 지정된 갤러리 앨범)
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

## 편집 모드 (보관됨)

이전의 정적 편집 기능(`?edit=1` 인라인 편집 · `admin.html` · content.json 저장)은 사용을 멈추고 `_legacy/` 폴더에 보관했습니다.
원래 파일 위치와 사용법은 [`_legacy/README.md`](_legacy/README.md)를 참고하세요.

새 관리자 페이지(공지사항 · 갤러리 · 메인 소식 목록 관리) 안내는 개발이 끝나면 이 자리에 추가합니다.
