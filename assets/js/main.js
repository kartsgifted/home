/* 메인 페이지 전용 — 히어로 슬라이더 / 프로그램 레일 */
(function(){
  var slides=document.querySelectorAll('#hero .slide'),dots=document.querySelectorAll('.dots button'),idx=0,timer;
  if(!slides.length) return;
  function go(n){idx=(n+slides.length)%slides.length;
    slides.forEach(function(s,i){s.classList.toggle('on',i===idx)});
    dots.forEach(function(d,i){d.classList.toggle('on',i===idx)});}
  function play(){clearInterval(timer);timer=setInterval(function(){go(idx+1)},6000)}
  document.querySelector('.h-nav.next').addEventListener('click',function(){go(idx+1);play()});
  document.querySelector('.h-nav.prev').addEventListener('click',function(){go(idx-1);play()});
  dots.forEach(function(d,i){d.addEventListener('click',function(){go(i);play()})});
  play();

  var rail=document.getElementById('rail');
  /* 카드가 모두 보이면 좌우 화살표 숨김 */
  function syncArrows(){
    var over = rail.scrollWidth - rail.clientWidth > 4;
    var box = document.querySelector('.arrows');
    if(box) box.style.visibility = over ? 'visible' : 'hidden';
  }
  window.addEventListener('resize', syncArrows); setTimeout(syncArrows, 300);
  document.querySelectorAll('[data-rail]').forEach(function(b){
    b.addEventListener('click',function(){
      var step=rail.querySelector('.card').offsetWidth+20;
      rail.scrollBy({left:b.dataset.rail==='next'?step:-step,behavior:'smooth'});
    });
  });
})();

/* 한 번 스크롤로 다음 칸 이동 — PC(1101px 이상 · 마우스)만.
   화면보다 긴 칸은 안에서 일반 스크롤하다가 끝에 닿으면 다음 칸으로 넘어간다. */
(function(){
  var blocks=[].slice.call(document.querySelectorAll('body > section[id]'));
  var foot=document.getElementById('footer');
  if(!blocks.length) return;
  if(foot) blocks.push(foot);

  var wide=window.matchMedia('(min-width:1101px) and (pointer:fine)'),
      still=window.matchMedia('(prefers-reduced-motion:reduce)'),
      root=document.documentElement,
      busy=false, waitQuiet=false, lastWheel=0;

  function on(){ return wide.matches && !still.matches && !document.body.classList.contains('menu-open'); }

  /* 이동할 위치를 정해 움직이면 true, 일반 스크롤에 맡기면 false */
  function step(dir){
    var y=window.scrollY, vh=window.innerHeight, max=root.scrollHeight-vh, i=0, to;
    blocks.forEach(function(b,k){ if(b.offsetTop<=y+2) i=k; });
    /* 화면보다 10% 넘게 길어야 긴 칸으로 본다 (표지처럼 조금만 긴 칸은 한 칸으로 이동) */
    var b=blocks[i], top=b.offsetTop, h=b.offsetHeight, long=h>vh*1.1;
    if(dir>0){
      if(long && y+vh<top+h-2) return false;          /* 긴 칸의 아래가 남음 */
      if(i+1>=blocks.length) return false;
      to=Math.min(blocks[i+1].offsetTop,max);
    }else{
      if(long && y>top+2) return false;                /* 긴 칸의 위가 남음 */
      if(y>top+vh*.1){
        to=top;                                        /* 짧은 칸에서 많이 어긋나 있으면 칸 위로 맞춤 */
      }else{
        if(i===0) return false;
        var p=blocks[i-1];
        to=p.offsetHeight>vh*1.1 ? top-vh : p.offsetTop;   /* 긴 칸으로 올라가면 그 칸의 끝 화면부터 */
      }
    }
    if(Math.abs(to-y)<2) return false;
    animate(to);
    return true;
  }

  function animate(to){
    var from=window.scrollY, d=to-from, t0=null, dur=700;
    busy=true; root.style.scrollBehavior='auto';
    requestAnimationFrame(function f(t){
      if(t0===null) t0=t;
      var p=Math.min(1,(t-t0)/dur), e=p<.5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2;
      window.scrollTo(0,from+d*e);
      if(p<1) return requestAnimationFrame(f);
      root.style.scrollBehavior=''; busy=false; waitQuiet=true;
    });
  }

  window.addEventListener('wheel',function(e){
    if(!on() || e.ctrlKey || Math.abs(e.deltaY)<=Math.abs(e.deltaX)) return;
    var now=Date.now(), gap=now-lastWheel; lastWheel=now;
    if(busy){ e.preventDefault(); return; }
    /* 이동 직후 트랙패드 관성으로 이어지는 휠은 무시하고, 한 번 멈춘 뒤의 휠부터 받는다 */
    if(waitQuiet){
      if(gap<200){ e.preventDefault(); return; }
      waitQuiet=false;
    }
    if(step(e.deltaY>0?1:-1)) e.preventDefault();
  },{passive:false});

  var KEYS={PageDown:1,PageUp:-1,ArrowDown:1,ArrowUp:-1};
  window.addEventListener('keydown',function(e){
    var dir=e.key===' ' ? (e.shiftKey?-1:1) : KEYS[e.key];
    if(!dir || !on() || e.altKey || e.ctrlKey || e.metaKey) return;
    if(e.target.closest && e.target.closest('input,textarea,select,button,[contenteditable]')) return;
    if(busy){ e.preventDefault(); return; }
    if(step(dir)) e.preventDefault();
  });
})();
