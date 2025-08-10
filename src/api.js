const WIKI_TIMEOUT_MS = 9000;
const MBZ_TIMEOUT_MS  = 9000;

const withTimeout = (p, ms) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
]);

// (1) 위키 요약 텍스트(ko→en)
export async function fetchWikipediaSummary(title) {
  const enc = encodeURIComponent(title);
  const tryLang = async (lang) => {
    const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${enc}`);
    if (!r.ok) throw new Error('wiki fetch failed');
    return r.json();
  };
  try {
    const ko = await withTimeout(tryLang('ko'), WIKI_TIMEOUT_MS);
    return ko?.extract || ko?.description || '';
  } catch {
    try {
      const en = await withTimeout(tryLang('en'), WIKI_TIMEOUT_MS);
      return en?.extract || en?.description || '';
    } catch {
      return '';
    }
  }
}

// (1) MusicBrainz: 작품(work) + 작곡/작사가 관계 포함 → 첫 항목 반환
export async function searchMusicBrainzWork(title) {
  const url = `https://musicbrainz.org/ws/2/work/?query=${encodeURIComponent(title)}&inc=artist-rels&fmt=json`;
  const r = await withTimeout(fetch(url, { headers: { 'User-Agent': 'HeeinVocal/1.2 (demo)' } }), MBZ_TIMEOUT_MS);
  if (!r.ok) return null;
  const json = await r.json();
  return json?.works?.[0] || null;
}

// (1)+(2) 확장 정보: 위키 텍스트 + 언어 휴리스틱 → 스토리/기술 가이드
export async function fetchExtendedOperaInfo(title) {
  const extract = await fetchWikipediaSummary(title);
  const lang = inferLanguageFromTitle(title);
  const history = [
    extract ? `• 개요: ${extract}` : null,
    `• 추정 언어/레퍼토리: ${lang}`,
    '• 작곡가/작사가 해석 포인트: 텍스트의 감정선에 맞춰 프레이즈/다이내믹을 설계하고, 시대양식(바로크/벨칸토/낭만)에 부합하는 장식·루바토 범위를 선택합니다.',
  ].filter(Boolean).join('\n');

  const technical = buildTechniqueGuideByLang(lang);
  return { history, technical };
}

// (7) 업로드 음성 기초 분석 리포트
export async function analyzeVocalFile(file) {
  try {
    const stats = await analyzeAudioBasics(file);
    const lines = [];
    lines.push('— 성악 기초 분석 리포트 —');
    lines.push(`길이: ${stats.duration.toFixed(1)}초`);
    if (stats.meanPitchHz) lines.push(`평균 피치: ${stats.meanPitchHz.toFixed(1)} Hz`);
    if (stats.pitchStdevHz) lines.push(`음정 표준편차: ${stats.pitchStdevHz.toFixed(1)} Hz (낮을수록 안정적)`);
    if (stats.vibratoRateHz) lines.push(`비브라토 속도(추정): ${stats.vibratoRateHz.toFixed(2)} Hz (권장 5~7 Hz 비교)`);
    lines.push(`평균 라우드니스(RMS): ${stats.loudnessRms.toFixed(3)}`);
    lines.push('코칭: 최고음 2박 전부터 지지 강화, 모음 순도 유지, 불안정 구간은 느린 템포로 음절 길이 재배치.');
    return lines.join('\n');
  } catch (e) {
    console.warn('analyzeVocalFile error', e);
    return '오디오 분석에 실패했습니다. 파일 형식을 확인하거나 다시 시도해 주세요.';
  }
}

// ===== 내부 유틸 =====
function inferLanguageFromTitle(title) {
  if (/^[A-Za-z\s,'-]+$/.test(title)) return 'en/it (추정)';
  if (/[가-힣]/.test(title)) return 'ko';
  if (/[àèéìòóùç]/i.test(title) || /\bche|io|mio|cara|lascia\b/i.test(title)) return 'it';
  if (/[äöüß]/i.test(title)) return 'de';
  if (/[éèêâôûîç]/i.test(title) || /\bl'|d'|que\b/i.test(title)) return 'fr';
  return 'unknown';
}

function buildTechniqueGuideByLang(lang) {
  const tips = [];
  tips.push('• 호흡: 늑골 확장-복식호흡으로 호흡압 일정 유지, 말단 압박 금지.');
  if (lang === 'it' || /it/.test(lang)) tips.push('• 伊 딕션: 순모음 유지, 자음 이중자, 강세 박 모음 길이 주의.');
  if (lang === 'de') tips.push('• 德 딕션: 이중모음(ai, au, eu), 후설모음 원형화, 자음 클러스터 분리.');
  if (lang === 'fr') tips.push('• 仏 딕션: 비모음(ɑ̃, ɛ̃, ɔ̃, œ̃)과 리에종, 폐/개모음 대비.');
  if (lang === 'ko') tips.push('• 韓 딕션: 이중모음화 방지, 유음화/연음 주의, 과도한 혀 전진 억제.');
  tips.push('• 공명/포지션: 마스킹 활용으로 고역 밝기, 중저역은 구강공간 확보로 따뜻한 톤.');
  tips.push('• 스타일: 바로크(장식 절제), 벨칸토(legato·messa di voce), 낭만(넓은 루바토).');
  tips.push('• 연습: 최고음 직전 2박부터 준비, 직후 이완으로 과긴장 방지.');
  return tips.join('\n');
}

async function analyzeAudioBasics(file) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuf = await file.arrayBuffer();
  const audioBuf = await ctx.decodeAudioData(arrayBuf);
  const ch = audioBuf.getChannelData(0);
  const sr = audioBuf.sampleRate;

  const step = Math.max(1, Math.floor(sr / 22050));
  const data = new Float32Array(Math.floor(ch.length / step));
  for (let i = 0, j = 0; i < ch.length; i += step, j++) data[j] = ch[i];
  const dsr = sr / step;

  const winSize = Math.floor(dsr * 0.0464);
  const hop = Math.floor(dsr * 0.010);
  const fmin = 80, fmax = 1000;
  const lagMin = Math.floor(dsr / fmax), lagMax = Math.floor(dsr / fmin);

  const pitches = [], envelopes = [];
  for (let start = 0; start + winSize < data.length; start += hop) {
    let sum = 0; for (let i = 0; i < winSize; i++) { const v = data[start + i]; sum += v * v; }
    const rms = Math.sqrt(sum / winSize);
    envelopes.push(rms);
    let bestLag = 0, bestCorr = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let corr = 0;
      for (let i = 0; i < winSize - lag; i++) corr += data[start + i] * data[start + i + lag];
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    const freq = bestLag ? (dsr / bestLag) : 0;
    pitches.push(freq);
  }

  const pitchHzToCent = (f) => f > 0 ? 1200 * Math.log2(f / 440) : NaN;
  const cents = pitches.map(pitchHzToCent);
  const diff = cents.map((c, i) => (i > 0 && isFinite(c) && isFinite(cents[i-1])) ? c - cents[i-1] : 0);
  let zeroCross = 0; for (let i = 1; i < diff.length; i++) if ((diff[i-1] <= 0 && diff[i] > 0) || (diff[i-1] >= 0 && diff[i] < 0)) zeroCross++;
  const durationSec = data.length / dsr;
  const vibratoRate = durationSec > 0 ? (zeroCross / 2) / durationSec : 0;

  const valids = pitches.filter((f) => f > 0);
  const mean = valids.reduce((a,b)=>a+b,0) / Math.max(1, valids.length);
  const stdev = Math.sqrt(valids.reduce((a,b)=> a + Math.pow(b - mean, 2), 0) / Math.max(1, valids.length));
  const rmsAvg = envelopes.reduce((a,b)=>a+b,0) / Math.max(1, envelopes.length);

  return { duration: audioBuf.duration, meanPitchHz: mean||0, pitchStdevHz: stdev||0, vibratoRateHz: vibratoRate||0, loudnessRms: rmsAvg||0 };
}
