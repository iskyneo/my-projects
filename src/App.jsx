
  import React, { useEffect, useMemo, useState } from "react";
  import { createClient } from "@supabase/supabase-js";
  import { motion } from "framer-motion";
  import { Search, Upload, Youtube, Music2, Settings, BookOpen, Sparkles, FileAudio, Globe2, User, Users, Calendar, NotebookPen } from "lucide-react";

  const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  const dbKey = (k) => `heein-vocal-${k}`;
  const saveLocal = async (k, v) => localStorage.setItem(dbKey(k), JSON.stringify(v));
  const loadLocal = (k, d = null) => {
    try { return JSON.parse(localStorage.getItem(dbKey(k)) || "null") ?? d; } catch { return d; }
  };

  async function fetchWikipediaSummary(title) {
    const enc = encodeURIComponent(title);
    const tryLang = async (lang) => {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${enc}`);
      if (!r.ok) throw new Error("wiki");
      return r.json();
    };
    try { return await tryLang("ko"); } catch (e1) { try { return await tryLang("en"); } catch (e2) { return null; } }
  }

  async function searchMusicBrainzWork(title) {
    const url = `https://musicbrainz.org/ws/2/work/?query=${encodeURIComponent(title)}&fmt=json`;
    const r = await fetch(url, { headers: { "User-Agent": "HeeinVocal/1.0 (demo)" } });
    if (!r.ok) return null;
    return r.json();
  }

  async function searchYouTube(q, apiKey, maxResults = 8) {
    if (!apiKey) return [];
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(q)}&key=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const json = await r.json();
    return (json.items || []).map((it) => ({
      id: it.id.videoId,
      title: it.snippet.title,
      channel: it.snippet.channelTitle,
      thumb: it.snippet.thumbnails?.medium?.url,
      publishedAt: it.snippet.publishedAt,
    }));
  }

  function imslpSearchUrl(title) {
    return `https://imslp.org/index.php?title=Special:Search&search=${encodeURIComponent(title)}&go=Go`;
  }

  function AuthGate() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const onSend = async () => {
      if (!email) return;
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      setLoading(false);
      if (!error) setSent(true); else alert(error.message);
    };
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md border rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-2 text-xl font-bold"><Sparkles className="w-5 h-5" />혜인이의 성악 알아보카?</div>
          <p className="text-sm text-slate-600 mt-2">이메일을 입력하면 로그인 링크를 보내드려요. (비밀번호 필요 없음)</p>
          <div className="flex gap-2 mt-3">
            <input className="flex-1 border rounded px-3 py-2" type="email" placeholder="you@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
            <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" onClick={onSend} disabled={loading||sent}>{sent?"전송됨":"링크 받기"}</button>
          </div>
          <p className="text-xs text-slate-500 mt-2">메일함에서 발송 메일을 확인하고 링크를 클릭하세요.</p>
        </div>
      </div>
    );
  }

  export default function App() {
    const [title, setTitle] = useState("");
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState(null);
    const [mbz, setMbz] = useState(null);
    const [techTips, setTechTips] = useState("");
    const [pieces, setPieces] = useState(loadLocal("pieces", []));
    const [uploads, setUploads] = useState(loadLocal("uploads", []));
    const [apiKey, setApiKey] = useState(loadLocal("ytApiKey", ""));
    const [user, setUser] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
      let mounted = true;
      supabase.auth.getUser().then(({ data }) => mounted && setUser(data?.user || null));
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
      return () => { sub?.subscription?.unsubscribe?.(); mounted = false; };
    }, []);

    const activePiece = useMemo(() => pieces.find(p => p.title === query), [pieces, query]);

    useEffect(() => { saveLocal("pieces", pieces); }, [pieces]);
    useEffect(() => { saveLocal("uploads", uploads); }, [uploads]);
    useEffect(() => { saveLocal("ytApiKey", apiKey); }, [apiKey]);

    const onAnalyze = async () => {
      if (!title.trim()) return;
      setQuery(title.trim());
      setLoading(true);
      setSummary(null);
      setMbz(null);
      setTechTips("");

      const [sum, work] = await Promise.all([
        fetchWikipediaSummary(title.trim()),
        searchMusicBrainzWork(title.trim()),
      ]);
      setSummary(sum);
      setMbz(work);

      const baseTip = `• 호흡: 복식호흡 기반으로 프레이즈 말단까지 기류 유지
• 발성: 공명(마스킹/비성)과 후두 안정, 과긴장 방지
• 딕션: 언어별 장·단모음/강세/자음 이중자(예: 이탈리아어 [ɲ, ʎ]) 체크
• 음악적 포인트: 클라이맥스 대비 다이내믹 설계
• 해석: 텍스트 정서/서술 구조를 장면별로 구분해 표정·제스처와 결합`;
      setTechTips(baseTip);

      setPieces((prev) => prev.some(p => p.title === title.trim())
        ? prev
        : [{ id: crypto.randomUUID(), title: title.trim(), createdAt: Date.now() }, ...prev]
      );

      setLoading(false);
    };

    if (!user) return <AuthGate />;

    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              <h1 className="text-xl md:text-2xl font-bold">혜인이의 성악 알아보카?</h1>
            </div>
            <button className="p-2 rounded hover:bg-slate-100" onClick={()=>setSettingsOpen(!settingsOpen)} title="설정">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          {settingsOpen && (
            <div className="max-w-6xl mx-auto px-4 pb-3">
              <div className="border rounded-2xl bg-white p-4 grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm font-semibold mb-1">YouTube Data API 키</div>
                  <input className="w-full border rounded px-3 py-2" placeholder="AIza..." value={apiKey} onChange={(e)=>setApiKey(e.target.value)} />
                  <p className="text-xs text-slate-500 mt-1">키를 입력하면 영상 자동 추천이 활성화됩니다. (선택)</p>
                </div>
                <div className="text-xs text-blue-700">
                  <a className="underline mr-3" href="https://developers.google.com/youtube/v3" target="_blank" rel="noreferrer">YouTube API</a>
                  <a className="underline mr-3" href="https://www.mediawiki.org/wiki/API:REST_API" target="_blank" rel="noreferrer">Wikipedia API</a>
                  <a className="underline mr-3" href="https://musicbrainz.org/doc/Development/XML_Web_Service/Version_2" target="_blank" rel="noreferrer">MusicBrainz API</a>
                  <a className="underline" href="https://imslp.org" target="_blank" rel="noreferrer">IMSLP</a>
                </div>
              </div>
            </div>
          )}
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1 space-y-4">
            <div className="border rounded-2xl bg-white p-4 space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2"><Search className="w-4 h-4"/>성악곡 제목 입력</label>
              <div className="flex gap-2">
                <input className="flex-1 border rounded px-3 py-2" placeholder="예: O mio babbino caro / Lascia ch'io pianga / 그리운 금강산" value={title} onChange={(e)=>setTitle(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') onAnalyze(); }} />
                <button onClick={onAnalyze} className="px-3 py-2 rounded bg-black text-white">{loading?"분석 중...":"분석"}</button>
              </div>
              <p className="text-xs text-slate-500">정확한 제목이 아니어도 검색돼요. 한/영/伊 아무거나 가능.</p>
            </div>

            <RecentPieces pieces={pieces} onPick={(t)=>{ setTitle(t); setQuery(t); }} />
            <PracticePlanner pieceTitle={query} />
            <Notes piece={activePiece} onSave={(notes)=>{
              if(!activePiece) return;
              setPieces(prev=> prev.map(p => p.id===activePiece.id ? { ...p, notes } : p));
            }} />
          </div>

          <div className="md:col-span-2 space-y-4">
            <HistoryAndInterpretation query={query} loading={loading} summary={summary} mbz={mbz} />
            <TechniqueTips tips={techTips} />
            <ScoreFinder query={query} />
            <VideoFinder query={query} apiKey={apiKey} />
            <UploadsManager pieceTitle={query} uploads={uploads} setUploads={setUploads} />
            <Extras />
          </div>
        </main>

        <footer className="max-w-6xl mx-auto px-4 py-8 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} 혜인이 학습 도구 — 개인 학습 목적. 데이터 출처: Wikipedia, MusicBrainz, YouTube, IMSLP 등.</p>
        </footer>
      </div>
    );
  }

  function RecentPieces({ pieces, onPick }) {
    if (!pieces?.length) return (
      <div className="border rounded-2xl bg-white p-4 text-sm text-slate-500">최근 기록이 여기에 표시됩니다.</div>
    );
    return (
      <div className="border rounded-2xl bg-white p-4 space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4" />최근 검색/연습 곡</div>
        <div className="space-y-1">
          {pieces.map((p)=> (
            <button key={p.id} className="w-full text-left px-2 py-1 rounded hover:bg-slate-100" onClick={()=>onPick(p.title)}>
              <div className="text-sm font-medium">{p.title}</div>
              <div className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function HistoryAndInterpretation({ query, loading, summary, mbz }) {
    return (
      <div className="border rounded-2xl bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 text-lg font-semibold"><Globe2 className="w-5 h-5" /> (1) 역사적 스토리 & 작곡가/작사가 해석</div>
        {loading && <div className="text-sm text-slate-500">위키/뮤직브레인즈에서 정보를 불러오는 중…</div>}
        {summary && (
          <div className="space-y-2">
            <div className="text-base font-medium">{summary.title}</div>
            {summary.extract && <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary.extract}</p>}
            {summary.content_urls?.desktop?.page && (
              <a className="text-xs text-blue-600 underline" href={summary.content_urls.desktop.page} target="_blank" rel="noreferrer">Wikipedia 원문 보기</a>
            )}
          </div>
        )}
        {mbz?.works?.length ? (
          <div className="text-xs text-slate-600">
            <div className="font-semibold mb-1">MusicBrainz 검색 결과(작품 메타데이터):</div>
            <ul className="list-disc pl-5 space-y-1">
              {mbz.works.slice(0,5).map((w) => (
                <li key={w.id}>
                  <span className="font-medium">{w.title}</span>{" "}
                  {w["artist-relation-list"]?.length ? (
                    <span>— 작곡/관련: {w["artist-relation-list"].map((r)=> r.artist?.name).filter(Boolean).join(", ")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  function TechniqueTips({ tips }) {
    return (
      <div className="border rounded-2xl bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 text-lg font-semibold"><Music2 className="w-5 h-5" />(2) 곡의 특성 & 기술적 유의점</div>
        <pre className="text-sm whitespace-pre-wrap leading-relaxed">{tips}</pre>
        <p className="text-xs text-slate-500">※ 실제 곡 구조에 맞춘 세부 팁은 추후 자동생성으로 확장 가능합니다.</p>
      </div>
    );
  }

  function ScoreFinder({ query }) {
    return (
      <div className="border rounded-2xl bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="w-5 h-5" />(3) 악보</div>
        <div className="text-sm">아래 링크에서 공용 악보(퍼블릭 도메인/크리에이티브 커먼즈)를 우선 찾아보세요.</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a className="underline text-blue-600" href={imslpSearchUrl(query)} target="_blank" rel="noreferrer">IMSLP 검색로 이동</a>
          <a className="underline text-blue-600" href={`https://www.google.com/search?q=${encodeURIComponent(query + " score pdf")}`} target="_blank" rel="noreferrer">Google 악보 검색</a>
          <a className="underline text-blue-600" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query + " sheet music")}`} target="_blank" rel="noreferrer">YouTube 악보 영상</a>
        </div>
        <p className="text-xs text-slate-500">※ 일부 현대 작품은 저작권으로 무료 악보가 제공되지 않을 수 있습니다.</p>
      </div>
    );
  }

  function QuickVideoLinks({ query }) {
    const mk = (label, q) => (
      <a className="underline text-blue-600" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer">{label}</a>
    );
    return (
      <div className="flex flex-wrap gap-3 text-sm">
        {mk("세계 최정상 성악가", `${query} best soprano tenor baritone opera aria`)}
        {mk("한국 최고 성악가", `${query} 한국 성악가 무대 실황`)}
        {mk("중3 또래 학생들", `${query} middle school student competition`)}
      </div>
    );
  }

  function VideoBuckets({ globalBest, koreanBest, studentBest }) {
    const Section = ({ icon:Icon, title, items }) => (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-base font-semibold"><Icon className="w-4 h-4"/>{title}</div>
        {items?.length ? (
          <div className="grid md:grid-cols-3 gap-3">
            {items.map(v => (
              <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="block">
                <div className="rounded-xl overflow-hidden border hover:shadow">
                  {v.thumb && <img src={v.thumb} alt={v.title} className="w-full aspect-video object-cover"/>}
                  <div className="p-2">
                    <div className="text-sm font-medium line-clamp-2">{v.title}</div>
                    <div className="text-xs text-slate-500">{v.channel}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">검색 결과가 여기 표시돼요.</div>
        )}
      </div>
    );

    return (
      <div className="space-y-6">
        <Section icon={Globe2} title="세계 최고 라이브/스튜디오 실황" items={globalBest} />
        <Section icon={Users} title="한국 최고의 성악가" items={koreanBest} />
        <Section icon={User} title="중학교 3학년 또래 모음" items={studentBest} />
      </div>
    );
  }

  function VideoFinder({ query, apiKey }) {
    const [globalBest, setGlobalBest] = useState([]);
    const [koreanBest, setKoreanBest] = useState([]);
    const [studentBest, setStudentBest] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(()=>{
      let cancelled = false;
      (async () => {
        if (!apiKey) return;
        setLoading(true);
        const [g, k, s] = await Promise.all([
          searchYouTube(`${query} best performance opera aria`, apiKey, 8),
          searchYouTube(`${query} 한국 성악가`, apiKey, 6),
          searchYouTube(`${query} middle school student voice`, apiKey, 6),
        ]);
        if (!cancelled) {
          setGlobalBest(g);
          setKoreanBest(k);
          setStudentBest(s);
          setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [query, apiKey]);

    return (
      <div className="border rounded-2xl bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 text-lg font-semibold"><Youtube className="w-5 h-5"/>(4-6) 최고의 영상 모음</div>
        {!apiKey && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
            YouTube API 키가 없어도 아래 빠른 링크로 탐색할 수 있어요. 키를 넣으면 자동 추천이 활성화됩니다.
          </div>
        )}
        <QuickVideoLinks query={query} />
        {loading && <div className="text-sm text-slate-500">YouTube에서 영상을 불러오는 중…</div>}
        <VideoBuckets globalBest={globalBest} koreanBest={koreanBest} studentBest={studentBest} />
      </div>
    );
  }

  function UploadsManager({ pieceTitle, uploads, setUploads }) {
    const [uploading, setUploading] = useState(false);
    const list = uploads.filter(u => u.pieceId === pieceTitle);

    const onFile = async (e) => {
      const file = e.target.files?.[0];
      if (!file || !pieceTitle) return;
      setUploading(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${pieceTitle}/${fileName}`;
        const { error } = await supabase.storage.from('practice-uploads').upload(filePath, file, { upsert: false });
        if (error) throw error;
        const { data: pub } = supabase.storage.from('practice-uploads').getPublicUrl(filePath);
        const item = {
          id: crypto.randomUUID(),
          pieceId: pieceTitle,
          kind: file.type.startsWith('video') ? 'video' : 'audio',
          name: file.name,
          createdAt: Date.now(),
          size: file.size,
          url: pub?.publicUrl || ''
        };
        setUploads(prev => [item, ...prev]);
      } catch (err) {
        alert(err?.message || '업로드 실패');
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };

    const onRemove = async (id) => {
      const target = uploads.find(u => u.id === id);
      if (!target) return setUploads(prev => prev.filter(u => u.id !== id));
      // For simplicity, we only remove from UI; storage deletion could be added by tracking storage_path.
      setUploads(prev => prev.filter(u => u.id !== id));
    };

    return (
      <div className="border rounded-2xl bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 text-lg font-semibold"><Upload className="w-5 h-5"/>(7) 혜인이 연습 영상/음성 업로드 & 보관</div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer bg-slate-100 px-3 py-2 rounded-xl hover:bg-slate-200">
            <FileAudio className="w-4 h-4"/> 오디오/비디오 업로드
            <input type="file" accept="audio/*,video/*" className="hidden" onChange={onFile} />
          </label>
          {uploading && <span className="text-xs text-slate-500">업로드 중…</span>}
          <p className="text-xs text-slate-500">파일은 Supabase 스토리지에 저장됩니다. (버킷: practice-uploads)</p>
        </div>
        {list?.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {list.map(u => (
              <div key={u.id} className="rounded-xl border overflow-hidden">
                <div className="p-2 flex items-center justify-between text-sm">
                  <div className="font-medium line-clamp-1">{u.name}</div>
                  <button className="text-xs px-2 py-1 rounded hover:bg-slate-100" onClick={()=>onRemove(u.id)}>삭제</button>
                </div>
                <div className="p-2">
                  {u.kind === "video" ? (
                    <video controls className="w-full rounded">
                      <source src={u.url} />
                    </video>
                  ) : (
                    <audio controls className="w-full" src={u.url} />
                  )}
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3"/> {new Date(u.createdAt).toLocaleString()} · {(u.size/1024/1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">아직 업로드한 파일이 없어요.</div>
        )}
      </div>
    );
  }

  function Extras() {
    return (
      <div className="border rounded-2xl bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="w-5 h-5"/>(8) 추가 학습 도구</div>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>발음 가이드: 가사 붙여넣기 → IPA 메모 (향후 자동 변환)</li>
          <li>웹 메트로놈/튜너(추가 예정)</li>
          <li>프레이즈 플래너: 숨표 계획</li>
          <li>자기평가 체크리스트(호흡·발성·딕션·음정·리듬·표현)</li>
          <li>콘테스트/오디션 일정 캘린더(연동 예정)</li>
        </ul>
        <div className="text-xs text-slate-500">요청 시 단계적으로 확장해 드립니다.</div>
      </div>
    );
  }

  function PracticePlanner({ pieceTitle }) {
    const [plan, setPlan] = useState(loadLocal("plan", { minutes: 30, goal: "호흡+딕션", days:["Mon","Wed","Fri"] }));
    useEffect(()=>{ saveLocal("plan", plan); }, [plan]);
    return (
      <div className="border rounded-2xl bg-white p-4 space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2"><Calendar className="w-4 h-4" />연습 계획</div>
        <div className="grid grid-cols-3 gap-2 items-center text-sm">
          <label className="text-slate-600">하루 연습(분)</label>
          <input className="col-span-2 border rounded px-2 py-1" type="number" value={plan.minutes} onChange={(e)=>setPlan({...plan, minutes:+e.target.value})} />
          <label className="text-slate-600">목표</label>
          <input className="col-span-2 border rounded px-2 py-1" value={plan.goal} onChange={(e)=>setPlan({...plan, goal:e.target.value})} />
          <label className="text-slate-600">요일</label>
          <input className="col-span-2 border rounded px-2 py-1" value={plan.days.join(", ")} onChange={(e)=>setPlan({...plan, days:e.target.value.split(/\\s*,\\s*/g)})} />
        </div>
        <div className="text-xs text-slate-500">현재 곡: <b>{pieceTitle || "(미선택)"}</b></div>
      </div>
    );
  }

  function Notes({ piece, onSave }) {
    const [val, setVal] = useState(piece?.notes || "");
    useEffect(()=>{ setVal(piece?.notes || ""); }, [piece?.id]);
    if (!piece) return null;
    return (
      <div className="border rounded-2xl bg-white p-4 space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2"><NotebookPen className="w-4 h-4" />노트</div>
        <textarea className="w-full border rounded px-3 py-2" rows={6} placeholder="연습 메모, 선생님 피드백, 발성 이미지 등을 적어두세요." value={val} onChange={(e)=>setVal(e.target.value)} />
        <div className="flex justify-end"><button className="px-3 py-1 rounded bg-black text-white text-sm" onClick={()=>onSave(val)}>저장</button></div>
      </div>
    );
  }

<button
  onClick={async ()=>{
    try {
      const x = await fetchExtendedOperaInfo('O mio babbino caro');
      alert('확장 스토리 길이: ' + (x.history?.length || 0));
    } catch (e) { alert('API 호출 실패: ' + e.message); }
  }}
  style={{marginLeft:8, padding:'8px 10px'}}
>
  패치 진단
</button>
