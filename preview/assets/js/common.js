/* ============================================================
   2026 K예술영재 프로젝트 — common.js
   헤더 / 전체메뉴 / 푸터 공통 템플릿 + 공통 인터랙션
   ▣ 메뉴를 바꾸려면 아래 SITEMAP 하나만 수정하면
     헤더·전체메뉴·푸터가 모두 함께 바뀝니다.
   ============================================================ */
var SITE = {
  name : "2026 K예술영재 프로젝트",
  org  : "한국예술영재교육연구원",
  mail : "kgifted2026@naver.com",
  addr : "한국예술영재교육연구원 · 2026 K예술영재 프로젝트",
  /* 푸터 SNS — url을 넣으면 새 탭 링크가 된다. 비어 있으면 아이콘만 보이고 눌러도 이동하지 않는다.
     주소는 2026-10-14 차장님 전달 (인스타그램만 계정 이름이 kartgifted — 실제 프로젝트 계정임을 확인함) */
  sns  : [
    { id:"youtube",   name:"유튜브",     url:"https://www.youtube.com/@kartsgifted" },
    { id:"instagram", name:"인스타그램", url:"https://www.instagram.com/kartgifted/" },
    { id:"threads",   name:"스레드",     url:"https://www.threads.com/@kartsgifted" },
    { id:"tiktok",    name:"틱톡",       url:"https://www.tiktok.com/@kartsgifted" }
  ]
};

/* SNS 아이콘 (24×24, 흰색은 CSS의 currentColor) */
var SNS_ICON = {
  youtube:'<path fill="currentColor" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>',
  instagram:'<rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.25" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="17.4" cy="6.6" r="1.25" fill="currentColor"/>',
  threads:'<path fill="currentColor" d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/>',
  tiktok:'<path fill="currentColor" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>'
};

var SITEMAP = [
  { id:"about", en:"ABOUT", ko:"사업소개", href:"about.html", sub:[
      {t:"프로젝트 개요", h:"about.html#overview"},
      {t:"추진체계·참여기관", h:"about.html#system"},
      {t:"연간 로드맵",     h:"about.html#road"}
  ]},
  /* pages: 이 메뉴를 현재 위치로 표시할 페이지(body의 data-page) */
  { id:"programs", en:"PROGRAMS", ko:"프로그램", href:"programs.html", pages:["programs","mentoring","camp"], sub:[
      {t:"워크숍",     h:"programs.html"},
      {t:"심화 멘토링", h:"mentoring.html"},
      {t:"겨울캠프",   h:"camp.html"}
  ]},
  { id:"news", en:"NEWS", ko:"소식", href:"news.html", sub:[
      {t:"공지사항",   h:"news.html#notice"},
      {t:"언론홍보",   h:"news.html#press"},
      {t:"갤러리",     h:"news.html#gallery"}
  ]}
];

