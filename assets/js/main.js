
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
