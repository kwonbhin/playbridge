// Apple Music에서 곡의 정확한 링크를 찾아 주는 서버 함수 (Vercel)
// - 요청할 곳을 itunes.apple.com 한 곳으로 고정해 SSRF를 막고
// - 검색어 길이를 제한하고, 돌려주는 값도 music.apple.com 주소로만 제한한다.
const ALLOWED_PREFIX = 'https://music.apple.com/';

// 곡 링크(music.apple.com/kr/album/이름/앨범번호?i=곡번호)를
// 애플 공식 웹 플레이어 주소(embed.music.apple.com/...)로 바꾼다. 형식이 다르면 null.
function toEmbed(url, trackId){
  try {
    const u = new URL(url);
    const id = String(trackId || u.searchParams.get('i') || '');
    if (u.hostname !== 'music.apple.com' || !/^\/[a-z]{2}\/album\/[^?#]+\/\d+$/.test(u.pathname) || !/^\d{1,15}$/.test(id)) return null;
    return `https://embed.music.apple.com${u.pathname}?i=${id}`;
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  if (req.method !== 'GET') { res.status(405).json({ error: 'method' }); return; }

  const term = typeof req.query.term === 'string' ? req.query.term.trim() : '';
  if (!term || term.length > 200) { res.status(400).json({ error: 'term' }); return; }

  const api = new URL('https://itunes.apple.com/search');
  api.search = new URLSearchParams({ term, country: 'kr', entity: 'song', limit: '1', lang: 'ko_kr' }).toString();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(api, { signal: ctrl.signal, redirect: 'error', headers: { accept: 'application/json' } });
    if (!r.ok) { res.status(502).json({ error: 'upstream' }); return; }
    const data = await r.json();
    const song = data && Array.isArray(data.results) ? data.results[0] : null;
    const url = song && typeof song.trackViewUrl === 'string' ? song.trackViewUrl : '';
    if (!url.startsWith(ALLOWED_PREFIX)) { res.status(200).json({ url: null, embed: null }); return; }
    res.status(200).json({
      url,
      embed: toEmbed(url, song.trackId),
      title: typeof song.trackName === 'string' ? song.trackName.slice(0, 150) : '',
      artist: typeof song.artistName === 'string' ? song.artistName.slice(0, 100) : ''
    });
  } catch {
    res.status(504).json({ error: 'timeout' });
  } finally {
    clearTimeout(timer);
  }
};
