/* ===== MUSICAL SCALES ===== */
const S = {
  cP: [261.63, 293.66, 329.63, 392, 440],
  aP: [220, 261.63, 293.66, 329.63, 392],
  fM: [174.61, 196, 220, 233.08, 261.63, 293.66, 329.63],
  dM: [293.66, 329.63, 349.23, 392, 440, 466.16, 523.25],
  gM: [196, 220, 246.94, 261.63, 293.66, 329.63, 369.99],
  eM: [329.63, 369.99, 415.3, 440, 493.88, 554.37, 622.25],
  cM: [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88],
  aM: [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392],
  bP: [246.94, 293.66, 329.63, 369.99, 440],
  bbM: [233.08, 261.63, 293.66, 311.13, 349.23, 392, 440],
  dMj: [293.66, 329.63, 369.99, 392, 440, 493.88, 554.37],
  ebM: [311.13, 349.23, 369.99, 415.3, 466.16, 493.88, 554.37],
};

/* ===== NOTE GENERATOR ===== */
function gen(sc, bpm, dur, pat, oct = 0) {
  const n = [],
    bd = 60 / bpm,
    tot = Math.floor(dur / bd),
    L = sc.length;
  for (let i = 0; i < tot; i++) {
    let x;
    switch (pat) {
      case "a":
        x = i % L;
        break;
      case "d":
        x = L - 1 - (i % L);
        break;
      case "p":
        {
          const c = L * 2 - 2,
            p = i % c;
          x = p < L ? p : c - p;
        }
        break;
      case "r":
        x = [0, 2 % L, 4 % L, 2 % L][i % 4];
        break;
      case "w":
        x = Math.round(((Math.sin(i * 0.25) + 1) / 2) * (L - 1));
        break;
      case "s":
        x = Math.floor(i / 2) % L;
        break;
      case "b":
        x = [0, 4 % L, 1, 3 % L, 2, 4 % L][i % 6];
        break;
      case "x":
        x = (i * 3) % L;
        break;
      case "t":
        x = [0, 2 % L, 4 % L, 0, 3 % L, 1 % L][i % 6];
        break;
      case "j":
        x = [0, 4 % L, 2 % L, 4 % L, 0, 3 % L, 1 % L, 3 % L][i % 8];
        break;
      default:
        x = i % L;
    }
    n.push({ freq: sc[x] * Math.pow(2, oct), time: i * bd });
  }
  return n;
}

