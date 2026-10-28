/* 雙手鍵盤教室 · 主程式（學生版和老師版共用）
   曲譜資料在 songs.js；外觀在 style.css。 */
(function(){
"use strict";

const NS = "http://www.w3.org/2000/svg";
const SOLFEGE = {C:"Do", D:"Re", E:"Mi", F:"Fa", G:"Sol", A:"La", B:"Si"};
const SOLFEGE_ZH = {C:"ㄉㄡ", D:"ㄖㄨㄟ", E:"ㄇㄧ", F:"ㄈㄚ", G:"ㄙㄡ", A:"ㄌㄚ", B:"ㄒㄧ"};
const SOL_VAR = {C:"--do", D:"--re", E:"--mi", F:"--fa", G:"--sol", A:"--la", B:"--si"};
const CHORD_VAR = {C:"--do", F:"--fa", G:"--sol", A:"--la"};
const CHORD_NAME = {C:"C", F:"F", G:"G", A:"Am"};
function cname(c){ return CHORD_NAME[c] || c; }
const LEFT_OCT = {C:3, F:3, G:3, A:2};
const DEFAULT_FINGER = {C:1, D:2, E:3, F:4, G:5, A:5, B:5};
const LEFT_FINGER = {C:5, F:2, G:1, A:5};
const SEMI = {C:0, D:2, E:4, F:5, G:7, A:9, B:11};

/* ===== 曲譜資料來自 songs.js ===== */
const DATA = window.SONG_DATA || { lessons:[], songs:[] };
const LESSONS = DATA.lessons;
const SONGS = DATA.songs;
const APP_VERSION = "1.0";
const IS_TEACHER = document.body.getAttribute("data-role") === "teacher";

/* 保存原始資料，供「恢復這首原廠設定」使用 */
const ORIGINAL_BARS = {};
SONGS.forEach(function(s){
  ORIGINAL_BARS[s.id] = s.bars.map(function(b){ return {r:b.r, l:b.l, a:b.a}; });
  if(!Array.isArray(s.chords) || !s.chords.length) s.chords = chordsOf(s.bars);
});

/* ===== 自訂樂譜（編輯器存到 localStorage 的內容） ===== */
const CUSTOM_KEY = "shuangshou-custom-songs-v1";
function barsKey(bars){
  return JSON.stringify(bars.map(function(b){ return [String(b.r||"").trim(), String(b.l||"").trim(), b.a || "w"]; }));
}
function chordsOf(bars){
  const seen = [];
  bars.forEach(function(b){
    String(b.l).split("|").forEach(function(c){ if(c && seen.indexOf(c) < 0) seen.push(c); });
  });
  return seen;
}
function loadCustomSongs(){
  if(!IS_TEACHER) return;
  try{
    const o = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "null");
    if(!o) return;
    let cleaned = false;
    Object.keys(o).forEach(function(id){
      const song = SONGS.find(function(s){ return s.id === id; });
      if(!song || !Array.isArray(o[id]) || !o[id].length){ delete o[id]; cleaned = true; return; }
      if(barsKey(o[id]) === barsKey(song.bars)){ delete o[id]; cleaned = true; return; }
      song.bars = o[id].map(function(b){
        const bar = { r: String(b.r || ""), l: String(b.l || "C") };
        if(b.a && b.a !== "w") bar.a = b.a;
        return bar;
      });
      song.chords = chordsOf(song.bars);
      song.customized = true;
    });
    if(cleaned) localStorage.setItem(CUSTOM_KEY, JSON.stringify(o));
  }catch(e){}
}
loadCustomSongs();

function parseBar(str){
  const toks = String(str).trim().split(/\s+/);
  const out = [], bad = [];
  if(!toks.length || toks.length === 1) { bad.push("格式要「音高 拍值」成對出現"); return {notes:out, bad:bad}; }
  if(toks.length % 2) bad.push("音和拍值數量對不起來");
  for(let i=0;i+1<toks.length;i+=2){
    const raw = toks[i];
    const dur = parseFloat(toks[i+1]);
    if(!(dur > 0)){ bad.push("拍值「"+toks[i+1]+"」看不懂"); continue; }
    if(/^R$/i.test(raw)){ out.push({rest:true, dur:dur}); continue; }
    const parts = raw.split("/");
    const m = /^([A-G])(#?)(\d)$/.exec(parts[0]);
    if(!m){ bad.push("音高「"+raw+"」看不懂"); continue; }
    out.push({
      pc:m[1], acc:m[2]==="#", oct:parseInt(m[3],10),
      dur: dur,
      finger: parts[1] ? parseInt(parts[1],10) : null
    });
  }
  return {notes:out, bad:bad};
}

const VOICING = {
  C:[{pc:"C",oct:3,midi:48,f:5},{pc:"E",oct:3,midi:52,f:3},{pc:"G",oct:3,midi:55,f:1}],
  F:[{pc:"C",oct:3,midi:48,f:5},{pc:"F",oct:3,midi:53,f:3},{pc:"A",oct:3,midi:57,f:1}],
  G:[{pc:"B",oct:2,midi:47,f:5},{pc:"D",oct:3,midi:50,f:3},{pc:"G",oct:3,midi:55,f:1}],
  A:[{pc:"A",oct:2,midi:45,f:5},{pc:"C",oct:3,midi:48,f:3},{pc:"E",oct:3,midi:52,f:1}]
};
const ARP_CYCLE = [0,1,2,1];
function buildLeftItems(chords, pattern){
  const seg = 4 / chords.length, items = [];
  chords.forEach(function(ch, k){
    const b0 = k * seg, v = VOICING[ch];
    if(v && (pattern === "q" || pattern === "e")){
      const step = pattern === "q" ? 1 : 0.5;
      const n = Math.round(seg / step);
      const cyc = (pattern === "q" && seg === 2) ? [0,2] : ARP_CYCLE;
      for(let i = 0; i < n; i++){
        items.push({beat:b0 + i*step, dur:step, chord:ch, style:pattern, first:i === 0, notes:[v[cyc[i % cyc.length]]]});
      }
    }else if(v && pattern === "c"){
      items.push({beat:b0, dur:seg, chord:ch, style:"c", first:true, notes:v.slice()});
    }else{
      items.push({beat:b0, dur:seg, chord:ch, style:"w", legacy:true, first:true,
        notes:[{pc:ch, oct:LEFT_OCT[ch] || 3, f:LEFT_FINGER[ch] || 5}]});
    }
  });
  return items;
}

/* 解析一首曲子（給初始化和編輯器套用後重算用） */
function parseSongForDraw(song, collectProblems){
  const problems = [];
  song.parsed = song.bars.map(function(b, bi){
    const p = parseBar(b.r);
    const where = "《"+song.title+"》第 "+(bi+1)+" 小節：";
    p.bad.forEach(function(msg){ problems.push(where + msg); });
    const sum = p.notes.reduce(function(a,n){ return a + n.dur; }, 0);
    if(Math.abs(sum - 4) > 1e-6) problems.push(where + "右手共 "+sum+" 拍，應該是 4 拍");
    p.notes.forEach(function(n){
      if(n.rest) return;
      if(n.oct !== 4 || n.acc) problems.push(where + n.pc+(n.acc?"#":"")+n.oct+" 超出鍵盤範圍（Do4–Si4 白鍵）");
    });
    const left = b.l.split("|");
    left.forEach(function(c){
      if(!/^[CFGA]$/.test(c)) problems.push(where + "左手和弦「"+c+"」只能用 C、F、G、A（A 代表 Am）");
    });
    const pat = b.a || "w";
    if(["w","q","e","c"].indexOf(pat) < 0) problems.push(where + "左手樣式「"+pat+"」只能用 w、q、e、c");
    return { right: p.notes, left: left, pattern: pat, leftItems: buildLeftItems(left, pat) };
  });
  song.hasArp = song.parsed.some(function(b){ return b.pattern !== "w"; });
  if(collectProblems) problems.forEach(function(p){ SONG_PROBLEMS.push(p); });
  return problems;
}

const SONG_PROBLEMS = [];
SONGS.forEach(function(s){ parseSongForDraw(s, true); });

const LS_KEY = "shuangshou-keyboard-v1";

const state = {
  song: 0,
  bpm: 72,
  rhythm: "march",
  mode: "listen",
  follow: true,
  solfegeSys: "do",
  showPills: true,
  voices: { right:true, left:true, accomp:true, click:false },
  mix: { melody:70, chord:65, accomp:55, drums:50, click:45, master:70 },
  muted:{ melody:false, chord:false, accomp:false, drums:false, click:false, master:false },
  sustain: true,
  selA: null,
  selB: null,
  ladder: { on:false, step:4, max:100 }
};

function sol(pc){ return (state.solfegeSys === "zhuyin" ? SOLFEGE_ZH : SOLFEGE)[pc] || pc; }
function pillW(s){ return Math.max(24, 12 + s.length * 7); }
function escHTML(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

const PROG_KEY = "shuangshou-progress-v1";
const progress = { students:["全班"], cur:"全班", done:{} };
function loadProgress(){
  try{
    const o = JSON.parse(localStorage.getItem(PROG_KEY) || "null");
    if(!o) return;
    if(Array.isArray(o.students) && o.students.length) progress.students = o.students.filter(function(s){ return typeof s === "string" && s; });
    if(!progress.students.length) progress.students = ["全班"];
    if(typeof o.cur === "string" && progress.students.indexOf(o.cur) >= 0) progress.cur = o.cur;
    else progress.cur = progress.students[0];
    if(o.done && typeof o.done === "object") progress.done = o.done;
  }catch(e){}
}
function saveProgress(){ try{ localStorage.setItem(PROG_KEY, JSON.stringify(progress)); }catch(e){} }
function doneBars(songId){
  const st = progress.done[progress.cur] || {};
  return Array.isArray(st[songId]) ? st[songId] : [];
}
function toggleDone(songId, bi){
  const st = progress.done[progress.cur] = progress.done[progress.cur] || {};
  const list = Array.isArray(st[songId]) ? st[songId] : [];
  const k = list.indexOf(bi);
  if(k >= 0) list.splice(k, 1); else list.push(bi);
  st[songId] = list;
  saveProgress();
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    const o = JSON.parse(raw);
    if(typeof o.bpm === "number") state.bpm = Math.min(120, Math.max(50, o.bpm));
    if(typeof o.rhythm === "string") state.rhythm = o.rhythm;
    if(typeof o.follow === "boolean") state.follow = o.follow;
    if(typeof o.showPills === "boolean") state.showPills = o.showPills;
    if(o.solfegeSys === "zhuyin" || o.solfegeSys === "do") state.solfegeSys = o.solfegeSys;
    if(o.mix && typeof o.mix === "object"){
      Object.keys(state.mix).forEach(function(k){
        if(typeof o.mix[k] === "number") state.mix[k] = Math.min(100, Math.max(0, o.mix[k]));
      });
    }
    if(typeof o.sustain === "boolean") state.sustain = o.sustain;
    if(o.ladder && typeof o.ladder === "object"){
      if(typeof o.ladder.on === "boolean") state.ladder.on = o.ladder.on;
      if(typeof o.ladder.step === "number") state.ladder.step = o.ladder.step;
      if(typeof o.ladder.max === "number") state.ladder.max = o.ladder.max;
    }
    if(o.voices && typeof o.voices === "object"){
      Object.keys(state.voices).forEach(function(k){
        if(typeof o.voices[k] === "boolean") state.voices[k] = o.voices[k];
      });
    }
  }catch(e){}
}
function saveState(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify({
      bpm: state.bpm, rhythm: state.rhythm, follow: state.follow,
      solfegeSys: state.solfegeSys, showPills: state.showPills,
      mix: state.mix, voices: state.voices, sustain: state.sustain,
      ladder: state.ladder
    }));
  }catch(e){}
}