/* ---------- 헤더 / 전체메뉴 / 푸터 렌더 ---------- */
(function(){
  var cur = document.body.dataset.page || "";

  var gnb = SITEMAP.map(function(m){
    var on = m.id===cur || (m.pages && m.pages.indexOf(cur)>=0);
    return '<li class="'+(on?'on':'')+'"><a href="'+m.href+'">'+m.ko+'</a></li>';
  }).join('');

  var header =
  '<div class="inner hd-in">'+
    '<a href="index.html" class="logo">'+
      '<span class="yr">2026 THE 1<sup>ST</sup></span>'+
      '<span class="nm">K ARTS<br>GIFTED<br>PROJECT</span>'+
      '<span class="kr">한국예술영재</span>'+
    '</a>'+
    '<nav><ul id="gnb">'+gnb+'</ul></nav>'+
    '<button class="ham" type="button" aria-label="전체메뉴"><span></span><span></span><span></span></button>'+
  '</div>';

  var cols = SITEMAP.map(function(m){
    return '<div class="col"><h3><span>'+m.en+'</span>'+m.ko+'</h3><ul>'+
      m.sub.map(function(s){return '<li><a href="'+s.h+'">'+s.t+'</a></li>'}).join('')+
    '</ul></div>';
  }).join('');
  var allmenu = '<div class="inner"><div class="cols">'+cols+'</div></div>';

  var ftCols = SITEMAP.map(function(m){
    return '<div class="ft-col"><h4>'+m.ko+'</h4><ul>'+
      m.sub.map(function(s){return '<li><a href="'+s.h+'">'+s.t+'</a></li>'}).join('')+
    '</ul></div>';
  }).join('');
  var footer =
  '<div class="inner">'+
    '<div class="ft-top">'+ftCols+
      '<div class="ft-sns">'+SITE.sns.map(function(s){
        var svg = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">'+SNS_ICON[s.id]+'</svg>';
        return s.url
          ? '<a href="'+s.url+'" target="_blank" rel="noopener noreferrer" aria-label="'+s.name+' (새 창)" title="'+s.name+'">'+svg+'</a>'
          : '<a aria-label="'+s.name+' (준비 중)" title="'+s.name+'">'+svg+'</a>';
      }).join('')+'</div>'+
    '</div>'+
    '<div class="ft-bot">'+
      '<nav class="ft-nav"><a href="index.html">HOME</a></nav>'+
      '<address><span data-site="addr">'+SITE.addr+'</span> · <span data-site="mail">'+SITE.mail+'</span><br>&copy; K ARTS GIFTED PROJECT. All Rights Reserved.</address>'+
    '</div>'+
  '</div>';

  function fill(id,html,tag,cls){
    var el=document.getElementById(id);
    if(!el){el=document.createElement(tag||'div');el.id=id;if(cls)el.className=cls;document.body.appendChild(el)}
    el.innerHTML=html;
    return el;
  }
  fill('header',header,'header');
  fill('allmenu',allmenu);
  fill('footer',footer,'footer');
  if(!document.querySelector('.top')){
    var b=document.createElement('button');b.className='top';b.type='button';
    b.setAttribute('aria-label','맨 위로');b.innerHTML='&#8593;';document.body.appendChild(b);
  }

  /* ---------- 인터랙션 ---------- */
  var hd=document.getElementById('header'), topBtn=document.querySelector('.top'),
      hero=document.getElementById('hero');
  function onScroll(){
    var y=window.scrollY;
    if(hero) hd.classList.toggle('solid', y > hero.offsetHeight-120);
    topBtn.classList.toggle('on', y>600);
  }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
  topBtn.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});

  document.querySelector('.ham').addEventListener('click',function(){
    document.body.classList.toggle('menu-open');
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') document.body.classList.remove('menu-open'); });

  /* reveal */
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target); } });
  },{threshold:.12});
  document.querySelectorAll('[data-rv]').forEach(function(el){io.observe(el)});
  window.__rvObserve=function(root){ (root||document).querySelectorAll('[data-rv]:not(.on)').forEach(function(el){io.observe(el)}); };
})();

/* ---------- 서브페이지 탭 ---------- */
(function(){
  var tabs=document.getElementById('tabs');
  if(!tabs) return;
  var btns=tabs.querySelectorAll('button'),
      panels=document.querySelectorAll('.panel');

  function open(id,push){
    btns.forEach(function(b){b.classList.toggle('on',b.dataset.tab===id)});
    panels.forEach(function(p){p.classList.toggle('on',p.id===id)});
    var c=document.querySelector('#crumb li:last-child'),
        b=tabs.querySelector('[data-tab="'+id+'"]');
    if(c&&b) c.textContent=b.textContent;
    if(push) history.replaceState(null,'','#'+id);
    if(window.__rvObserve) window.__rvObserve(document.getElementById(id));
  }
  btns.forEach(function(b){
    b.addEventListener('click',function(){
      open(b.dataset.tab,true);
      var y=document.getElementById('tabs').offsetTop;
      if(window.scrollY>y) window.scrollTo({top:y,behavior:'smooth'});
    });
  });
  /* 해시의 / 앞부분이 탭 이름 (#notice/N-0003 → 공지사항 탭 안의 글 상세, news.js) */
  function tabOf(){
    var h=location.hash.replace('#','').split('/')[0];
    return h && document.getElementById(h) ? h : '';
  }
  var hash=tabOf();
  open(hash || btns[0].dataset.tab,false);
  if(hash){ /* 해시로 들어와도 서브비주얼부터 보이도록 위치 보정 */
    window.scrollTo(0, Math.max(0, tabs.offsetTop - 1));
  }
  window.addEventListener('hashchange',function(){
    var h=tabOf();
    if(h) open(h,false);
  });
})();
