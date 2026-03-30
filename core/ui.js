// ============================================================================
// INTZ v11 – ui.js
// Minimal and robust UI helper module for INTZ SPA.
// ============================================================================

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function onClick(id, fn) {
  const el = typeof id === "string" ? qs("#" + id) : id;
  if (el) el.addEventListener("click", fn);
}

export function onInput(id, fn) {
  const el = typeof id === "string" ? qs("#" + id) : id;
  if (el) el.addEventListener("input", fn);
}

export function bindDelegated(containerSel, selector, fn) {
  const container = qs(containerSel);
  if (!container) return;
  container.addEventListener("click", ev => {
    const target = ev.target.closest(selector);
    if (target) fn(ev, target);
  });
}

export function findParent(el, selector) {
  while (el && el !== document) {
    if (el.matches(selector)) return el;
    el = el.parentElement;
  }
  return null;
}

export function setText(id, txt) {
  const el = qs("#" + id);
  if (el) el.textContent = txt;
}

export function setHTML(id, html) {
  const el = qs("#" + id);
  if (el) el.innerHTML = html;
}

export function setValue(id, v) {
  const el = qs("#" + id);
  if (el) el.value = v;
}

export function getValue(id) {
  const el = qs("#" + id);
  return el ? el.value : null;
}

export function show(id) {
  const el = qs("#" + id);
  if (el) el.hidden = false;
}

export function hide(id) {
  const el = qs("#" + id);
  if (el) el.hidden = true;
}

export function setVisible(id, visible) {
  const el = qs("#" + id);
  if (el) el.hidden = !visible;
}

export function addClass(id, cls) {
  const el = qs("#" + id);
  if (el) el.classList.add(cls);
}

export function removeClass(id, cls) {
  const el = qs("#" + id);
  if (el) el.classList.remove(cls);
}

export function toggleClass(id, cls, cond) {
  const el = qs("#" + id);
  if (!el) return;
  if (cond) el.classList.add(cls);
  else el.classList.remove(cls);
}
``