let ac = null;
const audio = {};
let noiseBuf = null;
let activeSources = [];

function initAudio(){
  if(ac) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  ac = new Ctx();
  audio.master = ac.createGain();
  audio.master.connect(ac.destination);
  ["melody","chord","accomp","drums","click"].forEach(function(k){
    const g = ac.createGain();
    g.connect(audio.master);
    audio[k] = g;
  });
  const len = Math.floor(ac.sampleRate * 0.6);
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for(let i=0;i<len;i++) d[i] = Math.random()*2 - 1;
}
function resumeAudio(){
  if(!ac) initAudio();
  if(ac.state === "suspended") ac.resume();
}

function midiToFreq(m){ return 440 * Math.pow(2, (m-69)/12); }
function pitchToMidi(pc, oct){ return 12*(oct+1) + SEMI[pc]; }
function volCurve(v){ return Math.pow(v/70, 2); }

function applyMix(){
  if(!ac) return;
  function g(key, voice){
    if(state.muted[key]) return 0;
    if(voice !== undefined && !voice) return 0;
    return volCurve(state.mix[key]);
  }
  audio.melody.gain.value = g("melody", state.voices.right);
  audio.chord.gain.value  = g("chord",  state.voices.left);
  audio.accomp.gain.value = g("accomp", state.voices.accomp);
  audio.drums.gain.value  = g("drums");
  audio.click.gain.value  = g("click",  state.voices.click);
  audio.master.gain.value = g("master");
}

function trackSource(node, stopAt){
  activeSources.push({node:node, stopAt:stopAt});
  if(activeSources.length > 500) activeSources = activeSources.slice(-400);
}
function stopAllSources(){
  const now = ac ? ac.currentTime : 0;
  activeSources.forEach(function(s){ try{ s.node.stop(now); }catch(e){} });
  activeSources = [];
}

function pianoNote(midi, t, dur, dest){
  const f = midiToFreq(midi);
  const o1 = ac.createOscillator(); o1.type = "triangle"; o1.frequency.value = f;
  const o2 = ac.createOscillator(); o2.type = "sine";     o2.frequency.value = f*2;
  const o3 = ac.createOscillator(); o3.type = "sine";     o3.frequency.value = f*3.01;
  const g2 = ac.createGain(); g2.gain.value = 0.30;
  const g3 = ac.createGain(); g3.gain.value = 0.09;
  const flt = ac.createBiquadFilter();
  flt.type = "lowpass"; flt.Q.value = 0.6;
  flt.frequency.setValueAtTime(Math.min(7000, 2600 + f*3.2), t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(500, f*2.2), t + Math.max(0.35, dur*0.9));
  const env = ac.createGain();
  const peak = 0.20;
  const a = t + 0.005;
  const dEnd = t + 0.13;
  const eEnd = t + Math.max(dur, 0.22);
  const rEnd = eEnd + 0.32;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, a);
  env.gain.exponentialRampToValueAtTime(peak*0.42, dEnd);
  env.gain.exponentialRampToValueAtTime(Math.max(peak*0.14, 0.0002), eEnd);
  env.gain.exponentialRampToValueAtTime(0.0001, rEnd);
  o1.connect(flt); o2.connect(g2); g2.connect(flt); o3.connect(g3); g3.connect(flt);
  flt.connect(env); env.connect(dest);
  const stopAt = rEnd + 0.06;
  o1.start(t); o2.start(t); o3.start(t);
  o1.stop(stopAt); o2.stop(stopAt); o3.stop(stopAt);
  trackSource(o1, stopAt); trackSource(o2, stopAt); trackSource(o3, stopAt);
}
function kick(t, dest){
  const o = ac.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.75, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.33);
  trackSource(o, t + 0.33);
}
function hat(t, dest, len, amp){
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6500;
  const g = ac.createGain();
  g.gain.setValueAtTime(amp, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t); s.stop(t + len + 0.03);
  trackSource(s, t + len + 0.03);
}
function clickSound(t, dest, strong){
  const o = ac.createOscillator(); o.type = "square";
  o.frequency.value = strong ? 1600 : 1100;
  const g = ac.createGain();
  const amp = strong ? 0.16 : 0.10;
  g.gain.setValueAtTime(amp, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.08);
  trackSource(o, t + 0.08);
}

/* 樂譜繪製 */
const STEP_IDX = {C:0, D:1, E:2, F:3, G:4, A:5, B:6};
function dIndex(pc, oct){ return oct*7 + STEP_IDX[pc]; }
const TREBLE_E4 = dIndex("E",4);
const BASS_A3   = dIndex("A",3);
const TREBLE_TOP = 38;
let BASS_TOP = 120;
function yTreble(pc, oct){ return TREBLE_TOP + 40 - (dIndex(pc,oct) - TREBLE_E4)*5; }
function yBass(pc, oct){   return BASS_TOP - (dIndex(pc,oct) - BASS_A3)*5; }
const NOTE_SOLFEGE_ROW = 100;
let LEFT_LABEL_Y = 176, SYS_H = 212, CK_Y = 198, DIGIT_Y = 168, HL_H = 145;
function setLayout(arp){
  BASS_TOP = arp ? 144 : 120;
  LEFT_LABEL_Y = BASS_TOP + (arp ? 70 : 56);
  DIGIT_Y = BASS_TOP + 56;
  CK_Y = BASS_TOP + (arp ? 86 : 78);
  SYS_H = BASS_TOP + (arp ? 100 : 92);
  HL_H = LEFT_LABEL_Y - (arp ? 24 : 31);
}
const LEFT_PAD = 46;
const RIGHT_PAD = 8;
const scoreEls = { bars: [], noteList: [], noteMap: new Map() };
function r1(n){ return Math.round(n*10)/10; }

function solfegePillSVG(x, y, pc){
  const s = sol(pc);
  const w = pillW(s);
  return '<rect x="'+r1(x-w/2)+'" y="'+(y-7)+'" width="'+w+'" height="14" rx="7" fill="var('+SOL_VAR[pc]+')"/>' +
         '<text class="solfege-pill" x="'+r1(x)+'" y="'+(y+3)+'" text-anchor="middle">'+s+'</text>';
}