/* ===== 16 TRACKS ===== */
const T = [
  {
    title: "Midnight Drive",
    artist: "Neon Collective",
    dur: 42,
    grad: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
    bg: "#1a1a3e",
    tags: ["Ambient", "Chill"],
    ly: [
      { t: "sine", v: 0.22, n: () => gen(S.cP, 72, 42, "w") },
      { t: "triangle", v: 0.07, n: () => gen(S.cP, 36, 42, "a", 1) },
    ],
  },
  {
    title: "Neon Lights",
    artist: "Synthwave Radio",
    dur: 36,
    grad: "linear-gradient(135deg,#f5af19,#f12711)",
    bg: "#3a2008",
    tags: ["Synth", "Energetic"],
    ly: [
      { t: "square", v: 0.1, n: () => gen(S.aP, 110, 36, "r") },
      { t: "sine", v: 0.08, n: () => gen(S.aP, 55, 36, "s", -1) },
    ],
  },
  {
    title: "Ocean Waves",
    artist: "Ambient Shores",
    dur: 48,
    grad: "linear-gradient(135deg,#0052D4,#65C7F7,#9CECFB)",
    bg: "#0a2540",
    tags: ["Ambient", "Nature"],
    ly: [
      { t: "sine", v: 0.2, n: () => gen(S.fM, 55, 48, "p") },
      { t: "sine", v: 0.05, n: () => gen(S.fM, 28, 48, "d", 1) },
    ],
  },
  {
    title: "Digital Dreams",
    artist: "Pixel Beats",
    dur: 34,
    grad: "linear-gradient(135deg,#11998e,#38ef7d)",
    bg: "#0a2e24",
    tags: ["Electronic", "Upbeat"],
    ly: [
      { t: "sawtooth", v: 0.07, n: () => gen(S.dM, 130, 34, "x") },
      { t: "square", v: 0.04, n: () => gen(S.dM, 65, 34, "b", 1) },
    ],
  },
  {
    title: "Sunset Boulevard",
    artist: "Lo-Fi Café",
    dur: 44,
    grad: "linear-gradient(135deg,#ee9ca7,#ffdde1)",
    bg: "#2e1a1d",
    tags: ["Lo-Fi", "Relax"],
    ly: [
      { t: "triangle", v: 0.18, n: () => gen(S.gM, 68, 44, "a") },
      { t: "sine", v: 0.07, n: () => gen(S.gM, 34, 44, "s", -1) },
    ],
  },
  {
    title: "Electric Feel",
    artist: "Bass Nation",
    dur: 32,
    grad: "linear-gradient(135deg,#8E2DE2,#4A00E0)",
    bg: "#1a0a38",
    tags: ["Bass", "Dance"],
    ly: [
      { t: "square", v: 0.09, n: () => gen(S.aP, 125, 32, "b") },
      { t: "sawtooth", v: 0.04, n: () => gen(S.aP, 62, 32, "a", -1) },
    ],
  },
  {
    title: "Starlight",
    artist: "Cosmic Drift",
    dur: 40,
    grad: "linear-gradient(135deg,#141E30,#243B55)",
    bg: "#0e1520",
    tags: ["Space", "Ethereal"],
    ly: [
      { t: "sine", v: 0.15, n: () => gen(S.cM, 80, 40, "d", 1) },
      { t: "triangle", v: 0.07, n: () => gen(S.cM, 40, 40, "w") },
    ],
  },
  {
    title: "Retrowave",
    artist: "80s Revival",
    dur: 36,
    grad: "linear-gradient(135deg,#FF0099,#493240)",
    bg: "#2a0a1a",
    tags: ["Retro", "Synth"],
    ly: [
      { t: "sawtooth", v: 0.08, n: () => gen(S.eM, 115, 36, "r") },
      { t: "square", v: 0.04, n: () => gen(S.eM, 57, 36, "x", 1) },
    ],
  },
  {
    title: "Crystal Cave",
    artist: "Echo Chamber",
    dur: 38,
    grad: "linear-gradient(135deg,#43cea2,#185a9d)",
    bg: "#0c2a30",
    tags: ["Ambient", "Ethereal"],
    ly: [
      { t: "sine", v: 0.18, n: () => gen(S.bP, 66, 38, "t") },
      { t: "triangle", v: 0.06, n: () => gen(S.bP, 33, 38, "p", 1) },
    ],
  },
  {
    title: "Tokyo Drift",
    artist: "Neon District",
    dur: 30,
    grad: "linear-gradient(135deg,#fc4a1a,#f7b733)",
    bg: "#3a1a08",
    tags: ["Electronic", "Intense"],
    ly: [
      { t: "sawtooth", v: 0.08, n: () => gen(S.dM, 140, 30, "x") },
      { t: "square", v: 0.05, n: () => gen(S.aP, 70, 30, "b") },
    ],
  },
  {
    title: "Rainy Day",
    artist: "Window Seat",
    dur: 46,
    grad: "linear-gradient(135deg,#606c88,#3f4c6b)",
    bg: "#1a1e28",
    tags: ["Lo-Fi", "Mellow"],
    ly: [
      { t: "triangle", v: 0.16, n: () => gen(S.aM, 58, 46, "w") },
      { t: "sine", v: 0.06, n: () => gen(S.aM, 29, 46, "a", -1) },
    ],
  },
  {
    title: "Cyber Punk",
    artist: "Glitch Mode",
    dur: 28,
    grad: "linear-gradient(135deg,#00d2ff,#3a7bd5)",
    bg: "#082030",
    tags: ["Electronic", "Dark"],
    ly: [
      { t: "square", v: 0.08, n: () => gen(S.ebM, 135, 28, "j") },
      { t: "sawtooth", v: 0.05, n: () => gen(S.dM, 67, 28, "x", 1) },
    ],
  },
  {
    title: "Morning Coffee",
    artist: "Warm Tones",
    dur: 50,
    grad: "linear-gradient(135deg,#f2994a,#f2c94c)",
    bg: "#302008",
    tags: ["Acoustic", "Warm"],
    ly: [
      { t: "triangle", v: 0.2, n: () => gen(S.dMj, 62, 50, "a") },
      { t: "sine", v: 0.08, n: () => gen(S.gM, 31, 50, "s") },
    ],
  },
  {
    title: "Aurora Borealis",
    artist: "Arctic Sound",
    dur: 44,
    grad: "linear-gradient(135deg,#00c9ff,#92fe9d)",
    bg: "#0a2828",
    tags: ["Space", "Ambient"],
    ly: [
      { t: "sine", v: 0.17, n: () => gen(S.bbM, 52, 44, "p") },
      { t: "sine", v: 0.06, n: () => gen(S.cP, 26, 44, "w", 1) },
    ],
  },
  {
    title: "Street Lights",
    artist: "Urban Chill",
    dur: 36,
    grad: "linear-gradient(135deg,#f953c6,#b91d73)",
    bg: "#2a0a22",
    tags: ["Pop", "Chill"],
    ly: [
      { t: "sine", v: 0.14, n: () => gen(S.gM, 96, 36, "t") },
      { t: "triangle", v: 0.06, n: () => gen(S.cP, 48, 36, "r") },
    ],
  },
  {
    title: "Vapor Trail",
    artist: "Cloud Nine",
    dur: 40,
    grad: "linear-gradient(135deg,#a18cd1,#fbc2eb)",
    bg: "#20152a",
    tags: ["Retro", "Dreamy"],
    ly: [
      { t: "sawtooth", v: 0.07, n: () => gen(S.bbM, 78, 40, "j") },
      { t: "sine", v: 0.09, n: () => gen(S.cM, 39, 40, "d", 1) },
    ],
  },
];

