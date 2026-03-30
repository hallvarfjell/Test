// ui.js
export function bindButton(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", fn);
}

export function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

export function setVisible(id, v) {
  const el = document.getElementById(id);
  if (el) el.hidden = !v;
}