function buildSystem(svgParts, firstBar, count, perLine, W){
  const barW = (W - LEFT_PAD - RIGHT_PAD) / perLine;
  svgParts.push('<svg class="score-svg" viewBox="0 0 '+W+' '+SYS_H+'" width="'+W+'" height="'+SYS_H+'" xmlns="'+NS+'">');
  const staffY = [0,10,20,30,40];
  let s = "";
  for(let i=0;i<5;i++){
    s += '<line class="staff-line" x1="'+(LEFT_PAD-6)+'" y1="'+(TREBLE_TOP+staffY[i])+'" x2="'+(W-RIGHT_PAD)+'" y2="'+(TREBLE_TOP+staffY[i])+'"/>';
    s += '<line class="staff-line" x1="'+(LEFT_PAD-6)+'" y1="'+(BASS_TOP+staffY[i])+'" x2="'+(W-RIGHT_PAD)+'" y2="'+(BASS_TOP+staffY[i])+'"/>';
  }
  s += '<text class="clef" x="'+(LEFT_PAD-38)+'" y="'+(TREBLE_TOP+42)+'" font-size="46">&#119070;</text>';
  s += '<text class="clef" x="'+(LEFT_PAD-38)+'" y="'+(BASS_TOP+27)+'" font-size="34">&#119074;</text>';
  svgParts.push(s);

  for(let i=0;i<count;i++){
    const bi = firstBar + i;
    const song = SONGS[state.song];
    const bar = song.parsed[bi];
    const x0 = LEFT_PAD + i*barW;
    const inner = barW - 22;
    const beatW = inner / 4;
    const beatX = function(b){ return x0 + 11 + b*beatW + beatW*0.5; };

    svgParts.push('<rect class="bar-hl" data-hlbar="'+bi+'" x="'+r1(x0)+'" y="30" width="'+r1(barW)+'" height="'+HL_H+'" rx="6"/>');
    svgParts.push('<text class="bar-num" x="'+r1(x0+3)+'" y="16">'+(bi+1)+'</text>');

    const chordList = bar.left;
    const segBeats = 4 / chordList.length;
    chordList.forEach(function(ch, k){
      const gx = beatX(k*segBeats);
      svgParts.push('<line class="beat-guide" x1="'+r1(gx)+'" y1="'+(TREBLE_TOP-2)+'" x2="'+r1(gx)+'" y2="'+(BASS_TOP+42)+'"/>');
      svgParts.push(chordPill(gx, 14, ch));
    });

    const pairInfo = {};
    let acc = 0;
    for(let k = 0; k < bar.right.length; k++){
      const n0 = bar.right[k], n1 = bar.right[k+1];
      const onBeat = Math.abs(acc - Math.round(acc)) < 1e-9;
      if(!n0.rest && n0.dur === 0.5 && onBeat && n1 && !n1.rest && n1.dur === 0.5){
        pairInfo[k] = {first:true}; pairInfo[k+1] = {second:true};
        acc += 1; k++; continue;
      }
      acc += n0.dur;
    }

    let beat = 0;
    bar.right.forEach(function(n, ni){
      const x = beatX(beat);
      if(n.rest){
        svgParts.push(drawRest(x, n.dur));
        beat += n.dur;
        return;
      }
      const y = yTreble(n.pc, n.oct);
      const pi = pairInfo[ni];
      let nopt = null;
      if(pi && pi.first){
        const m = bar.right[ni+1];
        const xb = beatX(beat + n.dur), yb0 = yTreble(m.pc, m.oct);
        const up = ((y + yb0) / 2) > (TREBLE_TOP + 20);
        const sxa = up ? x + 4.6 : x - 4.6, sxb = up ? xb + 4.6 : xb - 4.6;
        const ta = up ? y - 30 : y + 30, tb = up ? yb0 - 30 : yb0 + 30;
        const slope = Math.max(-8, Math.min(8, tb - ta));
        const A = up ? Math.min(ta, tb - slope) : Math.max(ta, tb - slope);
        const geom = {up:up, sxa:sxa, sxb:sxb, A:A, B:A + slope};
        pi.geom = geom; pairInfo[ni+1].geom = geom;
        nopt = {stemUp:up, tip:geom.A, noFlag:true};
      }else if(pi && pi.second){
        nopt = {stemUp:pi.geom.up, tip:pi.geom.B, noFlag:true};
      }
      svgParts.push(drawNote(x, y, n.dur, "treble", nopt));
      const fing = n.finger || DEFAULT_FINGER[n.pc];
      svgParts.push('<text class="fing-text" x="'+r1(x)+'" y="'+r1(y-9)+'" text-anchor="middle">'+fing+'</text>');
      if(state.showPills) svgParts.push(solfegePillSVG(x, NOTE_SOLFEGE_ROW, n.pc));
      svgParts.push('<rect x="'+r1(x-8)+'" y="'+r1(y-8)+'" width="16" height="16" fill="none" class="note-anchor" data-hand="right" data-bar="'+bi+'" data-idx="'+ni+'"/>');
      if(pi && pi.second){
        const q = pi.geom, th = q.up ? 4 : -4;
        svgParts.push('<polygon class="beam" points="'+r1(q.sxa-0.8)+','+r1(q.A)+' '+r1(q.sxb+0.8)+','+r1(q.B)+' '+r1(q.sxb+0.8)+','+r1(q.B+th)+' '+r1(q.sxa-0.8)+','+r1(q.A+th)+'"/>');
      }
      beat += n.dur;
    });

    const items = bar.leftItems;
    function leftAnchor(x, y, idx){
      return '<rect x="'+r1(x-8)+'" y="'+r1(y-8)+'" width="16" height="16" fill="none" class="note-anchor" data-hand="left" data-bar="'+bi+'" data-idx="'+idx+'"/>';
    }
    function leftExtras(it, x){
      let out = "";
      if(it.legacy){
        const nt = it.notes[0];
        out += '<text class="left-label" x="'+r1(x)+'" y="'+LEFT_LABEL_Y+'" text-anchor="middle">'+sol(nt.pc)+' '+circleNum(nt.f)+'</text>';
        return out;
      }
      const digits = it.notes.map(function(nt){ return nt.f; }).join("·");
      out += '<text class="left-fing" x="'+r1(x)+'" y="'+DIGIT_Y+'" text-anchor="middle">'+digits+'</text>';
      if(it.first){
        out += '<text class="left-label" x="'+r1(x)+'" y="'+LEFT_LABEL_Y+'" text-anchor="middle">'+sol(it.chord)+(it.style === "c" ? ' 和弦' : ' 琶音')+'</text>';
      }
      return out;
    }
    let li = 0;
    while(li < items.length){
      const it = items[li];
      if(it.style === "e"){
        const win = Math.floor(it.beat / 2 + 1e-9);
        const grp = [];
        while(li < items.length && items[li].style === "e" && Math.floor(items[li].beat / 2 + 1e-9) === win){
          grp.push({it:items[li], idx:li}); li++;
        }
        const ys = grp.map(function(g){ return yBass(g.it.notes[0].pc, g.it.notes[0].oct); });
        const tip = Math.min.apply(null, ys) - 26;
        let sxFirst = 0, sxLast = 0;
        grp.forEach(function(g, gi){
          const x = beatX(g.it.beat), y = ys[gi];
          svgParts.push(drawNote(x, y, 0.5, "bass", {stemUp:true, tip:tip, noFlag:true}));
          svgParts.push(leftExtras(g.it, x));
          svgParts.push(leftAnchor(x, y, g.idx));
          if(gi === 0) sxFirst = x + 4.6;
          sxLast = x + 4.6;
        });
        if(grp.length > 1){
          svgParts.push('<polygon class="beam" points="'+r1(sxFirst-0.8)+','+r1(tip)+' '+r1(sxLast+0.8)+','+r1(tip)+' '+r1(sxLast+0.8)+','+r1(tip+4)+' '+r1(sxFirst-0.8)+','+r1(tip+4)+'"/>');
        }
        continue;
      }
      const x = beatX(it.beat);
      if(it.style === "c"){
        let inner = "";
        it.notes.forEach(function(nt, k){
          const y = yBass(nt.pc, nt.oct);
          inner += drawNote(x, y, it.dur, "bass", {noStem: k > 0}).replace('<g class="note-group">','').replace(/<\/g>$/,'');
        });
        svgParts.push('<g class="note-group">'+inner+'</g>');
        svgParts.push(leftExtras(it, x));
        const my = yBass(it.notes[1].pc, it.notes[1].oct);
        svgParts.push(leftAnchor(x, my, li));
      }else{
        const nt = it.notes[0];
        const y = yBass(nt.pc, nt.oct);
        svgParts.push(drawNote(x, y, it.dur, "bass"));
        svgParts.push(leftExtras(it, x));
        svgParts.push(leftAnchor(x, y, li));
      }
      li++;
    }

    svgParts.push('<line class="barline" x1="'+r1(x0)+'" y1="'+TREBLE_TOP+'" x2="'+r1(x0)+'" y2="'+(TREBLE_TOP+40)+'"/>');
    svgParts.push('<line class="barline" x1="'+r1(x0)+'" y1="'+BASS_TOP+'" x2="'+r1(x0)+'" y2="'+(BASS_TOP+40)+'"/>');
    svgParts.push('<rect class="bar-hit" data-bar="'+bi+'" x="'+r1(x0)+'" y="30" width="'+r1(barW)+'" height="'+(HL_H+3)+'"/>');

    const done = doneBars(song.id).indexOf(bi) >= 0;
    const ckx = x0 + barW - 14, cky = CK_Y;
    svgParts.push('<rect class="bar-done'+(done?' on':'')+'" data-donebar="'+bi+'" x="'+r1(x0+2)+'" y="30" width="'+r1(barW-4)+'" height="'+HL_H+'" rx="6"/>');
    svgParts.push(
      '<g class="bar-check'+(done?' on':'')+'" data-check="'+bi+'" role="button" tabindex="0" aria-pressed="'+done+'" aria-label="第 '+(bi+1)+' 小節老師確認">' +
      '<circle cx="'+r1(ckx)+'" cy="'+cky+'" r="11" class="ck-hit"/>' +
      '<circle cx="'+r1(ckx)+'" cy="'+cky+'" r="7.5" class="ck-ring"/>' +
      '<path class="ck-mark" d="M '+r1(ckx-3.6)+' '+(cky+0.2)+' l 2.6 2.7 l 4.8 -5.4"/>' +
      '</g>'
    );
  }

  const endX = LEFT_PAD + count*barW;
  svgParts.push('<line class="barline" x1="'+r1(endX)+'" y1="'+TREBLE_TOP+'" x2="'+r1(endX)+'" y2="'+(TREBLE_TOP+40)+'"/>');
  svgParts.push('<line class="barline" x1="'+r1(endX)+'" y1="'+BASS_TOP+'" x2="'+r1(endX)+'" y2="'+(BASS_TOP+40)+'"/>');
  svgParts.push('<line class="barline" x1="'+r1(endX-3)+'" y1="'+TREBLE_TOP+'" x2="'+r1(endX-3)+'" y2="'+(TREBLE_TOP+40)+'"/>');
  svgParts.push('<line class="barline" x1="'+r1(endX-3)+'" y1="'+BASS_TOP+'" x2="'+r1(endX-3)+'" y2="'+(BASS_TOP+40)+'"/>');
  svgParts.push("</svg>");
}

function drawRest(x, dur){
  const T = TREBLE_TOP;
  let s = "";
  const base = dur >= 3 && dur < 4 ? 2 : (dur >= 1.5 && dur < 2 ? 1 : dur);
  if(dur >= 4){
    s += '<rect class="rest-block" x="'+r1(x-6)+'" y="'+(T+10)+'" width="12" height="5"/>';
  }else if(base === 2){
    s += '<rect class="rest-block" x="'+r1(x-6)+'" y="'+(T+15)+'" width="12" height="5"/>';
  }else if(base === 1){
    s += '<text class="rest-glyph" x="'+r1(x)+'" y="'+(T+30)+'" text-anchor="middle" font-size="30">&#119101;</text>';
  }else{
    s += '<text class="rest-glyph" x="'+r1(x)+'" y="'+(T+27)+'" text-anchor="middle" font-size="30">&#119102;</text>';
  }
  if(dur === 3 || dur === 1.5) s += '<circle class="dot-note" cx="'+r1(x+10)+'" cy="'+(T+15)+'" r="1.6"/>';
  return '<g class="rest">'+s+(state.showPills ? '<text class="rest-label" x="'+r1(x)+'" y="'+(NOTE_SOLFEGE_ROW+3)+'" text-anchor="middle">休息</text>' : '')+'</g>';
}

function chordPill(cx, cy, ch){
  const v = CHORD_VAR[ch] || "--muted";
  const label = cname(ch);
  const w = Math.max(26, 10 + label.length * 7), h = 16;
  return '<rect x="'+r1(cx-w/2)+'" y="'+r1(cy-h/2)+'" width="'+w+'" height="'+h+'" rx="8" fill="var('+v+')"/>' +
         '<text class="chord-pill" x="'+r1(cx)+'" y="'+r1(cy+4)+'" text-anchor="middle">'+label+'</text>';
}
function circleNum(n){
  return ["⓪","①","②","③","④","⑤","⑥","⑦","⑧","⑨"][n] || String(n);
}
function drawNote(x, y, dur, clef, opt){
  const g = [];
  const hollow = dur >= 2;
  const hasStem = dur < 4 && !(opt && opt.noStem);
  const topY = clef === "treble" ? TREBLE_TOP : BASS_TOP;
  const botY = topY + 40;
  if(y < topY - 1){
    for(let ly = topY - 10; ly >= y - 1; ly -= 10){
      g.push('<line class="ledger-line" x1="'+r1(x-9)+'" y1="'+r1(ly)+'" x2="'+r1(x+9)+'" y2="'+r1(ly)+'"/>');
    }
  }
  if(y > botY + 1){
    for(let ly = botY + 10; ly <= y + 1; ly += 10){
      g.push('<line class="ledger-line" x1="'+r1(x-9)+'" y1="'+r1(ly)+'" x2="'+r1(x+9)+'" y2="'+r1(ly)+'"/>');
    }
  }
  const cls = hollow ? "note-head open" : "note-head";
  g.push('<ellipse class="'+cls+'" cx="'+r1(x)+'" cy="'+r1(y)+'" rx="5.5" ry="4" transform="rotate(-20 '+r1(x)+' '+r1(y)+')"/>');
  if(hasStem){
    const up = (opt && typeof opt.stemUp === "boolean") ? opt.stemUp : y > (clef === "treble" ? TREBLE_TOP + 20 : BASS_TOP + 20);
    const sx = up ? x + 4.6 : x - 4.6;
    const sy = (opt && typeof opt.tip === "number") ? opt.tip : (up ? y - 30 : y + 30);
    g.push('<line class="stem" x1="'+r1(sx)+'" y1="'+r1(y)+'" x2="'+r1(sx)+'" y2="'+r1(sy)+'"/>');
    if(dur <= 0.5 && !(opt && opt.noFlag)){
      if(up){
        g.push('<path class="flag" d="M '+r1(sx)+' '+r1(sy)+' q 8 5 6 16"/>');
      }else{
        g.push('<path class="flag" d="M '+r1(sx)+' '+r1(sy)+' q 8 -5 6 -16"/>');
      }
    }
  }
  if(dur === 1.5 || dur === 3 || dur === 0.75){
    g.push('<circle class="dot-note" cx="'+r1(x+10)+'" cy="'+r1(y-4)+'" r="1.6"/>');
  }
  return '<g class="note-group">' + g.join("") + '</g>';
}