/* ===== SYNTH ENGINE WITH EQ ===== */
class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.oscs = [];
    this.playing = false;
    this.startedAt = 0;
    this.pausedAt = 0;
    this.eqB = null;
    this.eqM = null;
    this.eqT = null;
  }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.eqB = this.ctx.createBiquadFilter();
    this.eqB.type = "lowshelf";
    this.eqB.frequency.value = 200;
    this.eqB.gain.value = 0;
    this.eqM = this.ctx.createBiquadFilter();
    this.eqM.type = "peaking";
    this.eqM.frequency.value = 1000;
    this.eqM.Q.value = 1;
    this.eqM.gain.value = 0;
    this.eqT = this.ctx.createBiquadFilter();
    this.eqT.type = "highshelf";
    this.eqT.frequency.value = 3000;
    this.eqT.gain.value = 0;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.master.connect(this.eqB);
    this.eqB.connect(this.eqM);
    this.eqM.connect(this.eqT);
    this.eqT.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }
  play(tr, from = 0) {
    this.init();
    this.stop();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.startedAt = this.ctx.currentTime - from;
    this.pausedAt = 0;
    this.playing = true;
    tr.ly.forEach((L) => {
      const o = this.ctx.createOscillator(),
        g = this.ctx.createGain();
      o.type = L.t;
      o.connect(g);
      g.connect(this.master);
      const notes = L.n();
      let initF = notes[0]?.freq || 440;
      for (let i = notes.length - 1; i >= 0; i--) {
        if (notes[i].time <= from) {
          initF = notes[i].freq;
          break;
        }
      }
      o.frequency.value = initF;
      g.gain.value = L.v;
      notes.forEach((nt) => {
        const t = this.startedAt + nt.time;
        if (nt.time >= from - 0.05) {
          const st = Math.max(t, this.ctx.currentTime);
          o.frequency.setValueAtTime(nt.freq, st);
        }
      });
      o.start();
      o.stop(this.startedAt + tr.dur + 0.5);
      this.oscs.push({ o, g });
    });
  }
  stop() {
    this.oscs.forEach(({ o, g }) => {
      try {
        g.gain.cancelScheduledValues(this.ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
        setTimeout(() => {
          try {
            o.stop();
            o.disconnect();
            g.disconnect();
          } catch (e) {}
        }, 40);
      } catch (e) {}
    });
    this.oscs = [];
    this.playing = false;
  }
  pause() {
    if (!this.playing) return;
    this.pausedAt = this.elapsed();
    this.stop();
  }
  elapsed() {
    return this.playing ? this.ctx.currentTime - this.startedAt : this.pausedAt;
  }
  setVol(v) {
    if (this.master) this.master.gain.value = v;
  }
  setEQ(type, val) {
    this.init();
    if (type === "bass") this.eqB.gain.value = val;
    if (type === "mid") this.eqM.gain.value = val;
    if (type === "treble") this.eqT.gain.value = val;
  }
  freqData() {
    if (!this.analyser) return new Uint8Array(0);
    const d = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(d);
    return d;
  }
}

