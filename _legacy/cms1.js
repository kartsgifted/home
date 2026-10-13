/* ============================================================
   2026 K예술영재 프로젝트 — cms.js
   content.json 을 읽어 페이지 텍스트 / 이미지 / 목록을 덮어씁니다.
   주소 뒤에 ?edit=1 을 붙이면 인라인 편집 모드가 켜집니다.
   ------------------------------------------------------------
   저장 구조 (content.json)
   {
     "site": { "tel":"", "mail":"", "addr":"" },
     "img" : { "hero1":"assets/img/a.jpg", "sub-about":"..." },
     "text": { "about.overview.5":"편집된 HTML", ... },
     "list": { "cards":[...], "bbs":[...], "gal":[...] }
   }
   ============================================================ */
window.CMS = (function(){
  var DRAFT_KEY = 'kag_content_draft';
  var data = {site:{}, img:{}, text:{}, list:{}};
  var seeds = {};                                  /* 목록 원본(HTML에서 추출) */
  var isEdit = /[?&]edit=1/.test(location.search);

  /* 편집 중 깜빡임 방지 (cms.js 가 로드된 경우에만 적용) */
  var guard = document.createElement('style');
  guard.textContent = 'html:not(.cms-ready) body{visibility:hidden}';
  document.head.appendChild(guard);
  var reveal = function(){ document.documentElement.classList.add('cms-ready'); };
  setTimeout(reveal, 1200);

  /* ---------- 유틸 ---------- */
  function txt(el,sel){ var e=el.querySelector(sel); return e?e.innerHTML.trim():''; }
  function esc(s){ return String(s==null?'':s); }
  function deep(o){ return JSON.parse(JSON.stringify(o)); }
  function merge(base, add){
    ['site','img','text','list'].forEach(function(k){
      if(add && add[k]) Object.keys(add[k]).forEach(function(p){ base[k][p]=add[k][p]; });
    });
    return base;
  }

  /* ---------- 목록 템플릿 ---------- */
  var LIST = {
    cards: {
      label:'메인 프로그램 카드', item:'.card',
      fields:[['ko','분야'],['en','분야(영문)'],['tt','제목'],['ttEn','제목(영문)'],['meta','일정·장소'],['href','링크'],['img','이미지 주소']],
      read:function(el){return {ko:txt(el,'.ko'),en:txt(el,'.en'),tt:txt(el,'.tt'),ttEn:txt(el,'.tt-en'),
        meta:txt(el,'.meta'),href:el.getAttribute('href')||'#',img:''};},
      write:function(o){
        var st = o.img ? ' style="background-image:url(\''+esc(o.img)+'\')"' : '';
        return '<a class="card" href="'+esc(o.href||'#')+'" data-rv><div class="thumb"><i'+st+'></i></div>'+
          '<p class="ko">'+esc(o.ko)+'</p><p class="en">'+esc(o.en)+'</p>'+
          '<p class="tt">'+esc(o.tt)+'</p><p class="tt-en">'+esc(o.ttEn)+'</p>'+
          '<p class="meta">'+esc(o.meta)+'</p></a>';
      }
    },
    nwNotice:{
      label:'메인 · 공지사항', item:'li',
      fields:[['t','제목'],['d','날짜'],['href','링크']],
      read:function(el){return {t:txt(el,'.t'),d:txt(el,'.d'),href:el.querySelector('a').getAttribute('href')};},
      write:function(o){return '<li><a href="'+esc(o.href||'#')+'"><span class="t">'+esc(o.t)+'</span><span class="d">'+esc(o.d)+'</span></a></li>';}
    },
    bbs:{
      label:'공지사항 목록', item:'li',
      fields:[['cat','분류'],['t','제목'],['d','날짜'],['href','링크']],
      read:function(el){return {cat:txt(el,'.cat'),t:txt(el,'.t'),d:txt(el,'.d'),href:el.querySelector('a').getAttribute('href')};},
      write:function(o){return '<li><a href="'+esc(o.href||'#')+'"><span class="cat">'+esc(o.cat)+'</span>'+
        '<span class="t">'+esc(o.t)+'</span><span class="d">'+esc(o.d)+'</span></a></li>';}
    },
    gal:{
      label:'갤러리', item:'figure',
      fields:[['t','제목'],['m','촬영 정보'],['img','이미지 주소']],
      read:function(el){return {t:txt(el,'figcaption'),m:txt(el,'.m'),img:''};},
      write:function(o){
        var st = o.img ? ' style="background-image:url(\''+esc(o.img)+'\')"' : '';
        return '<figure data-rv><div class="th"><i'+st+'></i></div><figcaption>'+esc(o.t)+'</figcaption><p class="m">'+esc(o.m)+'</p></figure>';
      }
    }
  };
  LIST.nwArchive = Object.assign({}, LIST.nwNotice, {label:'메인 · 아카이브'});

  /* ---------- 적용 ---------- */
  function applyText(){
    document.querySelectorAll('[data-k]').forEach(function(el){
      var v = data.text[el.getAttribute('data-k')];
      if(v!=null) el.innerHTML = v;
    });
  }
  function applyImg(){
    Object.keys(data.img).forEach(function(k){
      var v = data.img[k];
      document.documentElement.style.setProperty('--img-'+k, v ? 'url("'+v+'")' : 'var(--none)');
    });
  }
  function applyList(){
    document.querySelectorAll('[data-list]').forEach(function(box){
      var name = box.getAttribute('data-list'), t = LIST[name];
      if(!t) return;
      if(!seeds[name]) seeds[name] = [].map.call(box.querySelectorAll(t.item), t.read);
      var arr = data.list[name];
      if(!arr) return;
      box.innerHTML = arr.map(t.write).join('');
    });
  }
  function applySite(){
    var s = data.site || {};
    document.querySelectorAll('[data-site]').forEach(function(el){
      var v = s[el.getAttribute('data-site')];
      if(v!=null) el.innerHTML = v;
    });
  }
  function apply(){
    applyList(); applyText(); applyImg(); applySite();
    if(window.__rvObserve) window.__rvObserve();
    reveal();
  }

  /* ---------- 로드 ---------- */
  function load(){
    var draft = null;
    try{ draft = JSON.parse(localStorage.getItem(DRAFT_KEY)||'null'); }catch(e){}
    return fetch('content.json',{cache:'no-store'})
      .then(function(r){ return r.ok ? r.json() : {}; })
      .catch(function(){ return {}; })
      .then(function(published){
        merge(data, published);
        if(draft) merge(data, draft);
        return data;
      });
  }

  var ready = load().then(function(){
    if(document.readyState==='loading'){
      return new Promise(function(res){ document.addEventListener('DOMContentLoaded',res); });
    }
  }).then(function(){
    apply();
    if(isEdit){
      var s=document.createElement('link'); s.rel='stylesheet'; s.href='assets/css/edit.css';
      document.head.appendChild(s);
      var j=document.createElement('script'); j.src='assets/js/edit.js'; document.body.appendChild(j);
    }
  });

  return {
    data:data, seeds:seeds, LIST:LIST, ready:ready, isEdit:isEdit, DRAFT_KEY:DRAFT_KEY,
    apply:apply, applyList:applyList, applyImg:applyImg,
    listSeed:function(name){ return data.list[name] ? deep(data.list[name]) : deep(seeds[name]||[]); },
    saveDraft:function(){ try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); return true; }catch(e){ return false; } },
    clearDraft:function(){ try{ localStorage.removeItem(DRAFT_KEY); }catch(e){} },
    exportJSON:function(){
      var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
      a.download='content.json'; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
    },
    importJSON:function(file, cb){
      var fr=new FileReader();
      fr.onload=function(){ try{ merge(data, JSON.parse(fr.result)); cb&&cb(null); }catch(e){ cb&&cb(e); } };
      fr.readAsText(file);
    }
  };
})();