function renderScore(){
  const wrap = document.getElementById("scoreWrap");
  if(!wrap) return;
  const W = Math.max(280, wrap.clientWidth || 320);
  const narrow = W < 560;
  const perLine = narrow ? 2 : 4;
  const song = SONGS[state.song];
  const total = song.bars.length;
  const lines = Math.ceil(total / perLine);
  scoreEls.bars = [];
  scoreEls.noteList = [];
  scoreEls.noteMap.clear();
  setLayout(!!song.hasArp);
  const parts = [];
  for(let li=0; li<lines; li++){
    const first = li*perLine;
    const count = Math.min(perLine, total - first);
    buildSystem(parts, first, count, perLine, W);
  }
  wrap.innerHTML = parts.join("");
  wrap.querySelectorAll('[data-hlbar]').forEach(function(el){ scoreEls.bars.push(el); });
  wrap.querySelectorAll("svg").forEach(function(svg){
    const hls = svg.querySelectorAll(".bar-hl, .bar-done");
    hls.forEach(function(h){ svg.insertBefore(h, svg.firstChild); });
  });
  wrap.querySelectorAll(".bar-check").forEach(function(g){
    function flip(ev){
      ev.preventDefault(); ev.stopPropagation();
      const bi = parseInt(g.getAttribute("data-check"),10);
      toggleDone(SONGS[state.song].id, bi);
      const on = doneBars(SONGS[state.song].id).indexOf(bi) >= 0;
      g.classList.toggle("on", on);
      g.setAttribute("aria-pressed", on ? "true" : "false");
      const tint = wrap.querySelector('.bar-done[data-donebar="'+bi+'"]');
      if(tint) tint.classList.toggle("on", on);
      renderProgress(); renderSongs();
    }
    g.addEventListener("click", flip);
    g.addEventListener("keydown", function(ev){
      if(ev.key === "Enter" || ev.key === " ") flip(ev);
    });
  });
  wrap.querySelectorAll(".note-anchor").forEach(function(anchor){
    const hand = anchor.getAttribute("data-hand");
    const bar = anchor.getAttribute("data-bar");
    const idx = anchor.getAttribute("data-idx");
    let prev = anchor.previousElementSibling;
    while(prev && !(prev.classList && prev.classList.contains("note-group"))){
      prev = prev.previousElementSibling;
    }
    if(prev){
      scoreEls.noteMap.set(hand+"-"+bar+"-"+idx, prev);
      scoreEls.noteList.push(prev);
    }
    anchor.remove();
  });
  wrap.querySelectorAll(".bar-hit").forEach(function(r){
    r.addEventListener("click", function(){
      barClick(parseInt(r.getAttribute("data-bar"),10));
    });
  });
  updateSelectionVisual();
  renderScoreMeta();
}

function renderScoreMeta(){
  const song = SONGS[state.song];
  const used = {};
  song.parsed.forEach(function(b){
    b.right.forEach(function(n){ if(!n.rest) used[n.pc] = true; });
  });
  const sols = Object.keys(SOLFEGE).filter(function(k){ return used[k]; })
    .map(function(k){ return '<span class="tag" style="color:var(--'+SOL_VAR[k]+');font-weight:700;">'+sol(k)+'</span>'; })
    .join(" ");
  const chs = song.chords.map(function(c){
    return '<span class="tag" style="color:#fff;background:var('+CHORD_VAR[c]+')">'+cname(c)+'</span>';
  }).join(" ");
  const lesson = LESSONS.find(function(L){ return L.songs.indexOf(song.id) >= 0; });
  const custom = song.customized ? '<span class="custom-tag">已修改</span>' : '';
  document.getElementById("scoreMeta").innerHTML =
    (lesson ? '<span class="lesson-goal"><b>'+lesson.title+'</b>　'+lesson.goal+'</span>' : '') +
    '<span class="tag">拍號 4/4</span>' +
    '<span class="tag">共 '+song.bars.length+' 小節</span>' +
    '<span>唱名：'+sols+'</span>' +
    '<span>和弦：'+chs+'</span>' + custom;
}

function updateSelectionVisual(){
  const wrap = document.getElementById("scoreWrap");
  if(!wrap) return;
  wrap.querySelectorAll(".sel-rect").forEach(function(e){ e.remove(); });
  if(state.selA === null) return;
  const a = state.selA;
  const b = state.selB === null ? state.selA : state.selB;
  wrap.querySelectorAll(".bar-hit").forEach(function(r){
    const bi = parseInt(r.getAttribute("data-bar"),10);
    if(bi === a || bi === b || (bi > a && bi < b)){
      const svg = r.ownerSVGElement;
      if(!svg) return;
      if(svg.querySelector('.sel-rect[data-s="'+bi+'"]')) return;
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", r.getAttribute("x"));
      rect.setAttribute("y", r.getAttribute("y"));
      rect.setAttribute("width", r.getAttribute("width"));
      rect.setAttribute("height", r.getAttribute("height"));
      rect.setAttribute("rx", "6");
      rect.setAttribute("class", "sel-rect");
      rect.setAttribute("data-s", bi);
      svg.appendChild(rect);
    }
  });
  updateRangeInfo();
}

function barClick(bi){
  if(state.selA === null){ state.selA = bi; state.selB = bi; }
  else{
    const a = state.selA, b = state.selB === null ? state.selA : state.selB;
    if(bi >= a && bi <= b){ state.selA = null; state.selB = null; }
    else if(bi < a){ state.selA = bi; }
    else{ state.selB = bi; }
  }
  updateSelectionVisual();
  if(player || pausedAt !== null) stopPlayback();
}

function currentRange(){
  const total = SONGS[state.song].bars.length;
  if(state.selA === null) return [0, total-1];
  const a = state.selA;
  const b = state.selB === null ? state.selA : state.selB;
  return [Math.min(a,b), Math.max(a,b)];
}

function updateRangeInfo(){
  const song = SONGS[state.song];
  const r = currentRange();
  const n = r[1] - r[0] + 1;
  let txt;
  if(state.selA === null){
    txt = '目前範圍：<b>整首</b>（第 1–'+song.bars.length+' 小節）';
  }else if(state.selB === null){
    txt = '目前範圍：<b>第 '+(r[0]+1)+' 小節</b>（再點一個小節設終點）';
  }else{
    txt = '目前範圍：<b>第 '+(r[0]+1)+'–'+(r[1]+1)+' 小節</b>（共 '+n+' 小節）';
  }
  if(pausedAt !== null){
    txt += ' ・ <b>已暫停</b>，按繼續從第 '+(pausedAt+1)+' 小節接續';
  }else if(player){
    const lap = currentLap();
    if(lap > 0) txt += ' ・ 循環第 <b>'+lap+'</b> 遍（♩ = '+player.rounds[lap-1].bpm+'）';
  }
  document.getElementById("rangeInfo").innerHTML = txt;
}

/* 鍵盤 */
const WHITE_KEYS = ["C4","D4","E4","F4","G4","A4","B4"];
const BLACK_KEYS = [
  {name:"C#4", after:0},{name:"D#4", after:1},{name:"F#4", after:3},
  {name:"G#4", after:4},{name:"A#4", after:5}
];
const keyEls = new Map();

function renderKeyboard(){
  const wrap = document.getElementById("keys");
  wrap.innerHTML = "";
  keyEls.clear();
  const n = WHITE_KEYS.length;
  const unit = 100 / n;
  WHITE_KEYS.forEach(function(name){
    const pc = name[0];
    const btn = document.createElement("div");
    btn.className = "wkey";
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "-1");
    btn.setAttribute("data-note", name);
    btn.setAttribute("aria-label", sol(pc) + " " + name);
    const isLeftChord = (pc === "C" || pc === "F" || pc === "G" || pc === "A");
    const leftHtml = isLeftChord
      ? '<span class="wk-left show" style="--c:var('+CHORD_VAR[pc]+')">左'+circleNum(LEFT_FINGER[pc])+'</span>'
      : '<span class="wk-left">.</span>';
    btn.innerHTML = leftHtml + '<span class="wk-finger">'+DEFAULT_FINGER[pc]+'</span>';
    btn.addEventListener("pointerdown", function(ev){ ev.preventDefault(); pressKeyByNote(name); });
    wrap.appendChild(btn);
    keyEls.set(name, btn);
  });
  const bw = unit * 0.62;
  BLACK_KEYS.forEach(function(bk){
    const el = document.createElement("div");
    el.className = "bkey";
    el.setAttribute("data-note", bk.name);
    el.style.width = bw + "%";
    el.style.left = ((bk.after+1)*unit - bw/2) + "%";
    el.addEventListener("pointerdown", function(ev){ ev.preventDefault(); pressKeyByNote(bk.name); });
    wrap.appendChild(el);
    keyEls.set(bk.name, el);
  });
}

function pressKeyByNote(name){
  resumeAudio();
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if(!m) return;
  const pc = m[1], sharp = m[2] === "#", oct = parseInt(m[3],10);
  const midi = pitchToMidi(pc, oct) + (sharp ? 1 : 0);
  const t = ac.currentTime + 0.01;
  pianoNote(midi, t, 0.5, audio.melody);
  if(pc === "C" || pc === "F" || pc === "G" || pc === "A"){
    const chordMidi = {C:[48,52,55], F:[53,57,60], G:[55,59,62], A:[57,60,64]}[pc];
    chordMidi.forEach(function(mm){ pianoNote(mm, t, 0.5, audio.chord); });
  }
  const el = keyEls.get(name);
  if(el){ el.classList.add("pressed"); setTimeout(function(){ el.classList.remove("pressed"); }, 150); }
}

function renderHands(){
  const hL = document.getElementById("handL");
  const hR = document.getElementById("handR");
  hL.innerHTML = '<span class="hlabel">左手</span>' +
    [1,2,3,4,5].map(function(i){ return '<div class="finger" data-hand="L" data-f="'+i+'">'+i+'</div>'; }).join("");
  hR.innerHTML = '<span class="hlabel">右手</span>' +
    [1,2,3,4,5].map(function(i){ return '<div class="finger" data-hand="R" data-f="'+i+'">'+i+'</div>'; }).join("");
}
function clearHands(){
  document.querySelectorAll(".finger.up").forEach(function(e){ e.classList.remove("up"); });
}
function setFinger(hand, f){
  const el = document.querySelector('.finger[data-hand="'+hand+'"][data-f="'+f+'"]');
  if(el) el.classList.add("up");
}

/* 播放排程 */
let player = null;
let rafId = 0;
let pausedAt = null;
let pausedMode = null;
let lastScrolledBar = -1;

function clearHighlights(){
  scoreEls.bars.forEach(function(b){ b.classList.remove("on"); });
  scoreEls.noteList.forEach(function(n){ n.classList.remove("is-on"); });
  keyEls.forEach(function(el){ el.classList.remove("pressed","hint"); });
}
function resetNowChord(){
  document.getElementById("ncValue").textContent = "—";
  document.getElementById("ncValue").style.color = "var(--accent)";
  document.getElementById("ncLeft").textContent = "—";
  document.getElementById("ncNext").textContent = "下一個：—";
}
function updatePlayButtons(){
  const once = document.getElementById("btnOnce");
  const loop = document.getElementById("btnLoop");
  const pause = document.getElementById("btnPause");
  const playing = !!player;
  once.setAttribute("aria-pressed", playing && player.mode === "once" ? "true" : "false");
  loop.setAttribute("aria-pressed", playing && player.mode === "loop" ? "true" : "false");
  if(pausedAt !== null){ pause.disabled = false; pause.textContent = "▶ 繼續"; }
  else if(playing){ pause.disabled = false; pause.textContent = "⏸ 暫停"; }
  else{ pause.disabled = true; pause.textContent = "⏸ 暫停"; }
  pause.setAttribute("aria-pressed", "false");
}
function stopPlayback(){
  if(player){ player.stopped = true; }
  endLadder();
  player = null; pausedAt = null; pausedMode = null;
  if(rafId){ cancelAnimationFrame(rafId); rafId = 0; }
  stopAllSources(); clearHighlights(); clearHands(); resetNowChord();
  updatePlayButtons(); updateRangeInfo();
}
function pausePlayback(){
  if(!player) return;
  const now = ac.currentTime;
  const range = currentRange();
  let curBar = range[0];
  for(let i=0; i<player.rounds.length; i++){
    const r = player.rounds[i];
    for(let j=0; j<r.bars.length; j++){
      if(now >= r.bars[j].start) curBar = r.bars[j].index;
    }
  }
  pausedMode = player.mode;
  player.stopped = true; player = null;
  if(rafId){ cancelAnimationFrame(rafId); rafId = 0; }
  endLadder(); stopAllSources(); clearHighlights(); clearHands();
  pausedAt = curBar;
  updatePlayButtons(); updateRangeInfo();
  const ncValue = document.getElementById("ncValue");
  ncValue.textContent = "暫停";
  ncValue.style.color = "var(--accent)";
  document.getElementById("ncLeft").textContent = "第 " + (curBar+1) + " 小節";
  document.getElementById("ncNext").textContent = "按「繼續」接續";
}
function resumePlayback(){
  if(pausedAt === null) return;
  const startBar = pausedAt;
  const mode = pausedMode || "once";
  pausedAt = null; pausedMode = null;
  lastScrolledBar = -1;
  startPlayback(mode, true, startBar);
}
function currentLap(){
  if(!player) return 0;
  const now = ac.currentTime;
  let lap = 0;
  for(let i=0;i<player.rounds.length;i++){
    if(now >= player.rounds[i].musicStart) lap = i+1;
  }
  return lap;
}
function chordMidi(name){
  return {
    C:{bass:36, tones:[48,52,55]},
    F:{bass:41, tones:[53,57,60]},
    G:{bass:43, tones:[55,59,62]},
    A:{bass:45, tones:[57,60,64]}
  }[name];
}