/* ===== STATE ===== */
const synth = new Synth();
let cur = -1,
  isPlaying = false,
  vol = 0.7,
  muted = false,
  prevVol = 0.7;
let shuffleOn = false,
  repeatOn = false,
  liked = new Set(),
  recent = [];
let shuffleQ = [],
  shuffleIdx = 0,
  draggingP = false,
  draggingV = false;
let currentView = "home",
  activeGenre = "All";

/* ===== DOM ===== */
const $ = (id) => document.getElementById(id);
const playlistEl = $("playlist"),
  playBtn = $("playBtn"),
  prevBtn = $("prevBtn"),
  nextBtn = $("nextBtn");
const shuffleBtn = $("shuffleBtn"),
  repeatBtn = $("repeatBtn"),
  likeBtn = $("likeBtn");
const progFill = $("progFill"),
  progDot = $("progDot"),
  progWrap = $("progWrap");
const volFill = $("volFill"),
  volDot = $("volDot"),
  volWrap = $("volWrap"),
  volBtn = $("volBtn");
const curTimeEl = $("curTime"),
  totTimeEl = $("totTime");
const pbTitle = $("pbTitle"),
  pbArtist = $("pbArtist"),
  pbThumb = $("pbThumb");
const trkTitle = $("trkTitle"),
  trkArtist = $("trkArtist"),
  trkTags = $("trkTags");
const albumArt = $("albumArt"),
  artGlow = $("artGlow"),
  vinyl = $("vinyl"),
  mainArea = $("mainArea");
const canvas = $("visualizer"),
  cx = canvas.getContext("2d");
const icoPlay = document.querySelector(".ico-play"),
  icoPause = document.querySelector(".ico-pause");
const icoVol = document.querySelector(".ico-vol"),
  icoMute = document.querySelector(".ico-mute");
const searchInput = $("searchInput"),
  searchClear = $("searchClear"),
  searchGrid = $("searchGrid");
const genrePills = $("genrePills"),
  eqPanel = $("eqPanel");
const upNextList = $("upNextList");

function fmt(s) {
  const m = Math.floor(s / 60),
    sec = Math.floor(s % 60);
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

/* ===== NAV ===== */
document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", () => {
    const v = el.dataset.view;
    if (!v) return;
    document
      .querySelectorAll(".nav-item")
      .forEach((n) => n.classList.remove("active"));
    el.classList.add("active");
    document
      .querySelectorAll(".view")
      .forEach((vw) => vw.classList.remove("active"));
    $(
      v === "home" ? "viewHome" : v === "search" ? "viewSearch" : "viewLibrary"
    ).classList.add("active");
    currentView = v;
    if (v === "search") renderSearch();
    if (v === "library") renderLibrary();
    if (v === "search") setTimeout(() => searchInput.focus(), 100);
  });
});

