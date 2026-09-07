/* ============================================================
   2026 K예술영재 프로젝트 — common.js
   헤더 / 전체메뉴 / 푸터 공통 템플릿 + 공통 인터랙션
   ▣ 메뉴를 바꾸려면 아래 SITEMAP 하나만 수정하면
     헤더·전체메뉴·푸터가 모두 함께 바뀝니다.
   ============================================================ */
var SITE = {
  name : "2026 K예술영재 프로젝트",
  org  : "한국예술영재교육연구원",
  tel  : "02-0000-0000",
  mail : "kbrainc.ai@gmail.com",
  addr : "한국예술영재교육연구원 · 2026 K예술영재 프로젝트"
};

var SITEMAP = [
  { id:"about", en:"ABOUT", ko:"사업소개", href:"about.html", sub:[
      {t:"프로젝트 개요", h:"about.html#overview"},
      {t:"추진체계·참여기관", h:"about.html#system"},
      {t:"연간 로드맵",     h:"about.html#road"},
      {t:"오시는 길",       h:"about.html#map"}
  ]},
  { id:"programs", en:"PROGRAMS", ko:"분야별 프로그램", href:"programs.html", sub:[
      {t:"무용",     h:"programs.html#dance"},
      {t:"음악",     h:"programs.html#music"},
      {t:"미술",     h:"programs.html#art"},
      {t:"전통예술", h:"programs.html#trad"},
      {t:"전체일정", h:"programs.html#sched"}
  ]},
  { id:"course", en:"ADVANCED", ko:"심화과정", href:"course.html", sub:[
      {t:"심화 멘토링", h:"course.html#mentoring"},
      {t:"겨울캠프",   h:"course.html#camp"},
      {t:"참여 신청",   h:"course.html#apply"}
  ]},
  { id:"news", en:"NEWS", ko:"소식·아카이브", href:"news.html", sub:[
      {t:"공지사항",   h:"news.html#notice"},
      {t:"아카이브",   h:"news.html#archive"},
      {t:"갤러리",     h:"news.html#gallery"}
  ]}
];

/* ---------- 헤더 / 전체메뉴 / 푸터 렌더 ---------- */
(function(){
  var cur = document.body.dataset.page || "";

  var gnb = SITEMAP.map(function(m){
    return '<li class="'+(m.id===cur?'on':'')+'"><a href="'+m.href+'">'+m.ko+'</a></li>';
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
      '<div class="ft-link"><button class="fbtn" type="button">관련 사이트 LINK <span>&#8963;</span></button></div>'+
    '</div>'+
    '<div class="ft-bot">'+
      '<nav class="ft-nav"><a href="index.html">HOME</a><a href="news.html#notice">이메일무단수집거부</a><a href="about.html#map">오시는 길</a></nav>'+
      '<address><span data-site="addr">'+SITE.addr+'</span> · TEL <span data-site="tel">'+SITE.tel+'</span> · <span data-site="mail">'+SITE.mail+'</span><br>&copy; K ARTS GIFTED PROJECT. All Rights Reserved.</address>'+
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
  var hash=location.hash.replace('#','');
  var valid = hash && document.getElementById(hash);
  open(valid ? hash : btns[0].dataset.tab,false);
  if(valid){ /* 해시로 들어와도 서브비주얼부터 보이도록 위치 보정 */
    window.scrollTo(0, Math.max(0, tabs.offsetTop - 1));
  }
  window.addEventListener('hashchange',function(){
    var h=location.hash.replace('#','');
    if(document.getElementById(h)) open(h,false);
  });
})();
