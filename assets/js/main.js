
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  document.getElementById('taskbarClock').textContent = h + ':' + m;
}
updateClock();
setInterval(updateClock, 10000);
