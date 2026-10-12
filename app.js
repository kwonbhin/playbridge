(() => {
  const $ = s => document.querySelector(s);

  // 지원 앱: 이름, 동그라미 글자, 검색 주소 (주소는 폰·카톡에서 확인 필요)
  const APPS = {
    melon:   {name:'멜론',          short:'멜', url:q=>`https://www.melon.com/search/total/index.htm?q=${q}`},
    apple:   {name:'Apple Music',   short:'A',  url:q=>`https://music.apple.com/kr/search?term=${q}`},
    spotify: {name:'Spotify',       short:'S',  url:q=>`https://open.spotify.com/search/${q}`},
    youtube: {name:'YouTube Music', short:'Y',  url:q=>`https://music.youtube.com/search?q=${q}`},
    genie:   {name:'지니',          short:'지', url:q=>`https://www.genie.co.kr/search/searchMain?query=${q}`},
    bugs:    {name:'벅스',          short:'벅', url:q=>`https://music.bugs.co.kr/search/integrated?q=${q}`},
    flo:     {name:'FLO',           short:'F',  url:q=>`https://www.music-flo.com/search/all?keyword=${q}`}
  };
  const isApp = k => Object.prototype.hasOwnProperty.call(APPS, k);

  const store = {
    get(k){ try { return localStorage.getItem(k); } catch { return null; } },
    set(k,v){ try { localStorage.setItem(k,v); } catch {} }
  };
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // "가수 - 제목" 한 줄씩 읽기. 앞의 목록 번호(1. / 2) / - / •)만 지우고 숫자로 시작하는 이름은 지키기
  function parse(raw){
    return raw.split(/\r?\n|\r/)
      .map(x => x.trim().replace(/^(?:\d+[.)]\s+|[-*•]\s+)/, ''))
      .filter(Boolean)
      .map(line => {
        let artist = '', title = line;
        const sep = line.match(/\s+[—–-]\s+/);
        if (sep) { artist = line.slice(0, sep.index).trim(); title = line.slice(sep.index + sep[0].length).trim(); }
        return {artist: artist.slice(0,100), title: title.slice(0,150)};
      })
      .filter(t => t.title)
      .slice(0, 200);
  }

  // 링크(# 뒤)에서 목록 읽기. 바깥에서 온 값이라 모양과 길이를 모두 검사
  function readState(){
    try {
      const raw = decodeURIComponent(location.hash.slice(1));
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1 || !Array.isArray(d.tracks)) return null;
      const tracks = d.tracks
        .filter(t => t && typeof t.title === 'string' && t.title.trim())
        .slice(0, 200)
        .map(t => ({artist: typeof t.artist === 'string' ? t.artist.trim().slice(0,100) : '', title: t.title.trim().slice(0,150)}));
      if (!tracks.length) return null;
      return {v:1, title: typeof d.title === 'string' ? d.title.slice(0,60) : '', from: isApp(d.from) ? d.from : '', tracks};
    } catch { return null; }
  }

  const state = {
    data: readState(),
    sel: -1,
    to: isApp(store.get('pb_app')) ? store.get('pb_app') : 'apple',
    mode: 'list'            // 'list' | 'edit'
  };

  const searchUrl = t => APPS[state.to].url(encodeURIComponent(`${t.artist ? t.artist + ' ' : ''}${t.title}`));

  function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2200); }

  function renderApps(){
    $('#apps').innerHTML = Object.entries(APPS).map(([k,a]) =>
      `<button class="app" type="button" data-app="${k}" aria-pressed="${k===state.to}"><i aria-hidden="true">${escapeHtml(a.short)}</i><span>${escapeHtml(a.name)}</span></button>`).join('');
  }

  function renderRoute(){
    const editing = state.mode === 'edit';
    const from = editing ? state.to : (state.data && state.data.from);
    $('#routeTitle').textContent = editing ? '어디로 옮길까요?' : '이 앱으로 옮겨요';
    $('#appsLabel').textContent = editing ? '내가 쓰는 앱 (보내는 사람)' : '받는 앱 바꾸기';
    $('#fromPill').textContent = from ? APPS[from].name : '친구의 앱';
    $('#fromCaption').textContent = editing ? '내가 쓰는 앱' : '친구가 쓰는 앱';
    $('#toPill').textContent = editing ? '친구가 고름' : APPS[state.to].name;
    $('#toCaption').textContent = editing ? '받는 사람이 직접 골라요' : (from === state.to ? '같은 앱이에요' : '내가 쓰는 앱');
  }

  function renderOpen(){
    const btn = $('#openBtn');
    const t = state.data && state.data.tracks[state.sel];
    if (state.mode === 'list' && t) {
      btn.href = searchUrl(t);
      btn.removeAttribute('aria-disabled');
      btn.setAttribute('aria-label', `${t.title}을(를) ${APPS[state.to].name}에서 열기`);
      btn.classList.add('spinning');
      $('#openSong').textContent = t.title;
    } else {
      btn.href = '#';
      btn.setAttribute('aria-disabled', 'true');
      btn.removeAttribute('aria-label');
      btn.classList.remove('spinning');
      $('#openSong').textContent = '곡을 골라요';
    }
    $('#copyBtn').disabled = !state.data;
  }

  function renderList(){
    const d = state.data, ul = $('#tracks');
    $('#listEyebrow').textContent = state.mode === 'edit' ? '노래 보내기' : '친구가 보낸 노래';
    $('#listTitle').textContent = state.mode === 'edit' ? '새 노래 목록' : (d && d.title) || '친구가 보낸 노래';
    const n = state.mode === 'edit' ? parse($('#songsInput').value).length : (d ? d.tracks.length : 0);
    $('#bigCount').textContent = String(n).padStart(2, '0');
    $('#empty').hidden = !!d;
    if (!d) { ul.innerHTML = ''; return; }
    const appName = escapeHtml(APPS[state.to].name);
    ul.innerHTML = d.tracks.map((t,i) => {
      const on = i === state.sel;
      return `<li class="track" role="option" tabindex="0" data-i="${i}" aria-selected="${on}">
        <span class="no">${String(i+1).padStart(2,'0')}</span>
        <span><div class="name">${escapeHtml(t.title)}</div><div class="artist">${escapeHtml(t.artist || '아티스트 정보 없음')}</div></span>
        <a class="go" href="${searchUrl(t)}" target="_blank" rel="noopener" aria-label="${escapeHtml(t.title)} ${appName}에서 열기">${on ? appName + '에서 열기' : '▶'}</a>
      </li>`;
    }).join('');
  }

  function render(){
    const editing = state.mode === 'edit';
    $('#board').classList.toggle('editing', editing);
    $('#tabSend').setAttribute('aria-pressed', editing);
    $('#tabList').setAttribute('aria-pressed', !editing);
    $('#footText').textContent = editing ? '목록을 만들면 링크가 생겨요. 링크를 친구에게 보내세요.' : '곡을 누르면 고른 음악 앱의 검색 화면이 열려요.';
    $('#newBtn').textContent = editing ? '받은 노래 보기' : '＋ 새 목록';
    renderApps(); renderRoute(); renderList(); renderOpen();
  }

  function setMode(m){
    state.mode = m;
    if (m === 'edit' && state.data && !$('#songsInput').value) {
      $('#titleInput').value = state.data.title || '';
      $('#songsInput').value = state.data.tracks.map(t => t.artist ? `${t.artist} - ${t.title}` : t.title).join('\n');
    }
    render();
    if (m === 'edit') $('#songsInput').focus();
  }

  function select(i){ state.sel = state.sel === i ? -1 : i; renderList(); renderOpen(); }

  function make(){
    const tracks = parse($('#songsInput').value);
    if (!tracks.length) { toast('곡 이름을 한 줄 이상 적어 주세요.'); $('#songsInput').focus(); return; }
    const data = {v:1, title: $('#titleInput').value.trim().slice(0,60) || '친구에게 추천하는 노래', from: state.to, tracks};
    const encoded = encodeURIComponent(JSON.stringify(data));
    if (encoded.length > 7000) { toast('곡이 너무 많아요. 목록을 나눠 주세요.'); return; }
    history.replaceState(null, '', '#' + encoded);
    state.data = data; state.sel = -1; state.mode = 'list';
    render();
    toast(`${tracks.length}곡 목록을 만들었어요. '링크 복사'로 보내세요.`);
  }

  async function copy(){
    if (!state.data) return;
    if (location.protocol === 'file:') { toast('친구와 공유하려면 먼저 웹에 배포해야 해요.'); return; }
    const url = location.href;
    try { await navigator.clipboard.writeText(url); }
    catch {
      const el = document.createElement('textarea'); el.value = url; el.setAttribute('readonly',''); el.style.position = 'fixed'; el.style.opacity = '0';
      document.body.append(el); el.select(); document.execCommand('copy'); el.remove();
    }
    toast('공유 링크를 복사했어요.');
  }

  // 이벤트
  $('#apps').addEventListener('click', e => {
    const b = e.target.closest('.app'); if (!b || !isApp(b.dataset.app)) return;
    state.to = b.dataset.app; store.set('pb_app', state.to);
    render();
  });
  $('#tracks').addEventListener('click', e => {
    const li = e.target.closest('.track'); if (!li) return;
    if (e.target.closest('.go')) { state.sel = Number(li.dataset.i); renderList(); renderOpen(); return; }
    select(Number(li.dataset.i));
  });
  $('#tracks').addEventListener('keydown', e => {
    const li = e.target.closest('.track'); if (!li) return;
    const i = Number(li.dataset.i);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = li.parentElement.children[i + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) next.focus();
    }
  });
  $('#songsInput').addEventListener('input', () => {
    const n = parse($('#songsInput').value).length;
    $('#liveCount').textContent = `· ${n}곡`;
    $('#bigCount').textContent = String(n).padStart(2,'0');
  });
  $('#makeBtn').addEventListener('click', make);
  $('#copyBtn').addEventListener('click', copy);
  $('#newBtn').addEventListener('click', () => setMode(state.mode === 'edit' ? 'list' : 'edit'));
  $('#tabSend').addEventListener('click', () => setMode('edit'));
  $('#tabList').addEventListener('click', () => setMode('list'));
  $('#tabApp').addEventListener('click', () => { setMode('list'); $('#apps').scrollIntoView({behavior:'smooth', block:'center'}); });
  window.addEventListener('hashchange', () => { state.data = readState(); state.sel = -1; render(); });

  if (!state.data) state.mode = 'edit';
  render();
})();