/* ===== PLAYLIST ===== */
function renderPlaylist() {
  $("trackCount").textContent = T.length + " tracks";
  playlistEl.innerHTML = "";
  T.forEach((t, i) => {
    const li = document.createElement("li");
    li.className = "pl-item" + (i === cur ? " active" : "");
    const isActive = i === cur;
    const idxHtml =
      isActive && isPlaying
        ? `<div class="playing-bars${
            isPlaying ? "" : " paused"
          }"><span></span><span></span><span></span></div>`
        : `<span class="pl-idx">${i + 1}</span>`;
    li.innerHTML = `${idxHtml}<div class="pl-dot" style="background:${
      t.grad
    }"></div><div class="pl-meta"><div class="pl-name">${
      t.title
    }</div><div class="pl-sub">${t.artist} · ${fmt(t.dur)}</div></div>`;
    li.onclick = () => playTrack(i);
    playlistEl.appendChild(li);
  });
}

/* ===== SEARCH ===== */
function getAllGenres() {
  const s = new Set();
  T.forEach((t) => t.tags.forEach((tg) => s.add(tg)));
  return ["All", ...[...s].sort()];
}
function renderGenrePills() {
  genrePills.innerHTML = "";
  getAllGenres().forEach((g) => {
    const btn = document.createElement("button");
    btn.className = "genre-pill" + (g === activeGenre ? " active" : "");
    btn.textContent = g;
    btn.onclick = () => {
      activeGenre = g;
      renderGenrePills();
      renderSearch();
    };
    genrePills.appendChild(btn);
  });
}
function renderSearch() {
  renderGenrePills();
  const q = searchInput.value.toLowerCase().trim();
  searchClear.classList.toggle("show", q.length > 0);
  let filtered = T.map((t, i) => ({ ...t, idx: i }));
  if (activeGenre !== "All")
    filtered = filtered.filter((t) => t.tags.includes(activeGenre));
  if (q)
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.tags.some((tg) => tg.toLowerCase().includes(q))
    );
  if (!filtered.length) {
    searchGrid.innerHTML =
      '<div class="search-empty">No tracks found. Try a different search.</div>';
    return;
  }
  searchGrid.innerHTML = "";
  filtered.forEach((t) => {
    const card = document.createElement("div");
    card.className = "s-card";
    card.innerHTML = `<div class="s-card-art" style="background:${
      t.grad
    }"><div class="s-card-play"><svg viewBox="0 0 24 24" width="20" height="20" fill="#000"><path d="M8 5v14l11-7z"/></svg></div></div><div class="s-card-name">${
      t.title
    }</div><div class="s-card-sub">${t.artist} · ${fmt(t.dur)}</div>`;
    card.onclick = () => {
      playTrack(t.idx);
      switchView("home");
    };
    searchGrid.appendChild(card);
  });
}
searchInput.addEventListener("input", renderSearch);
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  renderSearch();
  searchInput.focus();
});

/* ===== LIBRARY ===== */
function renderLibrary() {
  // Liked
  const likedArr = [...liked].map((i) => ({ ...T[i], idx: i }));
  $("likedEmpty").style.display = likedArr.length ? "none" : "block";
  $("likedList").innerHTML = "";
  likedArr.forEach((t, n) => {
    $("likedList").appendChild(makeLibItem(t, n + 1));
  });
  // Recent
  const recentArr = recent.map((i) => ({ ...T[i], idx: i }));
  $("recentEmpty").style.display = recentArr.length ? "none" : "block";
  $("recentList").innerHTML = "";
  recentArr.forEach((t, n) => {
    $("recentList").appendChild(makeLibItem(t, n + 1));
  });
  // All
  $("allList").innerHTML = "";
  T.forEach((t, i) => {
    $("allList").appendChild(makeLibItem({ ...t, idx: i }, i + 1));
  });
}
function makeLibItem(t, num) {
  const d = document.createElement("div");
  d.className = "lib-item" + (t.idx === cur ? " active" : "");
  d.innerHTML = `<span class="lib-num">${num}</span><div class="lib-art" style="background:${
    t.grad
  }"></div><div class="lib-info"><div class="lib-name">${
    t.title
  }</div><div class="lib-sub">${
    t.artist
  }</div></div><span class="lib-dur">${fmt(t.dur)}</span>`;
  d.onclick = () => {
    playTrack(t.idx);
    switchView("home");
  };
  return d;
}

