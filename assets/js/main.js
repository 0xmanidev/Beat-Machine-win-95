
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  document.getElementById('taskbarClock').textContent = h + ':' + m;
}
updateClock();
setInterval(updateClock, 10000);

(function(){
  const win      = document.getElementById('appWindow');
  const bar      = document.getElementById('titlebar');
  const btns     = document.getElementById('titleBtns');
  const body     = document.getElementById('appBody');
  const taskBtn  = document.getElementById('taskbarAppBtn');

  let dragging = false, ox = 0, oy = 0, wx = 0, wy = 0;
  let minimized = false, maximized = false;
  let savedStyle = {};

  bar.addEventListener('mousedown', e => {
    if (btns.contains(e.target)) return;
    if (maximized) return;
    dragging = true;
    const r = win.getBoundingClientRect();
    ox = e.clientX; oy = e.clientY;
    wx = r.left;    wy = r.top;
    win.style.transform = 'none';
    win.style.left = wx + 'px';
    win.style.top  = wy + 'px';
    win.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - ox, dy = e.clientY - oy;
    let nx = wx + dx, ny = wy + dy;
    nx = Math.max(-win.offsetWidth + 80, Math.min(window.innerWidth - 80, nx));
    ny = Math.max(0, Math.min(window.innerHeight - 66, ny));
    win.style.left = nx + 'px';
    win.style.top  = ny + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; win.classList.remove('dragging'); }
  });

  bar.addEventListener('touchstart', e => {
    if (btns.contains(e.target) || maximized) return;
    const t = e.touches[0];
    dragging = true;
    const r = win.getBoundingClientRect();
    ox = t.clientX; oy = t.clientY;
    wx = r.left;    wy = r.top;
    win.style.transform = 'none';
    win.style.left = wx + 'px';
    win.style.top  = wy + 'px';
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - ox, dy = t.clientY - oy;
    let nx = wx + dx, ny = wy + dy;
    nx = Math.max(-win.offsetWidth + 80, Math.min(window.innerWidth - 80, nx));
    ny = Math.max(0, Math.min(window.innerHeight - 66, ny));
    win.style.left = nx + 'px';
    win.style.top  = ny + 'px';
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { dragging = false; });

  function setMinimized(state) {
    minimized = state;
    body.style.display = minimized ? 'none' : 'flex';
    taskBtn.classList.toggle('active', !minimized);
  }
  document.getElementById('minimizeBtn').addEventListener('click', () => setMinimized(true));

  document.getElementById('maximizeBtn').addEventListener('click', () => {
    maximized = !maximized;
    if (maximized) {
      savedStyle = {
        left: win.style.left, top: win.style.top,
        width: win.style.width, transform: win.style.transform
      };
      win.style.left = '0'; win.style.top = '0';
      win.style.width = '100%'; win.style.transform = 'none';
    } else {
      win.style.left = savedStyle.left || '8px';
      win.style.top  = savedStyle.top  || '8px';
      win.style.width = savedStyle.width || '';
      win.style.transform = savedStyle.transform || 'translateX(-50%)';
    }
  });

  function closeWindow() {
    win.style.display = 'none';
    taskBtn.classList.remove('active');
    taskBtn.style.fontStyle = 'italic';
  }
  document.getElementById('closeBtn').addEventListener('click', closeWindow);

  taskBtn.addEventListener('click', () => {
    if (win.style.display === 'none') {
      win.style.display = '';
      taskBtn.style.fontStyle = '';
      setMinimized(false);
    } else if (minimized) {
      setMinimized(false);
    } else {
      setMinimized(true);
    }
  });

  bar.addEventListener('dblclick', e => {
    if (btns.contains(e.target)) return;
    document.getElementById('maximizeBtn').click();
  });
})();

['vuLP','vuRV','vuDL','vuDR'].forEach(id => {
  const el = document.getElementById(id);
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('div');
    s.className = 'vu-seg';
    el.appendChild(s);
  }
});

function updateVU(id, lit) {
  document.querySelectorAll('#' + id + ' .vu-seg').forEach((s, i) => {
    s.classList.remove('lit','g','a','r');
    if (i < lit) s.classList.add('lit', i < 11 ? 'g' : i < 14 ? 'a' : 'r');
  });
}