function scheduleRound(musicStart, beat, countInStart, countInBeats, fromBar){
  const song = SONGS[state.song];
  const range = currentRange();
  const e = range[1];
  const s = (typeof fromBar === "number" && fromBar >= range[0] && fromBar <= e) ? fromBar : range[0];
  const round = {
    bpm: Math.round(60/beat),
    musicStart: musicStart,
    endTime: musicStart + (e-s+1)*4*beat,
    bars: [], events: []
  };
  if(countInStart !== null && countInStart !== undefined){
    const n = countInBeats || 4;
    for(let i=0;i<n;i++){
      const t = countInStart + i*beat;
      round.events.push({type:"count", t:t, n:i+1});
      clickSound(t, audio.click, i===0);
    }
  }
  for(let bi = s; bi <= e; bi++){
    const bar = song.parsed[bi];
    const tBar = musicStart + (bi - s)*4*beat;
    const barObj = { index: bi, start: tBar, end: tBar + 4*beat, notes: [] };
    const chordList = bar.left;
    const segLen = 4 / chordList.length;
    let t = tBar;
    bar.right.forEach(function(n, ni){
      const durSec = n.dur * beat;
      if(n.rest){ t += durSec; return; }
      const midi = pitchToMidi(n.pc, n.oct);
      const fing = n.finger || DEFAULT_FINGER[n.pc];
      let playEnd = t + durSec;
      if(state.sustain){
        const segIdx = Math.min(chordList.length-1, Math.floor((t - tBar)/(segLen*beat)));
        const segEnd = tBar + (segIdx+1)*segLen*beat;
        playEnd = Math.max(playEnd, segEnd + 0.25);
      }
      pianoNote(midi, t, playEnd - t, audio.melody);
      const ev = { t: t, end: playEnd, midi: midi, hand:"right", bar: bi, idx: ni, fing: fing, pc: n.pc };
      round.events.push(ev);
      barObj.notes.push(ev);
      t += durSec;
    });
    chordList.forEach(function(ch, ci){
      scheduleAccomp(ch, tBar + ci*segLen*beat, beat);
    });
    bar.leftItems.forEach(function(it, li){
      const tI = tBar + it.beat*beat;
      const iEnd = tI + it.dur*beat;
      const ch = it.chord;
      if(it.legacy){
        const info = chordMidi(ch);
        const leftEnd = state.sustain ? iEnd + 0.25 : iEnd;
        info.tones.forEach(function(m, k){
          pianoNote(m, tI, leftEnd - tI + (k===0?0.15:0), audio.chord);
        });
        round.events.push({
          t: tI, end: leftEnd, midi: info.tones[0], hand:"left",
          bar: bi, idx: li, fing: LEFT_FINGER[ch] || 5, pc: ch, chord: ch
        });
      }else{
        const segEnd = tBar + (Math.floor(it.beat / segLen + 1e-9) + 1) * segLen * beat;
        const noteEnd = state.sustain ? Math.max(iEnd, segEnd) + 0.25 : iEnd + 0.05;
        it.notes.forEach(function(nt){ pianoNote(nt.midi, tI, noteEnd - tI, audio.chord); });
        round.events.push({
          t: tI, end: iEnd, midi: it.notes[0].midi, hand:"left",
          bar: bi, idx: li, fing: it.notes[0].f, pc: it.notes[0].pc, chord: ch,
          fings: it.notes.map(function(nt){ return nt.f; }),
          pcs: it.notes.map(function(nt){ return nt.pc; })
        });
      }
    });
    round.bars.push(barObj);
  }
  round.events.sort(function(a,b){ return a.t - b.t; });
  player.rounds.push(round);
  return round;
}

function scheduleAccomp(ch, t0, beat){
  const info = chordMidi(ch);
  const tones = info.tones, bass = info.bass;
  const dest = audio.accomp, drumDest = audio.drums;
  if(state.rhythm === "march"){
    pianoNote(bass, t0, state.sustain ? beat*2.2 : beat*1.1, dest); kick(t0, drumDest);
    pianoNote(tones[0], t0+beat, state.sustain ? beat*1.2 : beat*0.7, dest); hat(t0+beat, drumDest, 0.07, 0.18);
    pianoNote(bass + 7, t0+2*beat, state.sustain ? beat*2.0 : beat*1.0, dest); kick(t0+2*beat, drumDest);
    pianoNote(tones[0], t0+3*beat, state.sustain ? beat*1.2 : beat*0.7, dest); hat(t0+3*beat, drumDest, 0.07, 0.18);
  }else if(state.rhythm === "lyric"){
    const seq = [bass, tones[1], tones[2], bass+12, tones[2], tones[1], bass, tones[2]];
    const eighth = beat/2;
    seq.forEach(function(m, i){ pianoNote(m, t0 + i*eighth, state.sustain ? beat*1.6 : eighth*1.5, dest); });
    hat(t0, drumDest, 0.05, 0.07);
  }else{
    const eighth = beat/2;
    for(let i=0;i<8;i++){
      const t = t0 + i*eighth;
      if(i === 0 || i === 4){ pianoNote(bass, t, state.sustain ? beat*1.2 : eighth*1.4, dest); kick(t, drumDest); }
      else if(i === 2 || i === 6){ tones.forEach(function(m){ pianoNote(m, t, state.sustain ? beat*0.9 : eighth*1.2, dest); }); }
      else { pianoNote(tones[(i%3)], t, eighth*0.9, dest); }
      hat(t, drumDest, 0.045, i%2===0 ? 0.13 : 0.07);
    }
  }
}

let ladderStartBpm = null;
let lastLadder = null;
function setBpmUI(){
  document.getElementById("bpmRange").value = state.bpm;
  document.getElementById("bpmValue").textContent = "♩ = " + state.bpm;
}
function renderLadderInfo(){
  const info = document.getElementById("ladderInfo");
  if(!info) return;
  if(!state.ladder.on){
    info.textContent = "開啟後按「一直循環」，每遍會自動加快一點。";
  }else if(ladderStartBpm !== null){
    let cur = state.bpm;
    if(player && player.rounds.length){
      const lap = currentLap();
      cur = player.rounds[Math.max(0, lap-1)].bpm;
    }
    info.innerHTML = "從 ♩ = "+ladderStartBpm+" 開始，現在 <b>♩ = "+cur+"</b>，最快到 "+state.ladder.max;
  }else if(lastLadder){
    info.innerHTML = "上一次從 ♩ = "+lastLadder.from+" 加到 <b>♩ = "+lastLadder.to+"</b>";
  }else{
    info.textContent = "按「一直循環」開始：從 ♩ = "+state.bpm+" 起，每遍加 "+state.ladder.step+"，最快到 "+state.ladder.max+"。";
  }
}
function endLadder(){
  if(ladderStartBpm === null) return;
  lastLadder = { from: ladderStartBpm, to: state.bpm };
  state.bpm = ladderStartBpm;
  ladderStartBpm = null;
  setBpmUI(); renderLadderInfo();
}

function startPlayback(mode, isResume, fromBar){
  resumeAudio();
  if(player){ player.stopped = true; }
  if(rafId){ cancelAnimationFrame(rafId); rafId = 0; }
  stopAllSources();
  const beat = 60 / state.bpm;
  const now = ac.currentTime + 0.15;
  const countInBeats = 4;
  if(!isResume){
    endLadder();
    if(mode === "loop" && state.ladder.on){ ladderStartBpm = state.bpm; lastLadder = null; }
  }
  const countIn = countInBeats * beat;
  player = { mode: mode, loop: mode === "loop", beat: beat, rounds: [], stopped: false };
  lastScrolledBar = -1;
  scheduleRound(now + countIn, beat, now, countInBeats, fromBar);
  updatePlayButtons(); renderLadderInfo(); updateRangeInfo();
  rafId = requestAnimationFrame(tick);
}

function tick(){
  if(!player || player.stopped) return;
  const now = ac.currentTime;
  const last = player.rounds[player.rounds.length - 1];
  if(player.loop && last && now > last.endTime - 0.45){
    if(state.ladder.on && ladderStartBpm !== null){
      const next = Math.min(state.ladder.max, state.bpm + state.ladder.step);
      if(next > state.bpm){
        state.bpm = next;
        player.beat = 60 / next;
        setBpmUI(); renderLadderInfo();
      }
    }
    scheduleRound(last.endTime, player.beat, null, 0);
    updateRangeInfo();
  }
  updatePlaybackVisual(now);
  const lapNow = currentLap();
  if(lapNow !== player.shownLap){ player.shownLap = lapNow; updateRangeInfo(); renderLadderInfo(); }
  const tail = player.rounds[player.rounds.length - 1];
  if(!player.loop && tail && now > tail.endTime + 0.6){ stopPlayback(); return; }
  if(player.loop && !last){ stopPlayback(); return; }
  rafId = requestAnimationFrame(tick);
}