/* ===== VIEW SWITCH ===== */
function switchView(v) {
  document.querySelectorAll(".nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.view === v);
  });
  document
    .querySelectorAll(".view")
    .forEach((vw) => vw.classList.remove("active"));
  $(
    v === "home" ? "viewHome" : v === "search" ? "viewSearch" : "viewLibrary"
  ).classList.add("active");
  currentView = v;
}

/* ===== UP NEXT ===== */
function renderUpNext() {
  upNextList.innerHTML = "";
  if (cur < 0) return;
  const next = [];
  for (let i = 1; i <= 3; i++) {
    let idx;
    if (shuffleOn) {
      idx = shuffleQ[(shuffleIdx + i) % shuffleQ.length];
    } else {
      idx = (cur + i) % T.length;
    }
    next.push(idx);
  }
  next.forEach((idx) => {
    const t = T[idx];
    const d = document.createElement("div");
    d.className = "un-item";
    d.innerHTML = `<div class="un-dot" style="background:${
      t.grad
    }"></div><div class="un-info"><div class="un-name">${
      t.title
    }</div><div class="un-sub">${t.artist} · ${fmt(t.dur)}</div></div>`;
    d.onclick = () => playTrack(idx);
    upNextList.appendChild(d);
  });
}

/* ===== PLAY TRACK ===== */
function playTrack(idx, from = 0) {
  cur = idx;
  const t = T[cur];
  synth.play(t, from);
  isPlaying = true;
  // Add to recent
  recent = recent.filter((i) => i !== idx);
  recent.unshift(idx);
  if (recent.length > 10) recent.pop();
  updateUI();
}
function togglePlay() {
  if (cur < 0) {
    playTrack(0);
    return;
  }
  if (isPlaying) {
    synth.pause();
    isPlaying = false;
  } else {
    synth.play(T[cur], synth.pausedAt);
    isPlaying = true;
  }
  updateUI();
}
function nextTrack() {
  if (cur < 0) {
    playTrack(0);
    return;
  }
  let nx;
  if (shuffleOn) {
    shuffleIdx++;
    if (shuffleIdx >= shuffleQ.length) genShuffleQ();
    nx = shuffleQ[shuffleIdx];
  } else {
    nx = cur + 1;
    if (nx >= T.length) nx = repeatOn ? 0 : -1;
  }
  if (nx < 0) {
    synth.stop();
    isPlaying = false;
    updateUI();
    return;
  }
  playTrack(nx);
}
function prevTrack() {
  if (cur < 0) return;
  if (synth.elapsed() > 3) {
    playTrack(cur);
    return;
  }
  let pv;
  if (shuffleOn) {
    shuffleIdx = Math.max(0, shuffleIdx - 1);
    pv = shuffleQ[shuffleIdx];
  } else {
    pv = cur - 1;
    if (pv < 0) pv = repeatOn ? T.length - 1 : 0;
  }
  playTrack(pv);
}
function genShuffleQ() {
  shuffleQ = [...Array(T.length).keys()];
  for (let i = shuffleQ.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffleQ[i], shuffleQ[j]] = [shuffleQ[j], shuffleQ[i]];
  }
  shuffleIdx = 0;
}

/* ===== UI UPDATE ===== */
function updateUI() {
  icoPlay.style.display = isPlaying ? "none" : "block";
  icoPause.style.display = isPlaying ? "block" : "none";
  vinyl.classList.toggle("spinning", isPlaying);
  if (cur >= 0) {
    const t = T[cur];
    trkTitle.textContent = t.title;
    trkArtist.textContent = t.artist;
    trkTags.innerHTML = t.tags
      .map((tg) => `<span class="tag">${tg}</span>`)
      .join("");
    pbTitle.textContent = t.title;
    pbArtist.textContent = t.artist;
    albumArt.style.background = t.grad;
    pbThumb.style.background = t.grad;
    artGlow.style.background = t.grad;
    mainArea.style.background = `linear-gradient(180deg,${t.bg} 0%,#121212 50%)`;
    totTimeEl.textContent = fmt(t.dur);
  }
  renderPlaylist();
  renderUpNext();
  likeBtn.classList.toggle("liked", liked.has(cur));
  shuffleBtn.classList.toggle("active", shuffleOn);
  repeatBtn.classList.toggle("active", repeatOn);
}

