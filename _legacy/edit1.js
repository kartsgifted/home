/* ============================================================
   인라인 편집 모드 (?edit=1)
   - [data-k] 요소를 클릭해 바로 수정
   - 목록(data-list) 항목 추가 / 삭제 / 순서 이동
   - 이미지 주소 변경
   - 브라우저에 임시 저장 → content.json 으로 내보내기
   ============================================================ */
(function(){
  var C = window.CMS; if(!C) return;
  var dirty = 0;
  document.body.classList.add('editing');

  var IMG_KEYS = [
    ['sub-about','서브비주얼 · 사업소개'],['sub-programs','서브비주얼 · 분야별 프로그램'],
    ['sub-course','서브비주얼 · 심화과정'],['sub-news','서브비주얼 · 소식·아카이브'],
    ['hero1','메인 히어로 1'],['hero2','메인 히어로 2'],['hero3','메인 히어로 3'],
    ['news','메인 다크 섹션'],
    ['p1','메인 카드 1'],['p2','메인 카드 2'],['p3','메인 카드 3'],['p4','메인 카드 4']
  ];

  /* ---------- 하단 바 ---------- */
  var bar = document.createElement('div');
  bar.id = 'ebar';
  bar.innerHTML =
    '<span class="tag">EDIT MODE</span>'+
    '<span class="st" id="est">텍스트를 클릭하면 바로 수정됩니다.</span>'+
    '<button type="button" id="eimg">이미지</button>'+
    '<button type="button" id="eload">불러오기</button>'+
    '<button type="button" class="warn" id="ereset">초기화</button>'+
    '<button type="button" id="esave">임시 저장</button>'+
    '<button type="button" class="pri" id="eexp">content.json 내보내기</button>'+
    '<button type="button" id="eout">나가기</button>'+
    '<input type="file" id="efile" accept="application/json" hidden>';
  document.body.appendChild(bar);
  var st = bar.querySelector('#est');
  function say(msg, good){ st.innerHTML = good ? '<b>'+msg+'</b>' : msg; }
  function mark(){ dirty++; say('수정 '+dirty+'건 — 저장하지 않으면 사라집니다.'); }

  /* ---------- 텍스트 인라인 편집 ---------- */
  function bindText(root){
    (root||document).querySelectorAll('[data-k]').forEach(function(el){
      if(el.dataset.bound) return;
      el.dataset.bound = '1';
      el.setAttribute('contenteditable','true');
      el.addEventListener('focus',function(){ el.dataset.before = el.innerHTML; });
      el.addEventListener('blur',function(){
        var v = el.innerHTML.trim();
        if(v === (el.dataset.before||'').trim()) return;
        C.data.text[el.getAttribute('data-k')] = v;
        el.classList.add('dirty'); mark();
      });
      el.addEventListener('keydown',function(e){
        if(e.key==='Enter' && !e.shiftKey && el.tagName!=='P' && el.tagName!=='DIV'){ e.preventDefault(); el.blur(); }
        if(e.key==='Escape'){ el.innerHTML = el.dataset.before||el.innerHTML; el.blur(); }
      });
      el.addEventListener('click',function(e){ e.stopPropagation(); }, true);
    });
  }

  /* ---------- 목록 편집 ---------- */
  function bindLists(){
    document.querySelectorAll('[data-list]').forEach(function(box){
      var name = box.getAttribute('data-list'), t = C.LIST[name];
      if(!t) return;
      if(!C.data.list[name]) C.data.list[name] = C.listSeed(name);

      function render(){
        box.innerHTML = C.data.list[name].map(t.write).join('');
        [].forEach.call(box.children, function(el,i){
          el.classList.add('li-wrap');
          var ctl = document.createElement('div');
          ctl.className = 'li-ctl';
          ctl.innerHTML = '<button data-a="up" title="위로">↑</button><button data-a="dn" title="아래로">↓</button>'+
                          '<button data-a="del" title="삭제">✕</button>';
          ctl.addEventListener('click',function(e){
            var a = e.target.getAttribute('data-a'); if(!a) return;
            e.preventDefault(); e.stopPropagation();
            var arr = C.data.list[name];
            if(a==='del'){ if(!confirm('이 항목을 삭제할까요?')) return; arr.splice(i,1); }
            if(a==='up' && i>0)          arr.splice(i-1,0,arr.splice(i,1)[0]);
            if(a==='dn' && i<arr.length-1) arr.splice(i+1,0,arr.splice(i,1)[0]);
            render(); mark();
          });
          el.appendChild(ctl);
          /* 항목 내부 텍스트도 인라인 편집 */
          t.fields.forEach(function(f){
            if(f[0]==='href' || f[0]==='img') return;
            var sel = {ko:'.ko',en:'.en',tt:'.tt',ttEn:'.tt-en',meta:'.meta',t:'.t',d:'.d',cat:'.cat',m:'.m'}[f[0]]
                      || (f[0]==='t' ? '.t' : null);
            if(f[0]==='t' && box.classList.contains('gal')) sel='figcaption';
            var node = sel ? el.querySelector(sel) : null;
            if(!node) return;
            node.setAttribute('contenteditable','true');
            node.addEventListener('blur',function(){
              C.data.list[name][i][f[0]] = node.innerHTML.trim(); mark();
            });
            node.addEventListener('click',function(e){e.preventDefault();e.stopPropagation()});
          });
          el.addEventListener('click',function(e){
            if(el.tagName==='A' || el.querySelector('a')) e.preventDefault();
          });
        });
        var add = document.createElement('div');
        add.className='li-add';
        add.innerHTML='<button type="button">+ '+t.label+' 항목 추가</button>';
        add.querySelector('button').addEventListener('click',function(){
          var o={}; t.fields.forEach(function(f){ o[f[0]] = f[0]==='href' ? '#' : ''; });
          o[t.fields[0][0]] = '새 항목';
          C.data.list[name].push(o); render(); mark();
        });
        box.appendChild(add);
      }
      render();
    });
  }

  /* ---------- 이미지 패널 ---------- */
  var panel = document.createElement('aside');
  panel.id='epanel';
  panel.innerHTML =
    '<header><h3>이미지 설정</h3><button class="close" type="button">&times;</button></header>'+
    '<div class="body"><p class="hint">이미지 파일을 <b>assets/img/</b> 폴더에 넣고, 아래에 <b>assets/img/파일명.jpg</b> 형식으로 주소를 적어주세요. 비워두면 기본 그라디언트가 표시됩니다.</p>'+
    IMG_KEYS.map(function(k){
      return '<div class="row"><label>'+k[1]+'<span>--img-'+k[0]+'</span></label>'+
             '<input type="text" data-img="'+k[0]+'" placeholder="assets/img/'+k[0]+'.jpg"></div>';
    }).join('')+'</div>';
  document.body.appendChild(panel);
  panel.querySelectorAll('[data-img]').forEach(function(inp){
    inp.value = C.data.img[inp.getAttribute('data-img')] || '';
    inp.addEventListener('change',function(){
      C.data.img[inp.getAttribute('data-img')] = inp.value.trim();
      C.applyImg(); mark();
    });
  });
  panel.querySelector('.close').addEventListener('click',function(){panel.classList.remove('on')});

  /* ---------- 버튼 ---------- */
  bar.querySelector('#eimg').addEventListener('click',function(){panel.classList.toggle('on')});
  bar.querySelector('#esave').addEventListener('click',function(){
    say(C.saveDraft() ? '이 브라우저에 임시 저장했습니다. 확정하려면 content.json 을 내보내세요.' : '저장 실패 — 브라우저 저장소를 사용할 수 없습니다.', true);
    dirty = 0;
  });
  bar.querySelector('#eexp').addEventListener('click',function(){
    C.saveDraft(); C.exportJSON();
    say('content.json 을 내려받았습니다. 사이트 최상위 폴더에 덮어쓰면 확정됩니다.', true);
  });
  bar.querySelector('#eload').addEventListener('click',function(){ bar.querySelector('#efile').click(); });
  bar.querySelector('#efile').addEventListener('change',function(e){
    var f=e.target.files[0]; if(!f) return;
    C.importJSON(f,function(err){
      if(err){ say('불러오기 실패 — JSON 형식을 확인해주세요.'); return; }
      C.saveDraft(); location.reload();
    });
  });
  bar.querySelector('#ereset').addEventListener('click',function(){
    if(!confirm('임시 저장한 편집 내용을 모두 지우고 content.json 기준으로 되돌립니다.')) return;
    C.clearDraft(); location.reload();
  });
  bar.querySelector('#eout').addEventListener('click',function(){
    location.href = location.pathname + location.hash;
  });

  /* 편집 모드에서는 링크 이동 막기 */
  document.addEventListener('click',function(e){
    var a = e.target.closest('a');
    if(a && !a.closest('#ebar') && !a.closest('#epanel')) e.preventDefault();
  });

  window.addEventListener('beforeunload',function(e){
    if(dirty){ e.preventDefault(); e.returnValue=''; }
  });

  bindLists(); bindText();
  say('텍스트를 클릭하면 바로 수정됩니다. 목록 항목은 마우스를 올리면 ↑ ↓ ✕ 가 나타납니다.');
})();