function updatePlaybackVisual(now){
  let curRound = null;
  for(let i=0;i<player.rounds.length;i++){
    const r = player.rounds[i];
    if(now >= r.musicStart && now < r.endTime){ curRound = r; break; }
  }
  if(!curRound && player.rounds.length){
    const r0 = player.rounds[0];
    if(now < r0.musicStart){
      const remain = Math.max(1, Math.ceil((r0.musicStart - now) / player.beat));
      document.getElementById("ncValue").textContent = String(remain);
      document.getElementById("ncValue").style.color = "var(--accent)";
      document.getElementById("ncLeft").textContent = "預備拍";
      document.getElementById("ncNext").textContent = "下一個：—";
      clearHighlights(); clearHands();
      return;
    }
  }
  if(!curRound){ clearHighlights(); return; }
  let barObj = null;
  for(let i=0;i<curRound.bars.length;i++){
    const b = curRound.bars[i];
    if(now >= b.start && now < b.end){ barObj = b; break; }
  }
  if(!barObj) barObj = curRound.bars[curRound.bars.length-1];
  scoreEls.bars.forEach(function(el){
    const bi = parseInt(el.getAttribute("data-hlbar"),10);
    if(bi === barObj.index) el.classList.add("on");
    else el.classList.remove("on");
  });
  if(state.follow && barObj.index !== lastScrolledBar){
    lastScrolledBar = barObj.index;
    const hit = document.querySelector('.bar-hit[data-bar="'+barObj.index+'"]');
    if(hit && hit.ownerSVGElement){
      const r = hit.ownerSVGElement.getBoundingClientRect();
      if(r.top < 80 || r.bottom > window.innerHeight - 200){
        hit.ownerSVGElement.scrollIntoView({behavior:"smooth", block:"center"});
      }
    }
  }
  let curNote = null, curLeft = null, nextNote = null;
  for(let i=0;i<curRound.events.length;i++){
    const ev = curRound.events[i];
    if(ev.type === "count") continue;
    if(now >= ev.t && now < ev.end){
      if(ev.hand === "left"){ curLeft = ev; }
      if(!curNote || ev.hand === "right") curNote = ev;
    }
    if(ev.t > now && !nextNote) nextNote = ev;
  }
  const curRight = (curNote && curNote.hand === "right") ? curNote : null;
  scoreEls.noteList.forEach(function(n){ n.classList.remove("is-on"); });
  [curRight, curLeft].forEach(function(ev){
    if(!ev) return;
    const g = scoreEls.noteMap.get(ev.hand + "-" + ev.bar + "-" + ev.idx);
    if(g) g.classList.add("is-on");
  });
  keyEls.forEach(function(el){ el.classList.remove("pressed","hint"); });
  if(curNote && curNote.hand === "right"){
    const el = keyEls.get(midiToName(curNote.midi));
    if(el) el.classList.add("pressed");
  }
  if(curLeft && !curRight){
    (curLeft.pcs || [curLeft.pc]).forEach(function(pc){
      const el = keyEls.get(pc + "4");
      if(el) el.classList.add("pressed");
    });
  }
  if(nextNote && nextNote.hand === "right"){
    const el = keyEls.get(midiToName(nextNote.midi));
    if(el) el.classList.add("hint");
  }
  const chordNow = chordForBar(barObj.index, now, curRound);
  const ncValue = document.getElementById("ncValue");
  ncValue.textContent = cname(chordNow);
  ncValue.style.color = "var(" + (CHORD_VAR[chordNow] || "--accent") + ")";
  document.getElementById("ncLeft").textContent = sol(chordNow) + " " + circleNum(LEFT_FINGER[chordNow] || 5);
  const nextBar = barObj.index + 1;
  const song = SONGS[state.song];
  let nextChord = "—";
  if(nextBar < song.bars.length) nextChord = song.parsed[nextBar].left[0];
  else if(player.loop) nextChord = song.parsed[currentRange()[0]].left[0];
  document.getElementById("ncNext").textContent = "下一個：" + cname(nextChord);
  clearHands();
  if(curRight) setFinger("R", curRight.fing);
  if(curLeft) (curLeft.fings || [curLeft.fing]).forEach(function(f){ setFinger("L", f); });
}

function chordForBar(barIndex, now, round){
  const song = SONGS[state.song];
  const bar = song.parsed[barIndex];
  const list = bar.left;
  if(list.length === 1) return list[0];
  const barObj = round.bars.find(function(b){ return b.index === barIndex; });
  if(!barObj) return list[0];
  const frac = (now - barObj.start) / (barObj.end - barObj.start);
  const i = Math.min(list.length-1, Math.max(0, Math.floor(frac * list.length)));
  return list[i];
}

function midiToName(m){
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const oct = Math.floor(m/12) - 1;
  return names[m % 12] + oct;
}

/* 介面 */
function renderSolfegeStrip(){
  const order = ["C","D","E","F","G","A","B"];
  document.getElementById("solfegeStrip").innerHTML = order.map(function(pc){
    return '<span class="sf" style="--c:var('+SOL_VAR[pc]+')">'+sol(pc)+'</span>';
  }).join("");
}
function renderSolfegeBtn(){
  const btn = document.getElementById("btnSolfege");
  if(!btn) return;
  if(state.solfegeSys === "zhuyin"){
    btn.textContent = "注音 ㄉㄡ ㄖㄨㄟ ㄇㄧ（點一下切唱名）";
    btn.setAttribute("aria-pressed", "true");
  }else{
    btn.textContent = "唱名 Do Re Mi（點一下切注音）";
    btn.setAttribute("aria-pressed", "false");
  }
}
function renderPillBtn(){
  const btn = document.getElementById("btnPill");
  if(!btn) return;
  if(state.showPills){
    btn.textContent = "🎵 顯示中（點一下隱藏）";
    btn.setAttribute("aria-pressed", "true");
  }else{
    btn.textContent = "🚫 已隱藏（點一下顯示）";
    btn.setAttribute("aria-pressed", "false");
  }
}

function songCard(s, i){
  const stars = "★".repeat(s.stars) + "☆".repeat(3 - s.stars);
  const chips = s.chords.map(function(c){
    return '<i class="ch-chip" style="--c:var('+CHORD_VAR[c]+')">'+cname(c)+'</i>';
  }).join("");
  const done = IS_TEACHER ? doneBars(s.id).length : 0, total = s.bars.length;
  const prog = done === 0 ? '' :
    '<span class="sc-prog'+(done >= total ? ' full' : '')+'">'+(done >= total ? '✔ 全部練熟' : '✔ '+done+' / '+total+' 小節')+'</span>';
  const custom = s.customized ? '<span class="custom-tag">已修改</span>' : '';
  return '<button class="song-card" data-i="'+i+'" aria-pressed="'+(i===state.song)+'">' +
    '<span class="sc-title">'+s.title+'</span>' +
    '<span class="sc-stars" aria-label="難度 '+s.stars+' 顆星">'+stars+'</span>' +
    '<span class="sc-chords">'+chips+' '+custom+'</span>' + prog +
    '</button>';
}
function renderSongs(){
  const grid = document.getElementById("songGrid");
  const used = {};
  let html = LESSONS.map(function(L){
    const cards = L.songs.map(function(id){
      const i = SONGS.findIndex(function(s){ return s.id === id; });
      if(i < 0) return "";
      used[id] = true;
      return songCard(SONGS[i], i);
    }).join("");
    return '<div class="lesson"><div class="lesson-head"><h3>'+L.title+'</h3><p>'+L.goal+'</p></div>' +
      '<div class="song-grid">'+cards+'</div></div>';
  }).join("");
  const rest = SONGS.map(function(s, i){ return used[s.id] ? "" : songCard(s, i); }).join("");
  if(rest) html += '<div class="lesson"><div class="lesson-head"><h3>其他曲子</h3><p>還沒排進課程的曲子。</p></div><div class="song-grid">'+rest+'</div></div>';
  grid.innerHTML = html;
  grid.querySelectorAll(".song-card").forEach(function(btn){
    btn.addEventListener("click", function(){
      const i = parseInt(btn.getAttribute("data-i"),10);
      if(i === state.song) return;
      state.song = i;
      state.selA = null; state.selB = null;
      stopPlayback();
      renderSongs(); renderRangeButtons(); renderScore(); renderProgress();
      updateRangeInfo();
      const ec = document.getElementById("editorCard");
      if(ec && !ec.hidden && !document.getElementById("editorMain").hidden){
        renderEditorRows();
      }
    });
  });
}

function twoStep(btn, label, confirmLabel, action){
  let armed = false, timer = 0;
  btn.addEventListener("click", function(){
    if(btn.disabled) return;
    if(!armed){
      armed = true;
      btn.textContent = confirmLabel;
      btn.classList.add("warn");
      timer = setTimeout(function(){ armed = false; btn.textContent = label; btn.classList.remove("warn"); }, 3000);
      return;
    }
    clearTimeout(timer);
    armed = false; btn.textContent = label; btn.classList.remove("warn");
    action();
  });
}
function renderProgress(){
  if(!IS_TEACHER) return;
  const sel = document.getElementById("studentSel");
  sel.innerHTML = progress.students.map(function(n){
    const esc = escHTML(n);
    return '<option value="'+esc+'"'+(n===progress.cur?' selected':'')+'>'+esc+'</option>';
  }).join("");
  const song = SONGS[state.song];
  const done = doneBars(song.id).length, total = song.bars.length;
  document.getElementById("progressInfo").innerHTML =
    '本曲已練熟 <b>'+done+' / '+total+'</b> 小節' + (done >= total ? '　🎉 全部完成！' : '');
  document.getElementById("btnDelStudent").disabled = progress.students.length <= 1;
}
function bindProgress(){
  if(!IS_TEACHER) return;
  const sel = document.getElementById("studentSel");
  sel.addEventListener("change", function(){
    progress.cur = sel.value;
    saveProgress();
    renderProgress(); renderSongs(); renderScore();
  });
  const input = document.getElementById("newStudent");
  function add(){
    const name = input.value.trim().slice(0, 20);
    if(!name) { input.focus(); return; }
    if(progress.students.indexOf(name) < 0) progress.students.push(name);
    progress.cur = name;
    input.value = "";
    saveProgress();
    renderProgress(); renderSongs(); renderScore();
  }
  document.getElementById("btnAddStudent").addEventListener("click", add);
  input.addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); add(); } });
  twoStep(document.getElementById("btnClearDone"), "清除這首的勾選", "再按一次確定清除", function(){
    const st = progress.done[progress.cur];
    if(st) delete st[SONGS[state.song].id];
    saveProgress();
    renderProgress(); renderSongs(); renderScore();
  });
  twoStep(document.getElementById("btnDelStudent"), "刪除這位學生", "再按一次確定刪除", function(){
    if(progress.students.length <= 1) return;
    const name = progress.cur;
    progress.students = progress.students.filter(function(n){ return n !== name; });
    delete progress.done[name];
    progress.cur = progress.students[0];
    saveProgress();
    renderProgress(); renderSongs(); renderScore();
  });
}

function renderProblems(){
  const box = document.getElementById("songProblems");
  if(!SONG_PROBLEMS.length){ box.hidden = true; return; }
  SONG_PROBLEMS.forEach(function(m){ console.warn("曲譜檢查：" + m); });
  box.hidden = false;
  box.innerHTML = '<b>曲譜檢查發現 '+SONG_PROBLEMS.length+' 個問題</b>（請到老師版用樂譜修改器修正，或修改 songs.js）：<ul>' +
    SONG_PROBLEMS.map(function(m){ return '<li>'+escHTML(m)+'</li>'; }).join("") + '</ul>';
}

function renderRangeButtons(){
  const row = document.getElementById("rangeRow");
  const total = SONGS[state.song].bars.length;
  const groups = Math.ceil(total / 4);
  let html = '<button class="btn small" id="btnAllBars">整首</button>';
  for(let g=0; g<groups; g++){
    const a = g*4, b = Math.min(total-1, a+3);
    html += '<button class="btn small" data-a="'+a+'" data-b="'+b+'">'+(a+1)+'–'+(b+1)+'</button>';
  }
  html += '<button class="btn small" id="btnClearBars">清除</button>';
  row.innerHTML = html;
  row.querySelector("#btnAllBars").addEventListener("click", function(){
    state.selA = null; state.selB = null;
    updateSelectionVisual();
    if(player || pausedAt !== null) stopPlayback();
  });
  row.querySelector("#btnClearBars").addEventListener("click", function(){
    state.selA = null; state.selB = null;
    updateSelectionVisual();
    if(player || pausedAt !== null) stopPlayback();
  });
  row.querySelectorAll("[data-a]").forEach(function(b){
    b.addEventListener("click", function(){
      state.selA = parseInt(b.getAttribute("data-a"),10);
      state.selB = parseInt(b.getAttribute("data-b"),10);
      updateSelectionVisual();
      if(player || pausedAt !== null) stopPlayback();
    });
  });
}