/* ===== TICK ===== */
function tick() {
  if (isPlaying && cur >= 0) {
    const el = synth.elapsed(),
      t = T[cur];
    if (el >= t.dur) {
      if (repeatOn && !shuffleOn) playTrack(cur);
      else nextTrack();
      return requestAnimationFrame(tick);
    }
    if (!draggingP) {
      const pct = Math.min((el / t.dur) * 100, 100);
      progFill.style.width = pct + "%";
      progDot.style.left = pct + "%";
      curTimeEl.textContent = fmt(el);
    }
  }
  drawViz();
  requestAnimationFrame(tick);
}

/* ===== VISUALIZER ===== */
function drawViz() {
  const W = canvas.width,
    H = canvas.height;
  cx.clearRect(0, 0, W, H);
  const d = synth.freqData();
  if (!d.length) return;
  const bars = 48,
    step = Math.floor(d.length / bars),
    bw = W / bars;
  for (let i = 0; i < bars; i++) {
    const val = d[i * step] / 255,
      h = val * H * 0.7,
      x = i * bw;
    const g = cx.createLinearGradient(x, H, x, H - h);
    g.addColorStop(0, "rgba(29,185,84,.8)");
    g.addColorStop(1, "rgba(29,185,84,.1)");
    cx.fillStyle = g;
    cx.fillRect(x + 1, H - h, bw - 2, h);
  }
}

/* ===== SLIDER HELPERS ===== */
function sliderPct(wrap, e) {
  const r = wrap.getBoundingClientRect();
  return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
}
function sliderPctTouch(wrap, e) {
  const r = wrap.getBoundingClientRect();
  return Math.max(0, Math.min(1, (e.touches[0].clientX - r.left) / r.width));
}

// Progress
progWrap.addEventListener("mousedown", (e) => {
  draggingP = true;
  seekTo(e);
});
progWrap.addEventListener(
  "touchstart",
  (e) => {
    draggingP = true;
    seekToT(e);
  },
  { passive: false }
);
document.addEventListener("mousemove", (e) => {
  if (draggingP) seekTo(e);
});
document.addEventListener(
  "touchmove",
  (e) => {
    if (draggingP) seekToT(e);
  },
  { passive: false }
);
document.addEventListener("mouseup", finishSeek);
document.addEventListener("touchend", finishSeek);
function seekTo(e) {
  if (cur < 0) return;
  const p = sliderPct(progWrap, e) * 100;
  progFill.style.width = p + "%";
  progDot.style.left = p + "%";
  curTimeEl.textContent = fmt((p / 100) * T[cur].dur);
}
function seekToT(e) {
  if (cur < 0) return;
  e.preventDefault();
  const p = sliderPctTouch(progWrap, e) * 100;
  progFill.style.width = p + "%";
  progDot.style.left = p + "%";
  curTimeEl.textContent = fmt((p / 100) * T[cur].dur);
}
function finishSeek() {
  if (draggingP && cur >= 0) {
    const pct = parseFloat(progFill.style.width) / 100,
      time = pct * T[cur].dur,
      wp = isPlaying;
    synth.stop();
    isPlaying = false;
    if (wp) playTrack(cur, time);
    else {
      synth.pausedAt = time;
      updateUI();
    }
  }
  draggingP = false;
}