let ctx = null, masterGain, filterNode, reverbNode, delayNode, distNode, analyserNode;
let reverbGain, dryGain, delayGain, vinylGain = null;
let isPlaying = false, currentStep = 0, schedulerTimer = null, nextNoteTime = 0;
let bpm = 85, swingAmount = 0, vinylAmount = 0.3, masterVolume = 0.75;

const STEPS  = 16;
const tracks = ['kick','snare','hihat','perc','bass','chord'];
const pattern = {};
tracks.forEach(t => { pattern[t] = new Array(STEPS).fill(false); });
const stepEls = {};
tracks.forEach(t => { stepEls[t] = new Array(STEPS); });

tracks.forEach(t => {
  const container = document.getElementById('sg-' + t);
  for (let g = 0; g < 4; g++) {
    const grp = document.createElement('div');
    grp.className = 'beat-group';
    for (let s = 0; s < 4; s++) {
      const idx = g * 4 + s;
      const cell = document.createElement('div');
      cell.className = 'step';
      cell.addEventListener('click', () => {
        pattern[t][idx] = !pattern[t][idx];
        cell.classList.toggle('on', pattern[t][idx]);
      });
      grp.appendChild(cell);
      stepEls[t][idx] = cell;
    }
    container.appendChild(grp);
  }
});


let lastStep = -1;
let beatLedTimer = null;

function flashBeatLed(beat) {
  for (let i = 0; i < 4; i++) {
    const el  = document.getElementById('bl' + i);
    const tel = document.getElementById('tbl' + i);
    if (el)  el.classList.remove('active');
    if (tel) tel.classList.remove('on');
  }
  const el  = document.getElementById('bl' + beat);
  const tel = document.getElementById('tbl' + beat);
  if (el)  el.classList.add('active');
  if (tel) tel.classList.add('on');
  clearTimeout(beatLedTimer);
  beatLedTimer = setTimeout(() => {
    if (el)  el.classList.remove('active');
    if (tel) tel.classList.remove('on');
  }, 120);
}

function updateUI(step) {
  if (lastStep >= 0) {
    tracks.forEach(t => {
      if (stepEls[t][lastStep]) stepEls[t][lastStep].classList.remove('now');
    });
  }
  tracks.forEach(t => {
    if (stepEls[t][step]) stepEls[t][step].classList.add('now');
  });
  lastStep = step;
  document.getElementById('stepCounter').textContent = (step + 1).toString().padStart(2, '0');
  flashBeatLed(Math.floor(step / 4));
}

const presets = {
  boomkit:  { kick:[1,0,0,0,1,0,0,1,0,0,1,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0], hihat:[1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1], perc:[0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0], bass:[1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0], chord:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] },
  dustkit:  { kick:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], perc:[0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,0], bass:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], chord:[0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1] },
  tapesoul: { kick:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], perc:[0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0], bass:[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0], chord:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0] },
  midloop:  { kick:[1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,0], snare:[0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0], hihat:[1,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0], perc:[0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0], bass:[1,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1], chord:[0,0,1,0,1,0,0,0,0,0,1,0,0,1,0,0] },
  vinylpack:{ kick:[1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0], snare:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], perc:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0], bass:[1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0], chord:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0] },
  basement: { kick:[1,0,1,0,0,0,0,1,0,0,1,0,0,1,0,0], snare:[0,0,0,0,1,0,0,0,0,1,0,0,1,0,0,0], hihat:[1,0,0,1,0,1,0,0,1,0,0,1,0,0,1,0], perc:[0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0], bass:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1], chord:[0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0] },
};

function loadPreset(name, el) {
  const p = presets[name];
  if (!p) return;
  tracks.forEach(t => {
    pattern[t] = p[t].map(v => !!v);
    stepEls[t].forEach((c, i) => c.classList.toggle('on', pattern[t][i]));
  });
  document.querySelectorAll('.preset-item').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
}

function clearAll() {
  tracks.forEach(t => {
    pattern[t].fill(false);
    stepEls[t].forEach(c => c.classList.remove('on'));
  });
  document.querySelectorAll('.preset-item').forEach(b => b.classList.remove('active'));
}

document.getElementById('presetList').addEventListener('click', e => {
  const item = e.target.closest('.preset-item');
  if (!item) return;
  loadPreset(item.dataset.preset, item);
});
document.getElementById('clearBtn').addEventListener('click', clearAll);