const MODES = [
  {id:"listen", label:"聽示範", voices:{right:true, left:true, accomp:true, click:false}},
  {id:"right",  label:"練右手", voices:{right:true, left:false, accomp:false, click:true}},
  {id:"left",   label:"練左手", voices:{right:false, left:true, accomp:false, click:true}},
  {id:"both",   label:"雙手合奏", voices:{right:true, left:true, accomp:false, click:true}},
  {id:"ekey",   label:"配電子琴", voices:{right:false, left:false, accomp:false, click:true}}
];
function renderModes(){
  const row = document.getElementById("modeRow");
  row.innerHTML = MODES.map(function(m){
    return '<button class="btn small" data-mode="'+m.id+'" aria-pressed="'+(state.mode===m.id)+'">'+m.label+'</button>';
  }).join("");
  row.querySelectorAll("[data-mode]").forEach(function(b){
    b.addEventListener("click", function(){
      const id = b.getAttribute("data-mode");
      state.mode = id;
      const def = MODES.find(function(m){ return m.id === id; });
      state.voices = Object.assign({}, def.voices);
      renderModes(); renderVoices(); applyMix(); saveState();
    });
  });
}
function renderVoices(){
  const row = document.getElementById("voiceRow");
  const items = [
    {k:"right", label:"右手旋律"},
    {k:"left", label:"左手和弦音"},
    {k:"accomp", label:"自動伴奏"},
    {k:"click", label:"拍子聲"}
  ];
  row.innerHTML = items.map(function(it){
    return '<button class="btn small" data-voice="'+it.k+'" aria-pressed="'+(!!state.voices[it.k])+'">'+it.label+'</button>';
  }).join("");
  row.querySelectorAll("[data-voice]").forEach(function(b){
    b.addEventListener("click", function(){
      const k = b.getAttribute("data-voice");
      state.voices[k] = !state.voices[k];
      renderVoices(); applyMix(); saveState();
    });
  });
}

const MIX_CHANNELS = [
  {k:"melody", label:"右手旋律"},
  {k:"chord",  label:"左手和弦音"},
  {k:"accomp", label:"伴奏鋼琴"},
  {k:"drums",  label:"鼓組"},
  {k:"click",  label:"拍子聲"},
  {k:"master", label:"總音量"}
];
function renderMixer(){
  const box = document.getElementById("mixer");
  box.innerHTML = MIX_CHANNELS.map(function(c){
    return '<div class="ch">' +
      '<button class="ch-name'+(state.muted[c.k]?' muted':'')+'" data-mute="'+c.k+'" aria-pressed="'+(!!state.muted[c.k])+'" title="點一下靜音">'+c.label+'</button>' +
      '<input type="range" min="0" max="100" step="1" value="'+state.mix[c.k]+'" data-mix="'+c.k+'" aria-label="'+c.label+'音量">' +
      '<span class="ch-val" data-val="'+c.k+'">'+state.mix[c.k]+'</span>' +
      '</div>';
  }).join("");
  box.querySelectorAll("[data-mix]").forEach(function(r){
    r.addEventListener("input", function(){
      const k = r.getAttribute("data-mix");
      state.mix[k] = parseInt(r.value,10);
      box.querySelector('[data-val="'+k+'"]').textContent = r.value;
      applyMix(); saveState();
    });
  });
  box.querySelectorAll("[data-mute]").forEach(function(b){
    b.addEventListener("click", function(){
      const k = b.getAttribute("data-mute");
      state.muted[k] = !state.muted[k];
      b.classList.toggle("muted", state.muted[k]);
      b.setAttribute("aria-pressed", state.muted[k] ? "true" : "false");
      applyMix(); saveState();
    });
  });
}

function renderFollowButton(){
  const btn = document.getElementById("btnFollow");
  if(!btn) return;
  btn.setAttribute("aria-pressed", state.follow ? "true" : "false");
  btn.textContent = state.follow ? "📍 跟隨樂譜" : "📍 自由瀏覽";
  btn.title = state.follow ? "播放時自動捲動到目前小節（點一下關閉）" : "播放時不自動捲動（點一下開啟）";
}

/* ===== 樂譜修改器 ===== */
let editorUnlocked = false;
const EDITOR_PASS = "1234";

function openEditor(){
  if(player || pausedAt !== null) stopPlayback();
  const card = document.getElementById("editorCard");
  card.hidden = false;
  if(editorUnlocked){
    document.getElementById("editorLock").hidden = true;
    document.getElementById("editorMain").hidden = false;
    renderEditorRows();
  }else{
    document.getElementById("editorLock").hidden = false;
    document.getElementById("editorMain").hidden = true;
    document.getElementById("editorPass").value = "";
    document.getElementById("lockMsg").textContent = "";
    setTimeout(function(){ document.getElementById("editorPass").focus(); }, 50);
  }
  card.scrollIntoView({behavior:"smooth", block:"start"});
}
function closeEditor(){
  document.getElementById("editorCard").hidden = true;
  document.getElementById("lockMsg").textContent = "";
  document.getElementById("editMsg").textContent = "";
}
function unlockEditor(){
  const pass = document.getElementById("editorPass").value;
  if(pass !== EDITOR_PASS){
    document.getElementById("lockMsg").textContent = "密碼不對";
    return;
  }
  editorUnlocked = true;
  document.getElementById("editorLock").hidden = true;
  document.getElementById("editorMain").hidden = false;
  document.getElementById("lockMsg").textContent = "";
  renderEditorRows();
}
function renderEditorRows(){
  const song = SONGS[state.song];
  document.getElementById("editorSongName").textContent = "正在編輯：" + song.title;
  document.getElementById("editorStatus").innerHTML = song.customized ? '<span class="custom-tag">已修改</span>' : '';
  const rows = song.bars.map(function(b, i){
    const pat = b.a || "w";
    const opts = [
      {v:"w", t:"單音"},
      {v:"q", t:"四分琶音"},
      {v:"e", t:"八分琶音"},
      {v:"c", t:"疊和弦"}
    ].map(function(o){
      return '<option value="'+o.v+'"'+(pat === o.v ? ' selected' : '')+'>'+o.t+'</option>';
    }).join("");
    return '<div class="editor-row">' +
      '<span>第 '+(i+1)+' 小節</span>' +
      '<input data-edit="r" data-bar="'+i+'" value="'+escHTML(b.r)+'" placeholder="例如 E4 1 D4 1 C4 2">' +
      '<input data-edit="l" data-bar="'+i+'" value="'+escHTML(b.l)+'" placeholder="例如 C 或 F|G" style="flex:0 1 100px;">' +
      '<select data-edit="a" data-bar="'+i+'">'+opts+'</select>' +
      '</div>';
  }).join("");
  document.getElementById("editorRows").innerHTML = rows;
  document.getElementById("editMsg").textContent = "";
  document.getElementById("editMsg").className = "";
}
function applyEdit(){
  const song = SONGS[state.song];
  const errs = [];
  const newBars = song.bars.map(function(b, i){
    const rEl = document.querySelector('[data-edit="r"][data-bar="'+i+'"]');
    const lEl = document.querySelector('[data-edit="l"][data-bar="'+i+'"]');
    const aEl = document.querySelector('[data-edit="a"][data-bar="'+i+'"]');
    const r = rEl ? rEl.value.trim() : "";
    const l = lEl ? lEl.value.trim() : "";
    const a = aEl ? aEl.value : "w";
    const p = parseBar(r);
    if(p.bad.length) errs.push("第 "+(i+1)+" 小節右手：" + p.bad[0]);
    const sum = p.notes.reduce(function(acc, n){ return acc + n.dur; }, 0);
    if(Math.abs(sum - 4) > 1e-6) errs.push("第 "+(i+1)+" 小節右手共 "+sum+" 拍，需為 4 拍");
    p.notes.forEach(function(n){
      if(n.rest) return;
      if(n.oct !== 4 || n.acc) errs.push("第 "+(i+1)+" 小節有超出 Do4–Si4 的音");
    });
    if(!/^[CFGA](\|[CFGA])*$/.test(l)) errs.push("第 "+(i+1)+" 小節左手和弦只能是 C、F、G、A（兩和弦用 | 分隔）");
    const bar = { r: r, l: l };
    if(a && a !== "w") bar.a = a;
    return bar;
  });
  if(errs.length){
    const msg = document.getElementById("editMsg");
    msg.style.color = "var(--do)";
    msg.textContent = errs[0] + (errs.length > 1 ? "（還有 " + (errs.length-1) + " 個問題）" : "");
    return;
  }
  try{
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}");
    raw[song.id] = newBars;
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(raw));
  }catch(e){}
  song.bars = newBars;
  song.chords = chordsOf(newBars);
  song.customized = barsKey(newBars) !== barsKey(ORIGINAL_BARS[song.id] || []);
  if(!song.customized){
    try{
      const raw2 = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}");
      delete raw2[song.id];
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(raw2));
    }catch(e){}
  }
  parseSongForDraw(song, false);
  stopPlayback();
  renderScore(); renderSongs(); updateRangeInfo(); renderProgress();
  renderEditorRows();
  const msg = document.getElementById("editMsg");
  msg.style.color = "var(--fa)";
  msg.textContent = song.customized ? "已套用（目前只有這台電腦看得到，記得到「發布與備份」下載曲譜檔）" : "和已發布的版本相同";
  renderDraftBanner();
}
function resetSong(){
  const song = SONGS[state.song];
  const orig = ORIGINAL_BARS[song.id];
  if(!orig) return;
  song.bars = orig.map(function(b){ return {r:b.r, l:b.l, a:b.a}; });
  song.chords = chordsOf(song.bars);
  song.customized = false;
  try{
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}");
    delete raw[song.id];
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(raw));
  }catch(e){}
  parseSongForDraw(song, false);
  stopPlayback();
  renderScore(); renderSongs(); updateRangeInfo(); renderProgress();
  renderEditorRows();
  const msg = document.getElementById("editMsg");
  msg.style.color = "var(--fa)";
  msg.textContent = "已恢復成已發布的版本";
  renderDraftBanner();
}

/* 產生 songs.js 的文字（老師版「下載曲譜檔」也用這個） */
function buildSongsFile(lessons, songs, stamp){
  var q = JSON.stringify, out = [];
  out.push("/* =====================================================");
  out.push("   雙手鍵盤教室 · 曲譜資料（songs.js）");
  out.push("   學生版（index.html）和老師版（teacher.html）都讀這個檔案。");
  out.push("   修改方式：在老師版用「樂譜修改器」改好 → 按「下載曲譜檔」→ 上傳到 GitHub 取代這個檔案。");
  out.push("   右手 r：「音高 拍值」成對，例如 E4 1 D4 0.5；休止符 R 1；指定指法 G4/4；每小節共 4 拍。");
  out.push("   左手 l：C、F、G、A（A 代表 Am）；一小節兩個和弦寫 F|G。");
  out.push("   左手樣式 a：不寫＝單音、q＝四分琶音、e＝八分琶音、c＝疊和弦。");
  out.push("   ===================================================== */");
  out.push("window.SONG_DATA = {");
  out.push("  updated: " + q(stamp) + ",");
  out.push("  lessons: [");
  lessons.forEach(function(L, i){
    out.push("    { title: " + q(L.title) + ", goal: " + q(L.goal) + ", songs: " + q(L.songs) + " }" + (i < lessons.length - 1 ? "," : ""));
  });
  out.push("  ],");
  out.push("  songs: [");
  songs.forEach(function(s, i){
    out.push("    {");
    out.push("      id: " + q(s.id) + ", title: " + q(s.title) + ", stars: " + s.stars + ", chords: " + q(s.chords) + ",");
    out.push("      bars: [");
    s.bars.forEach(function(b, j){
      var t = "        { r: " + q(b.r) + ", l: " + q(b.l);
      if(b.a && b.a !== "w") t += ", a: " + q(b.a);
      out.push(t + " }" + (j < s.bars.length - 1 ? "," : ""));
    });
    out.push("      ]");
    out.push("    }" + (i < songs.length - 1 ? "," : ""));
  });
  out.push("  ]");
  out.push("};");
  return out.join("\n") + "\n";
}

