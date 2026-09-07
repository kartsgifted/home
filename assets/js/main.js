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