function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  analyserNode = ctx.createAnalyser(); analyserNode.fftSize = 512;
  masterGain = ctx.createGain(); masterGain.gain.value = masterVolume;
  distNode = ctx.createWaveShaper(); setDist(4);
  filterNode = ctx.createBiquadFilter(); filterNode.type = 'lowpass'; filterNode.frequency.value = 4000;
  reverbNode = ctx.createConvolver(); reverbNode.buffer = makeImpulse(2.5, 2.5);
  reverbGain = ctx.createGain(); reverbGain.gain.value = 0.35;
  dryGain = ctx.createGain(); dryGain.gain.value = 0.65;
  delayNode = ctx.createDelay(0.5); delayNode.delayTime.value = 60 / bpm * 0.375;
  const fb = ctx.createGain(); fb.gain.value = 0.35;
  delayGain = ctx.createGain(); delayGain.gain.value = 0.15;

  masterGain.connect(distNode);
  distNode.connect(filterNode);
  filterNode.connect(dryGain);
  filterNode.connect(reverbNode);
  filterNode.connect(delayNode);
  dryGain.connect(analyserNode);
  reverbNode.connect(reverbGain); reverbGain.connect(analyserNode);
  delayNode.connect(fb); fb.connect(delayNode);
  delayNode.connect(delayGain); delayGain.connect(analyserNode);
  analyserNode.connect(ctx.destination);

  vinylGain = ctx.createGain(); vinylGain.gain.value = vinylAmount * 0.04;
  vinylGain.connect(masterGain);
  startVinyl();
}

function makeImpulse(dur, decay) {
  const sr = ctx.sampleRate, len = sr * dur;
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function startVinyl() {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.5;
  src.connect(f); f.connect(vinylGain); src.start();
}

function setDist(a) {
  const c = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    c[i] = ((Math.PI + a) * x) / (Math.PI + a * Math.abs(x));
  }
  distNode.curve = c;
}

