// ============================================================================
// INTZ v11 – ui.js
// Minimal og robust UI-hjelpemodul for INTZ SPA.
//
// Funksjoner:
//   qs(), qsa()                → DOM short-hands
//   onClick(id, fn)            → bind click
//   onInput(id, fn)            → bind input
//   setText(id, txt)           → oppdaterer textContent
//   setHTML(id, html)          → oppdaterer innerHTML
//   setValue(id, v)            → setter input-verdi
//   getValue(id)               → leser input-verdi
//   show(id) / hide(id)        → toggle hidden
//   setVisible(id, bool)       → samme som over
//   addClass(id, cls)
//   removeClass(id, cls)
//   toggleClass(id, cls, cond)
//   findParent(el, selector)
//   bindDelegated(container, selector, fn)
//
// Ingen businesslogikk – dette er ren UI-hjelp.
// ============================================================================

// ----------------------------------------------------------------------------
// Query helpers
// ----------------------------------------------------------------------------

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

// ----------------------------------------------------------------------------
// Event helpers
// ----------------------------------------------------------------------------

export function onClick(id, fn) {
  const el = typeof id === "string" ? qs("#" + id) : id;
  if (el) el.addEventListener("click", fn);
}

export function onInput(id, fn) {
  const el = typeof id === "string" ? qs("#" + id) : id;
  if (el) el.addEventListener("input", fn);
}

// Delegert event – nyttig for dynamiske UI-lister
export function bindDelegated(containerSel, selector, fn) {
  const container = qs(containerSel);
  if (!container) return;
  container.addEventListener("click", ev => {
    const target = ev.target.closest(selector);
    if (target) fn(ev, target);
  });
}

// Finn nærmeste forelder som matcher selector
export function findParent(el, selector) {
  while (el && el !== document) {
    if (el.matches(selector)) return el;
    el = el.parentElement;
  }
  return null;
}

// ----------------------------------------------------------------------------
// Setting content
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
– Visibility
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// Classes
// ----------------------------------------------------------------------------

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