function pad2(n){ return (n < 10 ? "0" : "") + n; }
function stampNow(){
  const d = new Date();
  return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate())+" "+pad2(d.getHours())+":"+pad2(d.getMinutes());
}
function downloadText(name, text, type){
  const blob = new Blob([text], {type: type || "text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
}
function toolMsg(text, ok){
  const el = document.getElementById("toolMsg");
  if(!el) return;
  el.textContent = text;
  el.style.color = ok === false ? "var(--do)" : "var(--fa)";
}
function renderDraftBanner(){
  const box = document.getElementById("draftBanner");
  if(!box) return;
  const list = SONGS.filter(function(s){ return s.customized; });
  if(!list.length){ box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<b>有 '+list.length+' 首修改還沒發布：</b>' +
    list.map(function(s){ return escHTML(s.title); }).join("、") +
    '。學生現在看到的還是舊版。按「下載曲譜檔」，再把 songs.js 上傳到 GitHub 就會更新。';
}
function exportSongs(){
  const lessons = LESSONS.map(function(L){ return {title:L.title, goal:L.goal, songs:L.songs.slice()}; });
  const songs = SONGS.map(function(s){
    return { id:s.id, title:s.title, stars:s.stars, chords:chordsOf(s.bars),
      bars:s.bars.map(function(b){ return {r:b.r, l:b.l, a:b.a}; }) };
  });
  downloadText("songs.js", buildSongsFile(lessons, songs, stampNow()), "text/javascript;charset=utf-8");
  toolMsg("已下載 songs.js。請上傳到 GitHub 取代舊檔（步驟見 README）。");
}
function exportProgressCSV(){
  const rows = [["學生","課程","曲子","已練熟小節數","總小節數","完成度","已勾選的小節"]];
  progress.students.forEach(function(name){
    const st = progress.done[name] || {};
    LESSONS.forEach(function(L){
      L.songs.forEach(function(id){
        const song = SONGS.find(function(s){ return s.id === id; });
        if(!song) return;
        const list = (Array.isArray(st[id]) ? st[id] : []).slice().sort(function(a,b){ return a-b; });
        const total = song.bars.length;
        rows.push([name, L.title, song.title, list.length, total,
          Math.round(list.length / total * 100) + "%",
          list.map(function(i){ return i+1; }).join(" ")]);
      });
    });
  });
  const csv = rows.map(function(r){
    return r.map(function(v){ v = String(v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }).join(",");
  }).join("\r\n");
  downloadText("keyboard-progress-"+stampNow().slice(0,10)+".csv", "\ufeff" + csv, "text/csv;charset=utf-8");
  toolMsg("已下載進度表（CSV），可以直接用 Excel 或 Google 試算表開啟。");
}
function backupAll(){
  let drafts = {};
  try{ drafts = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}"); }catch(e){}
  const pack = { app:"shuangshou-keyboard", kind:"backup", saved:stampNow(), progress:progress, drafts:drafts };
  downloadText("keyboard-backup-"+stampNow().slice(0,10)+".json", JSON.stringify(pack, null, 2), "application/json;charset=utf-8");
  toolMsg("已下載備份檔。換電腦或清除瀏覽器資料後，可以用「還原備份」找回。");
}
function restoreAll(file){
  const reader = new FileReader();
  reader.onload = function(){
    try{
      const o = JSON.parse(reader.result);
      if(!o || o.app !== "shuangshou-keyboard" || !o.progress) throw new Error("bad");
      const p = o.progress;
      if(!Array.isArray(p.students) || !p.students.length) throw new Error("bad");
      progress.students = p.students.filter(function(s){ return typeof s === "string" && s; });
      progress.cur = progress.students.indexOf(p.cur) >= 0 ? p.cur : progress.students[0];
      progress.done = (p.done && typeof p.done === "object") ? p.done : {};
      saveProgress();
      if(o.drafts && typeof o.drafts === "object"){
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(o.drafts));
      }
      toolMsg("還原完成，網頁將重新整理…");
      setTimeout(function(){ location.reload(); }, 900);
    }catch(e){
      toolMsg("這個檔案不是雙手鍵盤教室的備份檔。", false);
    }
  };
  reader.readAsText(file, "utf-8");
}
function bindTeacherTools(){
  document.getElementById("btnExportSongs").addEventListener("click", exportSongs);
  document.getElementById("btnExportCSV").addEventListener("click", exportProgressCSV);
  document.getElementById("btnBackup").addEventListener("click", backupAll);
  const inp = document.getElementById("restoreFile");
  inp.addEventListener("change", function(){
    if(inp.files && inp.files[0]) restoreAll(inp.files[0]);
    inp.value = "";
  });
  renderDraftBanner();
}
function renderVersion(){
  const el = document.getElementById("appVersion");
  if(!el) return;
  el.textContent = "雙手鍵盤教室 v" + APP_VERSION + "　·　曲譜更新：" + (DATA.updated || "—");
}

function bindControls(){
  document.getElementById("btnOnce").addEventListener("click", function(){
    if(player){
      if(player.mode === "once"){ stopPlayback(); return; }
      stopPlayback(); startPlayback("once"); return;
    }
    if(pausedAt !== null){ pausedMode = "once"; resumePlayback(); return; }
    startPlayback("once");
  });
  document.getElementById("btnLoop").addEventListener("click", function(){
    if(player){
      if(player.mode === "loop"){ stopPlayback(); return; }
      stopPlayback(); startPlayback("loop"); return;
    }
    if(pausedAt !== null){ pausedMode = "loop"; resumePlayback(); return; }
    startPlayback("loop");
  });
  document.getElementById("btnPause").addEventListener("click", function(){
    if(pausedAt !== null) resumePlayback();
    else if(player) pausePlayback();
  });
  document.getElementById("btnFollow").addEventListener("click", function(){
    state.follow = !state.follow;
    renderFollowButton(); saveState();
  });
  document.getElementById("btnSolfege").addEventListener("click", function(){
    if(player || pausedAt !== null) stopPlayback();
    state.solfegeSys = state.solfegeSys === "zhuyin" ? "do" : "zhuyin";
    saveState();
    renderSolfegeBtn(); renderSolfegeStrip(); renderScore(); renderKeyboard();
  });
  document.getElementById("btnPill").addEventListener("click", function(){
    if(player || pausedAt !== null) stopPlayback();
    state.showPills = !state.showPills;
    saveState();
    renderPillBtn(); renderScore();
  });

  /* 修改器按鈕（只有老師版有） */
  if(IS_TEACHER){
  document.getElementById("btnOpenEditor").addEventListener("click", openEditor);
  document.getElementById("btnUnlock").addEventListener("click", unlockEditor);
  document.getElementById("editorPass").addEventListener("keydown", function(ev){
    if(ev.key === "Enter"){ ev.preventDefault(); unlockEditor(); }
  });
  document.getElementById("btnCloseEditor").addEventListener("click", closeEditor);
  document.getElementById("btnCloseEditor2").addEventListener("click", closeEditor);
  document.getElementById("btnApplyEdit").addEventListener("click", applyEdit);
  twoStep(document.getElementById("btnResetSong"), "恢復成已發布的版本", "再按一次確定恢復", resetSong);
  bindTeacherTools();
  }

  const bpm = document.getElementById("bpmRange");
  bpm.value = state.bpm;
  document.getElementById("bpmValue").textContent = "♩ = " + state.bpm;
  bpm.addEventListener("input", function(){
    state.bpm = parseInt(bpm.value,10);
    document.getElementById("bpmValue").textContent = "♩ = " + state.bpm;
    saveState();
  });
  bpm.addEventListener("change", function(){
    ladderStartBpm = null; lastLadder = null; renderLadderInfo();
    if(player){ const mode = player.mode; stopPlayback(); startPlayback(mode); }
  });
  const lb = document.getElementById("btnLadder");
  const ls = document.getElementById("ladderStep");
  const lm = document.getElementById("ladderMax");
  let maxOpts = "";
  for(let v=64; v<=120; v+=4) maxOpts += '<option value="'+v+'">♩ = '+v+'</option>';
  lm.innerHTML = maxOpts;
  function syncLadder(){
    lb.setAttribute("aria-pressed", state.ladder.on ? "true" : "false");
    ls.value = String(state.ladder.step);
    lm.value = String(state.ladder.max);
    ls.disabled = lm.disabled = !state.ladder.on;
    renderLadderInfo();
  }
  lb.addEventListener("click", function(){
    state.ladder.on = !state.ladder.on;
    if(!state.ladder.on) endLadder();
    else if(player && player.loop && ladderStartBpm === null) ladderStartBpm = state.bpm;
    syncLadder(); saveState();
  });
  ls.addEventListener("change", function(){ state.ladder.step = parseInt(ls.value,10); syncLadder(); saveState(); });
  lm.addEventListener("change", function(){ state.ladder.max = parseInt(lm.value,10); syncLadder(); saveState(); });
  syncLadder();

  const rs = document.getElementById("rhythmSel");
  rs.value = state.rhythm;
  rs.addEventListener("change", function(){
    state.rhythm = rs.value;
    saveState();
    if(player){ const mode = player.mode; stopPlayback(); startPlayback(mode); }
  });
  const sw = document.getElementById("sustainSw");
  sw.setAttribute("aria-pressed", state.sustain ? "true" : "false");
  sw.addEventListener("click", function(){
    state.sustain = !state.sustain;
    sw.setAttribute("aria-pressed", state.sustain ? "true" : "false");
    saveState();
  });

  const KEYMAP = { a:"C4", s:"D4", d:"E4", f:"F4", g:"G4", h:"A4", j:"B4", z:"C4", x:"F4", c:"G4" };
  const held = {};
  document.addEventListener("keydown", function(ev){
    const tag = (ev.target.tagName || "").toLowerCase();
    if(tag === "input" || tag === "select" || tag === "textarea") return;
    const k = ev.key.toLowerCase();
    if(ev.code === "Space"){
      ev.preventDefault();
      if(player) pausePlayback();
      else if(pausedAt !== null) resumePlayback();
      else startPlayback("loop");
      return;
    }
    if(KEYMAP[k] && !held[k]){ held[k] = true; ev.preventDefault(); pressKeyByNote(KEYMAP[k]); }
  });
  document.addEventListener("keyup", function(ev){ held[ev.key.toLowerCase()] = false; });

  let resizeTimer = 0;
  window.addEventListener("resize", function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      if(player || pausedAt !== null) stopPlayback();
      renderScore();
    }, 180);
  });
}

function boot(){
  loadState();
  loadProgress();
  renderProblems();
  bindProgress();
  renderProgress();
  renderSolfegeStrip();
  renderSolfegeBtn();
  renderPillBtn();
  renderSongs();
  renderRangeButtons();
  renderModes();
  renderVoices();
  renderMixer();
  renderFollowButton();
  renderHands();
  renderKeyboard();
  bindControls();
  const start = function(){
    renderScore();
    updateRangeInfo();
    updatePlayButtons();
  };
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(start).catch(start);
    setTimeout(start, 400);
  }else{
    start();
  }
  applyMix();
  renderVersion();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", boot);
}else{
  boot();
}

})();