function playKick(t, v) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(masterGain);
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g.gain.setValueAtTime(v * 1.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.start(t); o.stop(t + 0.35);
  const n = ctx.createOscillator(), ng = ctx.createGain();
  n.type = 'square'; n.frequency.value = 180;
  n.connect(ng); ng.connect(masterGain);
  ng.gain.setValueAtTime(v * 0.3, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  n.start(t); n.stop(t + 0.03);
}

function playSnare(t, v) {
  const o = ctx.createOscillator(), og = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = 200;
  o.connect(og); og.connect(masterGain);
  og.gain.setValueAtTime(v * 0.6, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.start(t); o.stop(t + 0.15);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
  const ng = ctx.createGain();
  src.connect(f); f.connect(ng); ng.connect(masterGain);
  ng.gain.setValueAtTime(v * 0.8, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.start(t); src.stop(t + 0.2);
}

function playHihat(t, v, open) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ctx.createGain();
  src.connect(f); f.connect(g); g.connect(masterGain);
  const dur = open ? 0.25 : 0.06;
  g.gain.setValueAtTime(v * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.start(t); src.stop(t + dur + 0.01);
}

function playPerc(t, v) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.08);
  o.connect(g); g.connect(masterGain);
  g.gain.setValueAtTime(v * 0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.start(t); o.stop(t + 0.15);
}

const bassNotes = [55, 55, 65.41, 55, 49, 55, 73.42, 55];
let bassIdx = 0;

function playBass(t, v) {
  const freq = bassNotes[bassIdx++ % bassNotes.length];
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 600; o.type = 'sawtooth'; o.frequency.value = freq;
  o.connect(f); f.connect(g); g.connect(masterGain);
  g.gain.setValueAtTime(v * 0.8, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.start(t); o.stop(t + 0.5);
}

const chordSets = [
  [261.63,329.63,392.00,493.88],
  [220.00,277.18,329.63,415.30],
  [174.61,220.00,261.63,329.63],
  [196.00,246.94,293.66,369.99]
];
let chordIdx = 0;

function playChord(t, v) {
  chordSets[chordIdx++ % chordSets.length].forEach(freq => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2200; o.type = 'triangle';
    o.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.004);
    o.connect(f); f.connect(g); g.connect(masterGain);
    g.gain.setValueAtTime(v * 0.12, t);
    g.gain.setTargetAtTime(v * 0.07, t + 0.02, 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.start(t); o.stop(t + 0.75);
  });
}

function stepDur() { return (60 / bpm) / 4; }

function schedule() {
  while (nextNoteTime < ctx.currentTime + 0.1) {
    fireStep(currentStep, nextNoteTime);
    advance();
  }
  schedulerTimer = setTimeout(schedule, 25);
}

function advance() {
  const base = stepDur();
  const sw = (currentStep % 2 === 0) ? swingAmount * base * 0.5 : -swingAmount * base * 0.5;
  nextNoteTime += base + sw;
  currentStep = (currentStep + 1) % STEPS;
}

function getVols() {
  const v = {};
  document.querySelectorAll('.tvol').forEach(el => { v[el.dataset.t] = parseFloat(el.value); });
  return v;
}

function fireStep(step, time) {
  requestAnimationFrame(() => updateUI(step));
  const v = getVols();
  if (pattern.kick[step])  playKick(time, v.kick);
  if (pattern.snare[step]) playSnare(time, v.snare);
  if (pattern.hihat[step]) playHihat(time, v.hihat, step % 8 === 4);
  if (pattern.perc[step])  playPerc(time, v.perc);
  if (pattern.bass[step])  playBass(time, v.bass);
  if (pattern.chord[step]) playChord(time, v.chord);
}

function stopSequencer() {
  if (!isPlaying) return;
  clearTimeout(schedulerTimer); schedulerTimer = null;
  isPlaying = false;
  document.getElementById('playIcon').textContent  = '▶';
  document.getElementById('playLabel').textContent = 'PLAY';
  document.getElementById('playBtn').classList.remove('playing');
  document.getElementById('statusLed').classList.remove('on');
  document.getElementById('statusTxt').textContent = 'STOPPED';
  if (lastStep >= 0) {
    tracks.forEach(t => { if (stepEls[t][lastStep]) stepEls[t][lastStep].classList.remove('now'); });
  }
  lastStep = -1;
  document.getElementById('stepCounter').textContent = '--';
  for (let i = 0; i < 4; i++) {
    const el  = document.getElementById('bl' + i);
    const tel = document.getElementById('tbl' + i);
    if (el)  el.classList.remove('active');
    if (tel) tel.classList.remove('on');
  }
  clearTimeout(beatLedTimer);
}

function togglePlay() {
  if (!ctx) initAudio();
  if (ctx.state === 'suspended') ctx.resume();
  if (isPlaying) {
    stopSequencer();
  } else {
    isPlaying = true;
    currentStep = 0; bassIdx = 0; chordIdx = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    schedule();
    document.getElementById('playIcon').textContent  = '⏸';
    document.getElementById('playLabel').textContent = 'PAUSE';
    document.getElementById('playBtn').classList.add('playing');
    document.getElementById('statusLed').classList.add('on');
    document.getElementById('statusTxt').textContent = bpm + ' BPM';
    startVizLoop();
  }
}

document.getElementById('playBtn').addEventListener('click', togglePlay);

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    togglePlay();
  }
});


function changeBpm(d) {
  bpm = Math.max(40, Math.min(200, bpm + d));
  document.getElementById('bpmNum').textContent = bpm;
  if (delayNode) delayNode.delayTime.value = 60 / bpm * 0.375;
  if (isPlaying) document.getElementById('statusTxt').textContent = bpm + ' BPM';
}

document.getElementById('bpmDown1').addEventListener('click', () => changeBpm(-1));
document.getElementById('bpmUp1').addEventListener('click',   () => changeBpm(1));
document.getElementById('bpmDown5').addEventListener('click', () => changeBpm(-5));
document.getElementById('bpmUp5').addEventListener('click',   () => changeBpm(5));

document.getElementById('bpmDisplay').addEventListener('wheel', function(e) {
  e.preventDefault();
  changeBpm(e.deltaY < 0 ? 1 : -1);
}, { passive: false });

(function() {
  let dragging = false, lastY = 0;
  const disp = document.getElementById('bpmDisplay');
  disp.addEventListener('mousedown', e => { dragging = true; lastY = e.clientY; e.preventDefault(); });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dy = lastY - e.clientY;
    if (Math.abs(dy) >= 4) { changeBpm(dy > 0 ? 1 : -1); lastY = e.clientY; }
  });
  document.addEventListener('mouseup', () => { dragging = false; });
})();