// Volume
volWrap.addEventListener("mousedown", (e) => {
  draggingV = true;
  setVolFrom(e);
});
volWrap.addEventListener(
  "touchstart",
  (e) => {
    draggingV = true;
    setVolFromT(e);
  },
  { passive: false }
);
document.addEventListener("mousemove", (e) => {
  if (draggingV) setVolFrom(e);
});
document.addEventListener(
  "touchmove",
  (e) => {
    if (draggingV) setVolFromT(e);
  },
  { passive: false }
);
document.addEventListener("mouseup", () => {
  draggingV = false;
});
document.addEventListener("touchend", () => {
  draggingV = false;
});
function setVolFrom(e) {
  const p = sliderPct(volWrap, e);
  applyVol(p);
}
function setVolFromT(e) {
  e.preventDefault();
  const p = sliderPctTouch(volWrap, e);
  applyVol(p);
}
function applyVol(p) {
  vol = p;
  muted = false;
  synth.setVol(vol);
  volFill.style.width = p * 100 + "%";
  volDot.style.left = p * 100 + "%";
  updateVolIcon();
}
function updateVolIcon() {
  icoVol.style.display = muted ? "none" : "block";
  icoMute.style.display = muted ? "block" : "none";
}
volBtn.onclick = () => {
  if (muted) {
    muted = false;
    synth.setVol(vol);
    volFill.style.width = vol * 100 + "%";
    volDot.style.left = vol * 100 + "%";
  } else {
    prevVol = vol;
    muted = true;
    synth.setVol(0);
    volFill.style.width = "0%";
    volDot.style.left = "0%";
  }
  updateVolIcon();
};

/* ===== BUTTONS ===== */
playBtn.onclick = togglePlay;
nextBtn.onclick = nextTrack;
prevBtn.onclick = prevTrack;
shuffleBtn.onclick = () => {
  shuffleOn = !shuffleOn;
  if (shuffleOn) genShuffleQ();
  updateUI();
};
repeatBtn.onclick = () => {
  repeatOn = !repeatOn;
  updateUI();
};
likeBtn.onclick = () => {
  if (cur < 0) return;
  liked.has(cur) ? liked.delete(cur) : liked.add(cur);
  updateUI();
};

/* ===== EQ ===== */
$("eqBtn").onclick = () => eqPanel.classList.toggle("show");
$("eqClose").onclick = () => eqPanel.classList.remove("show");
["Bass", "Mid", "Treble"].forEach((name) => {
  const input = $("eq" + name),
    label = $("eq" + (name === "Treble" ? "Treb" : name) + "V");
  input.addEventListener("input", () => {
    const v = parseInt(input.value);
    label.textContent = v;
    synth.setEQ(name.toLowerCase(), v);
    document
      .querySelectorAll(".eq-pre")
      .forEach((b) => b.classList.remove("active"));
  });
});
document.querySelectorAll(".eq-pre").forEach((btn) => {
  btn.onclick = () => {
    const presets = {
      flat: [0, 0, 0],
      bass: [8, -2, -1],
      treble: [-1, 0, 8],
      vocal: [-3, 6, 2],
    };
    const p = presets[btn.dataset.p];
    ["Bass", "Mid", "Treble"].forEach((n, i) => {
      const input = $("eq" + n);
      input.value = p[i];
      input.dispatchEvent(new Event("input"));
    });
    document
      .querySelectorAll(".eq-pre")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  };
});

/* ===== KEYBOARD ===== */
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
  if (e.code === "ArrowRight") nextTrack();
  if (e.code === "ArrowLeft") prevTrack();
  if (e.code === "ArrowUp") {
    e.preventDefault();
    vol = Math.min(1, vol + 0.05);
    synth.setVol(vol);
    volFill.style.width = vol * 100 + "%";
    volDot.style.left = vol * 100 + "%";
  }
  if (e.code === "ArrowDown") {
    e.preventDefault();
    vol = Math.max(0, vol - 0.05);
    synth.setVol(vol);
    volFill.style.width = vol * 100 + "%";
    volDot.style.left = vol * 100 + "%";
  }
  if (e.code === "KeyL" && cur >= 0) {
    liked.has(cur) ? liked.delete(cur) : liked.add(cur);
    updateUI();
  }
  if (e.code === "KeyS") {
    shuffleOn = !shuffleOn;
    if (shuffleOn) genShuffleQ();
    updateUI();
  }
  if (e.code === "KeyR") {
    repeatOn = !repeatOn;
    updateUI();
  }
});

/* ===== INIT ===== */
renderPlaylist();
renderGenrePills();
renderSearch();
requestAnimationFrame(tick);