document.getElementById('sSwing').addEventListener('input', function() {
  swingAmount = this.value / 100 * 0.4;
  document.getElementById('sSwingV').textContent = this.value + '%';
});
document.getElementById('sVinyl').addEventListener('input', function() {
  vinylAmount = this.value / 100;
  if (vinylGain) vinylGain.gain.value = vinylAmount * 0.04;
  document.getElementById('sVinylV').textContent = this.value + '%';
});
document.getElementById('sVol').addEventListener('input', function() {
  masterVolume = this.value / 100;
  if (masterGain) masterGain.gain.value = masterVolume;
  document.getElementById('sVolV').textContent = this.value + '%';
});
document.getElementById('fxLP').addEventListener('input', function() {
  if (filterNode) filterNode.frequency.value = +this.value;
  document.getElementById('fxLPV').textContent = Math.round(this.value) + ' Hz';
  updateVU('vuLP', Math.round((+this.value - 200) / (20000 - 200) * 16));
});
document.getElementById('fxRV').addEventListener('input', function() {
  const v = this.value / 100;
  if (reverbGain) { reverbGain.gain.value = v; dryGain.gain.value = 1 - v; }
  document.getElementById('fxRVV').textContent = this.value + '%';
  updateVU('vuRV', Math.round(this.value / 100 * 16));
});
document.getElementById('fxDL').addEventListener('input', function() {
  if (delayGain) delayGain.gain.value = this.value / 100;
  document.getElementById('fxDLV').textContent = this.value + '%';
  updateVU('vuDL', Math.round(this.value / 100 * 16));
});
document.getElementById('fxDR').addEventListener('input', function() {
  if (distNode) setDist(+this.value);
  document.getElementById('fxDRV').textContent = this.value + '×';
  updateVU('vuDR', Math.round((+this.value - 1) / 39 * 16));
});

updateVU('vuLP', Math.round((4000 - 200) / (20000 - 200) * 16));
updateVU('vuRV', Math.round(35  / 100 * 16));
updateVU('vuDL', Math.round(15  / 100 * 16));
updateVU('vuDR', Math.round(3   / 39  * 16));


const canvas = document.getElementById('vizCanvas');
const cctx   = canvas.getContext('2d');
let vizRunning = false;

function resizeCanvas() {
  canvas.width  = canvas.offsetWidth  * devicePixelRatio;
  canvas.height = canvas.offsetHeight * devicePixelRatio;
  if (!isPlaying) drawIdle();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function drawIdle() {
  const W = canvas.width, H = canvas.height;
  cctx.fillStyle = '#1a1a0a';
  cctx.fillRect(0, 0, W, H);
  cctx.strokeStyle = '#2a2a14';
  cctx.lineWidth = 1;
  cctx.beginPath(); cctx.moveTo(0, H / 2); cctx.lineTo(W, H / 2); cctx.stroke();
}
drawIdle();

function startVizLoop() {
  if (vizRunning) return;
  vizRunning = true;
  drawViz();
}

function drawViz() {
  if (!isPlaying) { vizRunning = false; drawIdle(); return; }
  requestAnimationFrame(drawViz);
  if (!analyserNode) return;
  const W = canvas.width, H = canvas.height;
  const bufLen = analyserNode.frequencyBinCount;
  const data   = new Uint8Array(bufLen);
  analyserNode.getByteTimeDomainData(data);
  cctx.fillStyle = 'rgba(26,26,10,0.6)';
  cctx.fillRect(0, 0, W, H);
  cctx.strokeStyle = '#f0a000';
  cctx.lineWidth = 1.5;
  cctx.beginPath();
  const sw = W / bufLen;
  let x = 0;
  for (let i = 0; i < bufLen; i++) {
    const v = data[i] / 128, y = v * H / 2;
    i === 0 ? cctx.moveTo(x, y) : cctx.lineTo(x, y);
    x += sw;
  }
  cctx.stroke();
  const rms = data.reduce((acc, v) => acc + Math.pow((v - 128) / 128, 2), 0) / bufLen;
  const level = Math.min(100, Math.sqrt(rms) * 200);
  document.getElementById('meterL').style.width = level + '%';
  document.getElementById('meterR').style.width = (level * (0.9 + Math.random() * 0.2)) + '%';
}

loadPreset('boomkit', document.querySelector('.preset-item[data-preset="boomkit"]'));
