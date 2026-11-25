/* Receipt Designer — live 80mm receipt template designer + spec exporter. */
"use strict";

// ---------------------------------------------------------------------------
// Default design. All lengths in mm, font sizes in pt.
// Values follow the structure/proportions of the reference layout, measured
// from an 80mm scan, with neutral placeholder brand content.
// ---------------------------------------------------------------------------
const DEFAULTS = {
  version: 1,
  page: {
    paperWidth: 80, padLeft: 4, padRight: 6, padTop: 22, padBottom: 4,
    fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
    color: "#000000", lineHeight: 1.35, direction: "rtl", thermal: false,
    dpi: 203,
  },
  format: { currency: "د.ك", decimals: 3 },
  order: ["logo", "header", "separator", "servedBy", "orderNumber", "items", "totalRule",
          "total", "payment", "change", "customer", "footer", "orderRef", "dateLine"],
  sections: {
    logo:        { visible: true, src: "", width: 25, align: "center", mt: 0, mb: 16 },
    header:      { visible: true, size: 9, bold: false, align: "center", mt: 0, mb: 0, lineHeight: 1.55,
                   lines: "Your Brand Co.\nهاتف:00000000\ninfo@yourbrand.com\nhttps://yourbrand.com/" },
    separator:   { visible: true, char: "-", count: 32, size: 9, align: "center", mt: 0, mb: 1 },
    servedBy:    { visible: true, label: "خدم بواسطة", size: 9, bold: false, align: "center", mt: 0, mb: 0 },
    orderNumber: { visible: true, size: 18, bold: true, align: "center", mt: 2, mb: 16 },
    items:       { visible: true, mt: 0, mb: 0, itemGap: 11,
                   nameSize: 10.5, nameBold: true, priceSize: 10.5, priceBold: true, priceColWidth: 22,
                   detailSize: 10, qtyBold: true, detailIndent: 2,
                   detailTemplate: "{qty} {unit} x {price} {currency} / {unit}" },
    totalRule:   { visible: true, char: "-", count: 8, size: 9, align: "left", mt: 9, mb: 1 },
    total:       { visible: true, label: "الإجمالي", size: 15, bold: false, align: "left", gap: 4, mt: 0, mb: 0 },
    payment:     { visible: true, size: 10.5, bold: false, align: "split", mt: 15, mb: 0 },
    change:      { visible: true, label: "الباقي", size: 15, bold: false, align: "left", gap: 10, mt: 3, mb: 0 },
    customer:    { visible: true, label: "العميل", labelSize: 11, labelBold: false, size: 12, bold: false,
                   align: "right", nameGap: 1, mt: 10, mb: 0 },
    footer:      { visible: true, text: "شكراً لزيارتكم", size: 9, bold: false, align: "center", mt: 8, mb: 0 },
    orderRef:    { visible: true, label: "طلب", size: 8.5, bold: false, align: "center", mt: 5, mb: 0 },
    dateLine:    { visible: true, size: 8.5, bold: false, align: "center", mt: 0.5, mb: 0,
                   numerals: "arabic", clock: "12h" },
  },
  sample: {
    cashier: "Cashier Name",
    orderNumber: "101",
    items: [
      { name: "قهوة عربية محمصة - 250 جرام", qty: 3, unit: "حبة", price: 4.9 },
      { name: "كيس هدية - 500جرام", qty: 6, unit: "حبة", price: 0 },
    ],
    paymentLabel: "نقداً - الفرع الرئيسي",
    paid: 15,
    customer: "Customer Name اسم العميل",
    ref: "0001-001-00001",
    datetime: "",
  },
};

const SECTION_LABELS = {
  logo: "Logo", header: "Header (brand details)", separator: "Separator line", servedBy: "Served by",
  orderNumber: "Order number", items: "Items", totalRule: "Total rule", total: "Total",
  payment: "Payment", change: "Change", customer: "Customer", footer: "Footer message",
  orderRef: "Order reference", dateLine: "Date & time",
};

const clone = (o) => JSON.parse(JSON.stringify(o));
function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== "object" || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = (k in base && typeof base[k] === "object" && !Array.isArray(base[k]) && base[k] !== null)
      ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

let cfg = clone(DEFAULTS);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
function setPath(obj, path, val) {
  const ks = path.split("."); const last = ks.pop();
  const tgt = ks.reduce((o, k) => o[k], obj); tgt[last] = val;
}

// ---------------------------------------------------------------------------
// Calculations & formatting
// ---------------------------------------------------------------------------
const money = (n) => Number(n || 0).toFixed(cfg.format.decimals);
const qtyFmt = (n) => Number(n || 0).toFixed(cfg.format.decimals);
function totals() {
  const lines = cfg.sample.items.map((it) => ({ ...it, total: round(Number(it.qty || 0) * Number(it.price || 0)) }));
  const total = round(lines.reduce((a, l) => a + l.total, 0));
  const paid = Number(cfg.sample.paid || 0);
  return { lines, total, paid, change: round(paid - total) };
}
function round(n) { const f = 10 ** cfg.format.decimals; return Math.round(n * f) / f; }

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toArabicDigits(s) { return s.replace(/\d/g, (d) => AR_DIGITS[d]); }
function sampleDate() {
  const v = cfg.sample.datetime;
  const d = v ? new Date(v) : new Date();
  return isNaN(d) ? new Date() : d;
}
function formatDate() {
  const s = cfg.sections.dateLine, d = sampleDate();
  const p = (n, w = 2) => String(n).padStart(w, "0");
  let h = d.getHours(), suffix = "";
  if (s.clock === "12h") { suffix = h < 12 ? " ص" : " م"; h = h % 12 || 12; }
  let out = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(h)}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  if (s.numerals === "arabic") out = toArabicDigits(out);
  return out + suffix;
}

// ---------------------------------------------------------------------------
// Rendering (everything in real units: mm / pt)
// ---------------------------------------------------------------------------
function boxStyle(s) {
  return `margin-top:${s.mt || 0}mm;margin-bottom:${s.mb || 0}mm;`;
}
function textStyle(s, size = s.size, bold = s.bold) {
  return `font-size:${size}pt;font-weight:${bold ? 700 : 400};`;
}
const amt = (n) => `${money(n)} ${cfg.format.currency}`;

const RENDER = {
  logo(s) {
    const just = { left: "flex-start", center: "center", right: "flex-end" }[s.align];
    const inner = s.src
      ? `<img class="r-logo" src="${s.src}" style="width:${s.width}mm;height:auto" alt="">`
      : `<div class="r-logo-placeholder" style="width:${s.width}mm;height:${(s.width * 0.6).toFixed(1)}mm">YOUR LOGO</div>`;
    return `<div style="display:flex;justify-content:${just}">${inner}</div>`;
  },
  header(s) {
    return s.lines.split("\n").map((l) =>
      `<div class="r-line" dir="auto" style="text-align:${s.align};line-height:${s.lineHeight}">${esc(l) || "&nbsp;"}</div>`).join("");
  },
  separator(s) {
    return `<div class="r-line" style="text-align:${s.align};direction:ltr;letter-spacing:0;overflow:hidden;white-space:nowrap">${esc(s.char.repeat(Math.max(0, s.count)))}</div>`;
  },
  servedBy(s) {
    return `<div class="r-line" style="text-align:${s.align}">${esc(s.label)} ${esc(cfg.sample.cashier)}</div>`;
  },
  orderNumber(s) {
    return `<div class="r-line" style="text-align:${s.align};line-height:1.15">${esc(cfg.sample.orderNumber)}</div>`;
  },
  items(s) {
    const { lines } = totals();
    return lines.map((l, i) => {
      const detail = esc(s.detailTemplate)
        .replaceAll("{qty}", s.qtyBold ? `<b>${qtyFmt(l.qty)}</b>` : qtyFmt(l.qty))
        .replaceAll("{unit}", esc(l.unit))
        .replaceAll("{price}", money(l.price))
        .replaceAll("{currency}", esc(cfg.format.currency));
      return `<div style="${i ? `margin-top:${s.itemGap}mm` : ""}">
        <div class="r-row">
          <div class="r-name" style="${textStyle(s, s.nameSize, s.nameBold)}">${esc(l.name)}</div>
          <div class="r-amt" style="width:${s.priceColWidth}mm;${textStyle(s, s.priceSize, s.priceBold)}">${amt(l.total)}</div>
        </div>
        <div class="r-line" style="text-align:right;padding-right:${s.detailIndent}mm;font-size:${s.detailSize}pt">${detail}</div>
      </div>`;
    }).join("");
  },
  totalRule(s) { return RENDER.separator(s); },
  total(s) { return labelAmount(s, s.label, amt(totals().total)); },
  payment(s) { return labelAmount(s, cfg.sample.paymentLabel, money(totals().paid)); },
  change(s) { return labelAmount(s, s.label, amt(totals().change)); },
  customer(s) {
    return `<div class="r-line" style="text-align:${s.align};${textStyle(s, s.labelSize, s.labelBold)}">${esc(s.label)}</div>
      <div class="r-line" style="text-align:${s.align};margin-top:${s.nameGap}mm;${textStyle(s)}">${esc(cfg.sample.customer)}</div>`;
  },
  footer(s) { return `<div class="r-line" style="text-align:${s.align}">${esc(s.text)}</div>`; },
  orderRef(s) {
    return `<div class="r-line" style="text-align:${s.align}">${esc(s.label)} <span dir="ltr">${esc(cfg.sample.ref)}</span></div>`;
  },
  dateLine(s) { return `<div class="r-line" style="text-align:${s.align}">${esc(formatDate())}</div>`; },
};

function labelAmount(s, label, value) {
  if (s.align === "split") {
    return `<div class="r-split"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;
  }
  return `<div class="r-line" style="text-align:${s.align}"><span>${esc(label)}</span><span style="margin-inline-start:${s.gap}mm">${esc(value)}</span></div>`;
}

function render() {
  const p = cfg.page;
  const paper = $("#paper");
  paper.className = "paper" + (p.thermal ? " thermal" : "") + ($("#showGuides").checked ? " guides" : "");
  paper.style.width = p.paperWidth + "mm";
  paper.style.color = p.color;
  paper.style.fontFamily = p.fontFamily;
  paper.style.lineHeight = p.lineHeight;
  paper.style.direction = p.direction;
  paper.style.padding = `${p.padTop}mm ${p.padRight}mm ${p.padBottom}mm ${p.padLeft}mm`;

  const html = cfg.order.map((key) => {
    const s = cfg.sections[key];
    if (!s || !s.visible) return "";
    const base = key === "items" ? "" : textStyle(s);
    return `<div class="r-sec" data-label="${SECTION_LABELS[key]}" style="${boxStyle(s)}${base}">${RENDER[key](s)}</div>`;
  }).join("");
  paper.innerHTML = `<div class="r-printable">${html}</div>`;

  requestAnimationFrame(() => {
    const hmm = paper.getBoundingClientRect().height / zoom() / pxPerMm();
    $("#stageInfo").textContent =
      `Paper ${p.paperWidth} mm · printable ${(p.paperWidth - p.padLeft - p.padRight).toFixed(1)} mm · ` +
      `length ≈ ${hmm.toFixed(0)} mm · total ${amt(totals().total)} · change ${amt(totals().change)}`;
  });
  scheduleSave();
}

let _ppm;
function pxPerMm() {
  if (_ppm) return _ppm;
  const d = document.createElement("div"); d.style.width = "100mm"; d.style.position = "absolute";
  document.body.appendChild(d); _ppm = d.getBoundingClientRect().width / 100; d.remove(); return _ppm;
}
const zoom = () => Number($("#zoom").value);
function applyZoom() {
  $("#paperWrap").style.zoom = zoom();
  $("#zoomVal").textContent = Math.round(zoom() * 100) + "%";
}

// ---------------------------------------------------------------------------
// Control panel
// ---------------------------------------------------------------------------
const C = {
  num: (path, label, step = 0.5, min = 0, max = 999) => ({ t: "num", path, label, step, min, max }),
  text: (path, label, full = true) => ({ t: "text", path, label, full }),
  area: (path, label) => ({ t: "area", path, label }),
  check: (path, label) => ({ t: "check", path, label }),
  seg: (path, label, opts) => ({ t: "seg", path, label, opts }),
  select: (path, label, opts) => ({ t: "select", path, label, opts }),
  sub: (label) => ({ t: "sub", label }),
  hint: (label) => ({ t: "hint", label }),
};
const ALIGN3 = [["left", "Left"], ["center", "Center"], ["right", "Right"]];
const ALIGN4 = [...ALIGN3, ["split", "Split"]];
const spacing = (k) => [C.num(`sections.${k}.mt`, "Space above (mm)"), C.num(`sections.${k}.mb`, "Space below (mm)")];
const typo = (k, align = ALIGN3) => [
  C.num(`sections.${k}.size`, "Font size (pt)", 0.5, 4, 48), C.check(`sections.${k}.bold`, "Bold"),
  C.seg(`sections.${k}.align`, "Alignment", align),
];

const FONT_OPTS = [
  ["'Segoe UI', Tahoma, Arial, sans-serif", "Segoe UI (default)"],
  ["Tahoma, Arial, sans-serif", "Tahoma"],
  ["Arial, sans-serif", "Arial"],
  ["'Noto Sans Arabic', 'Segoe UI', sans-serif", "Noto Sans Arabic"],
  ["'Courier New', monospace", "Courier New (mono)"],
  ["Consolas, monospace", "Consolas (mono)"],
];

const SECTION_CONTROLS = {
  logo: [C.sub("Image"), { t: "logo" }, C.num("sections.logo.width", "Logo width (mm)", 0.5, 5, 80),
         C.seg("sections.logo.align", "Alignment", ALIGN3), ...spacing("logo")],
  header: [C.area("sections.header.lines", "Lines (one per row)"), ...typo("header"),
           C.num("sections.header.lineHeight", "Line spacing (×)", 0.05, 0.8, 3), ...spacing("header")],
  separator: [C.text("sections.separator.char", "Character", false), C.num("sections.separator.count", "Repeat count", 1, 0, 80),
              C.num("sections.separator.size", "Font size (pt)", 0.5, 4, 30), C.seg("sections.separator.align", "Alignment", ALIGN3),
              ...spacing("separator")],
  servedBy: [C.text("sections.servedBy.label", "Label"), ...typo("servedBy"), ...spacing("servedBy")],
  orderNumber: [...typo("orderNumber"), ...spacing("orderNumber")],
  items: [
    C.sub("Item name & line total"),
    C.num("sections.items.nameSize", "Name size (pt)", 0.5, 4, 30), C.check("sections.items.nameBold", "Name bold"),
    C.num("sections.items.priceSize", "Line total size (pt)", 0.5, 4, 30), C.check("sections.items.priceBold", "Line total bold"),
    C.num("sections.items.priceColWidth", "Line total column (mm)", 0.5, 8, 50),
    C.sub("Detail line"),
    C.text("sections.items.detailTemplate", "Template"),
    C.hint("Placeholders: {qty} {unit} {price} {currency}"),
    C.num("sections.items.detailSize", "Detail size (pt)", 0.5, 4, 30), C.check("sections.items.qtyBold", "Quantity bold"),
    C.num("sections.items.detailIndent", "Detail indent (mm)"),
    C.sub("Spacing"),
    C.num("sections.items.itemGap", "Gap between items (mm)"), ...spacing("items"),
  ],
  totalRule: [C.text("sections.totalRule.char", "Character", false), C.num("sections.totalRule.count", "Repeat count", 1, 0, 80),
              C.num("sections.totalRule.size", "Font size (pt)", 0.5, 4, 30), C.seg("sections.totalRule.align", "Alignment", ALIGN3),
              ...spacing("totalRule")],
  total: [C.text("sections.total.label", "Label"), ...typo("total", ALIGN4),
          C.num("sections.total.gap", "Label ↔ amount gap (mm)"), ...spacing("total")],
  payment: [C.hint("Payment method text and amount paid are set in Sample data."), ...typo("payment", ALIGN4), ...spacing("payment")],
  change: [C.text("sections.change.label", "Label"), ...typo("change", ALIGN4),
           C.num("sections.change.gap", "Label ↔ amount gap (mm)"), ...spacing("change")],
  customer: [C.text("sections.customer.label", "Label"),
             C.num("sections.customer.labelSize", "Label size (pt)", 0.5, 4, 30), C.check("sections.customer.labelBold", "Label bold"),
             C.num("sections.customer.size", "Name size (pt)", 0.5, 4, 30), C.check("sections.customer.bold", "Name bold"),
             C.seg("sections.customer.align", "Alignment", ALIGN3), C.num("sections.customer.nameGap", "Label ↔ name gap (mm)"),
             ...spacing("customer")],
  footer: [C.text("sections.footer.text", "Text"), ...typo("footer"), ...spacing("footer")],
  orderRef: [C.text("sections.orderRef.label", "Label"), ...typo("orderRef"), ...spacing("orderRef")],
  dateLine: [...typo("dateLine"),
             C.seg("sections.dateLine.numerals", "Digits", [["arabic", "٠١٢"], ["latin", "012"]]),
             C.seg("sections.dateLine.clock", "Clock", [["12h", "12h ص/م"], ["24h", "24h"]]),
             ...spacing("dateLine")],
};

const PAGE_CONTROLS = [
  C.num("page.paperWidth", "Paper width (mm)", 1, 40, 120),
  C.select("page.dpi", "Printer resolution", [[203, "203 dpi (8 dots/mm)"], [180, "180 dpi"], [300, "300 dpi"]]),
  C.num("page.padLeft", "Left margin (mm)"), C.num("page.padRight", "Right margin (mm)"),
  C.num("page.padTop", "Top margin (mm)"), C.num("page.padBottom", "Bottom margin (mm)"),
  C.select("page.fontFamily", "Font family", FONT_OPTS),
  C.num("page.lineHeight", "Base line height (×)", 0.05, 0.8, 3),
  { t: "color", path: "page.color", label: "Text color" },
  C.seg("page.direction", "Direction", [["rtl", "RTL (Arabic)"], ["ltr", "LTR"]]),
  C.check("page.thermal", "Thermal look in preview"),
  C.sub("Number format"),
  C.text("format.currency", "Currency symbol", false),
  C.num("format.decimals", "Decimals", 1, 0, 4),
];

function fieldHTML(c) {
  const v = c.path ? getPath(cfg, c.path) : undefined;
  const dp = `data-path="${c.path}"`;
  switch (c.t) {
    case "num": return `<label class="field"><span>${c.label}</span><input type="number" ${dp} step="${c.step}" min="${c.min}" max="${c.max}" value="${v}"></label>`;
    case "text": return `<label class="field ${c.full ? "full" : ""}"><span>${c.label}</span><input type="text" dir="auto" ${dp} value="${esc(v)}"></label>`;
    case "area": return `<label class="field full"><span>${c.label}</span><textarea dir="auto" ${dp}>${esc(v)}</textarea></label>`;
    case "check": return `<label class="field check"><input type="checkbox" ${dp} ${v ? "checked" : ""}><span>${c.label}</span></label>`;
    case "color": return `<label class="field"><span>${c.label}</span><input type="color" ${dp} value="${v}"></label>`;
    case "select": return `<label class="field"><span>${c.label}</span><select ${dp}>${c.opts.map(([o, l]) =>
      `<option value="${esc(o)}" ${String(o) === String(v) ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    case "seg": return `<div class="field"><span>${c.label}</span><div class="seg" ${dp}>${c.opts.map(([o, l]) =>
      `<button type="button" data-val="${o}" class="${o === v ? "on" : ""}">${l}</button>`).join("")}</div></div>`;
    case "sub": return `<div class="subhead">${c.label}</div>`;
    case "hint": return `<div class="hint">${c.label}</div>`;
    case "logo": return `<div class="logo-box">${cfg.sections.logo.src ? `<img src="${cfg.sections.logo.src}" alt="">` : ""}
      <button type="button" id="btnLogo">${cfg.sections.logo.src ? "Change logo…" : "Upload logo…"}</button>
      ${cfg.sections.logo.src ? `<button type="button" id="btnLogoClear" class="small">Remove</button>` : ""}
      <input type="file" id="logoFile" accept="image/*" hidden></div>
      <div class="hint">PNG with a transparent or white background works best. SVG and JPG also work.</div>`;
  }
  return "";
}

function sampleHTML() {
  const rows = cfg.sample.items.map((it, i) => `<div class="item-row" data-i="${i}">
    <input dir="auto" data-k="name" value="${esc(it.name)}" placeholder="Item name">
    <input type="number" data-k="qty" step="any" value="${it.qty}">
    <input dir="auto" data-k="unit" value="${esc(it.unit)}">
    <input type="number" data-k="price" step="any" value="${it.price}">
    <button type="button" data-del="${i}" title="Remove">×</button></div>`).join("");
  return `
    ${fieldHTML(C.text("sample.cashier", "Cashier", false))}
    ${fieldHTML(C.text("sample.orderNumber", "Order number", false))}
    <div class="subhead">Items (line totals and total update automatically)</div>
    <div class="items-table">
      <div class="item-row head"><span>Name</span><span>Qty</span><span>Unit</span><span>Price</span><span></span></div>
      ${rows}
      <button type="button" id="btnAddItem" class="small" style="align-self:flex-start">+ Add item</button>
    </div>
    <div class="subhead">Payment & customer</div>
    ${fieldHTML(C.text("sample.paymentLabel", "Payment method label"))}
    ${fieldHTML(C.num("sample.paid", "Amount paid", 0.001, 0, 1e9))}
    ${fieldHTML(C.text("sample.ref", "Order reference", false))}
    ${fieldHTML(C.text("sample.customer", "Customer name"))}
    <label class="field full"><span>Date & time (blank = now)</span><input type="datetime-local" step="1" data-path="sample.datetime" value="${esc(cfg.sample.datetime)}"></label>`;
}

function buildPanel() {
  const openSet = new Set([...document.querySelectorAll("details.sec[open]")].map((d) => d.dataset.key));
  if (!openSet.size) openSet.add("page");
  let html = `<details class="sec" data-key="page" ${openSet.has("page") ? "open" : ""}><summary><span class="grow">Page & typography</span></summary>
    <div class="sec-body">${PAGE_CONTROLS.map(fieldHTML).join("")}</div></details>`;
  html += `<details class="sec" data-key="sample" ${openSet.has("sample") ? "open" : ""}><summary><span class="grow">Sample data (preview only)</span></summary>
    <div class="sec-body">${sampleHTML()}</div></details>`;
  cfg.order.forEach((key, idx) => {
    const s = cfg.sections[key];
    html += `<details class="sec" data-key="${key}" ${openSet.has(key) ? "open" : ""}><summary>
      <input type="checkbox" title="Show / hide" data-path="sections.${key}.visible" ${s.visible ? "checked" : ""}>
      <span class="grow">${SECTION_LABELS[key]}</span>
      <span class="order"><button type="button" data-move="${idx}" data-dir="-1" title="Move up" ${idx === 0 ? "disabled" : ""}>↑</button>
      <button type="button" data-move="${idx}" data-dir="1" title="Move down" ${idx === cfg.order.length - 1 ? "disabled" : ""}>↓</button></span>
      </summary><div class="sec-body">${SECTION_CONTROLS[key].map(fieldHTML).join("")}</div></details>`;
  });
  $("#panel").innerHTML = html;
}

function onPanelInput(e) {
  const el = e.target;
  if (el.closest(".item-row") && el.dataset.k) {
    const i = +el.closest(".item-row").dataset.i, k = el.dataset.k;
    cfg.sample.items[i][k] = (k === "qty" || k === "price") ? (el.value === "" ? 0 : Number(el.value)) : el.value;
    return render();
  }
  const path = el.dataset.path; if (!path) return;
  let v;
  if (el.type === "checkbox") v = el.checked;
  else if (el.type === "number") { if (el.value === "" || isNaN(+el.value)) return; v = Number(el.value); }
  else if (el.tagName === "SELECT" && typeof getPath(cfg, path) === "number") v = Number(el.value);
  else v = el.value;
  setPath(cfg, path, v);
  render();
}

function onPanelClick(e) {
  const b = e.target.closest("button"); if (!b) return;
  const seg = b.closest(".seg");
  if (seg) {
    setPath(cfg, seg.dataset.path, b.dataset.val);
    seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    return render();
  }
  if (b.dataset.move !== undefined) {
    e.preventDefault();
    const i = +b.dataset.move, j = i + +b.dataset.dir;
    [cfg.order[i], cfg.order[j]] = [cfg.order[j], cfg.order[i]];
    buildPanel(); return render();
  }
  if (b.dataset.del !== undefined) { cfg.sample.items.splice(+b.dataset.del, 1); buildPanel(); return render(); }
  if (b.id === "btnAddItem") { cfg.sample.items.push({ name: "صنف جديد", qty: 1, unit: "حبة", price: 1 }); buildPanel(); return render(); }
  if (b.id === "btnLogo") return $("#logoFile").click();
  if (b.id === "btnLogoClear") { cfg.sections.logo.src = ""; buildPanel(); return render(); }
}

function onLogoFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    if (file.type === "image/svg+xml") { cfg.sections.logo.src = r.result; buildPanel(); return render(); }
    // Downscale large bitmaps so the saved design stays small (keeps ≥ 300 dpi at 80mm).
    const img = new Image();
    img.onload = () => {
      const maxW = 960, s = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      cfg.sections.logo.src = c.toDataURL("image/png");
      buildPanel(); render();
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
}

// ---------------------------------------------------------------------------
// Persistence (server autosave; localStorage fallback)
// ---------------------------------------------------------------------------
let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const body = JSON.stringify(cfg);
    try { localStorage.setItem("receiptDesign", body); } catch {}
    try { await fetch("api/design", { method: "PUT", headers: { "Content-Type": "application/json" }, body }); } catch {}
  }, 400);
}
async function loadSaved() {
  try {
    const r = await fetch("api/design");
    if (r.status === 200) return await r.json();
  } catch {}
  try { const s = localStorage.getItem("receiptDesign"); if (s) return JSON.parse(s); } catch {}
  return null;
}
function adopt(saved) {
  cfg = deepMerge(clone(DEFAULTS), saved || {});
  // keep any sections missing from a saved order
  const known = new Set(cfg.order.filter((k) => DEFAULTS.sections[k]));
  cfg.order = [...known, ...DEFAULTS.order.filter((k) => !known.has(k))];
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------
function printReceipt() {
  const paper = $("#paper");
  const hmm = Math.ceil(paper.getBoundingClientRect().height / zoom() / pxPerMm()) + 2;
  $("#print-page-style").textContent = `@page { size: ${cfg.page.paperWidth}mm ${hmm}mm; margin: 0; }`;
  window.print();
}

// ---------------------------------------------------------------------------
// Spec export
// ---------------------------------------------------------------------------
function buildSpec() {
  const p = cfg.page, S = cfg.sections, dpm = p.dpi / 25.4;
  const dots = (mm) => Math.round(mm * dpm);
  const ptPx = (pt) => Math.round((pt / 72) * p.dpi);
  const mm = (v) => `${+Number(v).toFixed(2)} mm (${dots(v)} dots)`;
  const pt = (v) => `${v} pt (${(v * 25.4 / 72).toFixed(2)} mm em / ${ptPx(v)} px @${p.dpi}dpi)`;
  const al = (a) => ({ left: "Left", center: "Center", right: "Right", split: "Split (label right edge, amount left edge)" }[a] || a);
  const yes = (b) => (b ? "Bold (700)" : "Regular (400)");
  const printable = p.paperWidth - p.padLeft - p.padRight;
  const { lines, total, paid, change } = totals();
  const height = $("#paper").getBoundingClientRect().height / zoom() / pxPerMm();
  const L = [];
  const row = (...c) => L.push(`| ${c.join(" | ")} |`);

  L.push(`# Receipt Template Specification`, ``);
  L.push(`Generated by Receipt Designer on ${new Date().toISOString().slice(0, 19).replace("T", " ")}.`, ``);
  L.push(`This document describes a thermal receipt template precisely enough to re-implement it in a POS system`);
  L.push(`(HTML/CSS receipt, QWeb/Odoo template, or ESC/POS raster). All lengths are given in millimetres with the`);
  L.push(`equivalent printer dots at ${p.dpi} dpi (${dpm.toFixed(2)} dots/mm). Font sizes are in points (1 pt = 1/72 in).`);
  L.push(`The companion file \`receipt-design.json\` contains the same values in machine-readable form.`, ``);

  L.push(`## 1. Page`, ``);
  row("Property", "Value"); row("---", "---");
  row("Paper width", mm(p.paperWidth));
  row("Printable width", mm(printable));
  row("Left / right margin", `${mm(p.padLeft)} / ${mm(p.padRight)}`);
  row("Top margin (before first element)", mm(p.padTop));
  row("Bottom margin (after last element)", mm(p.padBottom));
  row("Receipt length with sample data", `≈ ${height.toFixed(1)} mm (grows with item count)`);
  row("Text direction", p.direction === "rtl" ? "Right-to-left (Arabic primary)" : "Left-to-right");
  row("Font family", `\`${p.fontFamily}\``);
  row("Base line height", `${p.lineHeight} × font size`);
  row("Text color", `${p.color} (print as solid black on thermal)`);
  row("Currency", `"${cfg.format.currency}", placed after the amount, separated by one space`);
  row("Number format", `${cfg.format.decimals} decimals, "." decimal separator, no thousands separator, Latin digits`);
  L.push(``);

  L.push(`## 2. Element order`, ``);
  L.push(`Elements are stacked vertically in this order. Vertical spacing is the element's "space above" plus the`);
  L.push(`previous element's "space below" (margins do not collapse into each other in the reference render).`, ``);
  row("#", "Element", "Shown", "Space above", "Space below"); row("---", "---", "---", "---", "---");
  cfg.order.forEach((k, i) => row(i + 1, SECTION_LABELS[k], S[k].visible ? "Yes" : "**Hidden**", mm(S[k].mt || 0), mm(S[k].mb || 0)));
  L.push(``);

  L.push(`## 3. Elements`, ``);
  let n = 0;
  for (const k of cfg.order) {
    const s = S[k]; if (!s.visible) continue;
    n++; L.push(`### 3.${n} ${SECTION_LABELS[k]}`, ``);
    row("Property", "Value"); row("---", "---");
    switch (k) {
      case "logo": {
        const img = $("#paper img.r-logo");
        const ratio = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.6;
        row("Content", s.src ? "Brand logo image (see `logo.png` in the export folder)" : "**No logo uploaded yet**");
        row("Width", mm(s.width));
        row("Height", `${mm(s.width * ratio)} (aspect ratio preserved)`);
        row("Alignment", al(s.align));
        row("Rendering", "Monochrome. For ESC/POS, threshold to 1-bit at the dot width above and print as raster (GS v 0).");
        break;
      }
      case "header":
        row("Content", "Static brand details, one line per row:");
        s.lines.split("\n").forEach((l, i) => row(`Line ${i + 1}`, `\`${l}\``));
        row("Font size", pt(s.size)); row("Weight", yes(s.bold)); row("Alignment", al(s.align));
        row("Line spacing", `${s.lineHeight} × font size = ${mm(s.size * 25.4 / 72 * s.lineHeight)} per line`);
        row("Direction", "Each line uses automatic direction (Latin lines LTR, Arabic lines RTL)");
        break;
      case "separator": case "totalRule":
        row("Content", `\`${s.char}\` repeated ${s.count} times (\`${s.char.repeat(s.count)}\`)`);
        row("Font size", pt(s.size)); row("Alignment", al(s.align));
        break;
      case "servedBy":
        row("Content", `\`${s.label}\` + one space + cashier/employee name (dynamic)`);
        row("Font size", pt(s.size)); row("Weight", yes(s.bold)); row("Alignment", al(s.align));
        break;
      case "orderNumber":
        row("Content", "Order / ticket number (dynamic), e.g. `" + cfg.sample.orderNumber + "`");
        row("Font size", pt(s.size)); row("Weight", yes(s.bold)); row("Alignment", al(s.align)); row("Line height", "1.15 × font size");
        break;
      case "items":
        row("Structure", "Repeated block per order line: (a) name row, (b) detail row");
        row("(a) Name row layout", `Two columns. Item name fills the remaining width, right-aligned, wraps. Line total in a fixed ${mm(s.priceColWidth)} column at the left edge, left-aligned.`);
        row("(a) Item name", `${pt(s.nameSize)}, ${yes(s.nameBold)}`);
        row("(a) Line total", `${pt(s.priceSize)}, ${yes(s.priceBold)}; format \`<amount> ${cfg.format.currency}\` where amount = qty × unit price`);
        row("(b) Detail row", `Template \`${s.detailTemplate}\`, right-aligned, indented ${mm(s.detailIndent)} from the right margin`);
        row("(b) Detail font", `${pt(s.detailSize)}; quantity ${s.qtyBold ? "bold" : "regular"}, rest regular`);
        row("Quantity / unit price format", `${cfg.format.decimals} decimals each`);
        row("Gap between items", mm(s.itemGap));
        break;
      case "total":
        row("Content", `\`${s.label}\` then gap then \`<order total> ${cfg.format.currency}\``);
        row("Font size", pt(s.size)); row("Weight", yes(s.bold)); row("Alignment", al(s.align));
        if (s.align !== "split") row("Label ↔ amount gap", mm(s.gap));
        break;
      case "payment":
        row("Content", "Payment method name (dynamic, e.g. `" + cfg.sample.paymentLabel + "`) and amount tendered (no currency)");
        row("Font size", pt(s.size)); row("Weight", yes(s.bold)); row("Alignment", al(s.align));
        row("Repeat", "One row per payment line");
        break;
      case "change":
        row("Content", `\`${s.label}\` then gap then \`<change due> ${cfg.format.currency}\`; change = amount tendered − total`);
        row("Font size", pt(s.size)); row("Weight", yes(s.bold)); row("Alignment", al(s.align));
        if (s.align !== "split") row("Label ↔ amount gap", mm(s.gap));
        break;
      case "customer":
        row("Content", `Label \`${s.label}\`, then customer name on the next line (dynamic). Omit the block when no customer is set.`);
        row("Label font", `${pt(s.labelSize)}, ${yes(s.labelBold)}`);
        row("Name font", `${pt(s.size)}, ${yes(s.bold)}`);
        row("Alignment", al(s.align)); row("Label ↔ name gap", mm(s.nameGap));
        break;
      case "footer":
        row("Content", `Static text \`${s.text}\``);
        row("Font size", pt(s.size)); row("Weight", yes(s.bold)); row("Alignment", al(s.align));
        break;
      case "orderRef":
        row("Content", `\`${s.label}\` + space + order reference (dynamic, LTR), e.g. \`${cfg.sample.ref}\``);
        row("Font size", pt(s.size)); row("Weight", yes(s.bold)); row("Alignment", al(s.align));
        break;
      case "dateLine":
        row("Content", "Order date and time (dynamic)");
        row("Format", `\`DD/MM/YYYY ${s.clock === "12h" ? "hh:mm:ss" : "HH:mm:ss"}\`${s.clock === "12h" ? " followed by ` ص` (AM) or ` م` (PM)" : ""}`);
        row("Digits", s.numerals === "arabic" ? "Arabic-Indic (٠١٢٣٤٥٦٧٨٩)" : "Latin (0-9)");
        row("Example", `\`${formatDate()}\``);
        row("Font size", pt(s.size)); row("Weight", yes(s.bold)); row("Alignment", al(s.align));
        break;
    }
    row("Space above / below", `${mm(s.mt || 0)} / ${mm(s.mb || 0)}`);
    L.push(``);
  }

  L.push(`## 4. Calculations`, ``);
  L.push(`- Line total = quantity × unit price, rounded to ${cfg.format.decimals} decimals.`);
  L.push(`- Order total = sum of line totals.`);
  L.push(`- Change = amount tendered − order total.`, ``);
  L.push(`Sample used for the preview:`, ``);
  row("Item", "Qty", "Unit", "Unit price", "Line total"); row("---", "---", "---", "---", "---");
  lines.forEach((l) => row(l.name, qtyFmt(l.qty), l.unit, money(l.price), money(l.total)));
  row("**Total**", "", "", "", `**${money(total)}**`);
  row("Tendered", "", "", "", money(paid));
  row("Change", "", "", "", money(change));
  L.push(``);

  L.push(`## 5. Implementation notes`, ``);
  L.push(`- Render the receipt as a single column of width ${mm(printable)}, offset ${mm(p.padLeft)} from the left paper edge.`);
  L.push(`- Mixed Arabic/Latin text relies on the Unicode bidi algorithm inside an ${p.direction.toUpperCase()} container. With an amount`);
  L.push(`  written logically as \`<amount> <currency>\`, the currency appears visually to the left of the digits in RTL.`);
  L.push(`- Hidden elements (see section 2) must not be printed and take no space.`);
  L.push(`- Print at 100% scale (no "fit to page"); ${dots(p.paperWidth)} dots across at ${p.dpi} dpi.`);
  L.push(`- Feed and cut after the bottom margin.`, ``);
  L.push(`## 6. Machine-readable design`, ``, "```json", JSON.stringify({ ...cfg, sections: { ...cfg.sections, logo: { ...cfg.sections.logo, src: cfg.sections.logo.src ? "<see logo file>" : "" } } }, null, 2), "```", ``);
  return L.join("\n");
}

// Logo rasterised to the exact printed width in dots (handy for ESC/POS).
function logoAtPrintSize() {
  return new Promise((resolve) => {
    const s = cfg.sections.logo; if (!s.src) return resolve("");
    const img = new Image();
    img.onload = () => {
      const w = Math.round(s.width * cfg.page.dpi / 25.4);
      const h = Math.round(w * (img.naturalHeight || 1) / (img.naturalWidth || 1));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = s.src;
  });
}

function download(name, data, type) {
  const a = document.createElement("a");
  a.href = typeof data === "string" && data.startsWith("data:") ? data : URL.createObjectURL(new Blob([data], { type }));
  a.download = name; a.click();
}

async function exportSpec() {
  const spec = buildSpec();
  const logo = await logoAtPrintSize();
  const design = JSON.stringify(cfg, null, 2);
  try {
    const r = await fetch("api/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec, design: JSON.parse(design), logo }),
    });
    if (!r.ok) throw new Error(await r.text());
    const { dir } = await r.json();
    toast(`Exported to ${dir}`, 6000);
    fetch("api/open-exports").catch(() => {});
  } catch {
    download("receipt-spec.md", spec, "text/markdown");
    download("receipt-design.json", design, "application/json");
    if (logo) download("logo.png", logo);
    toast("Exported to your Downloads folder");
  }
}

let toastTimer;
function toast(msg, ms = 3000) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function init() {
  adopt(await loadSaved());
  buildPanel(); applyZoom(); render();

  const panel = $("#panel");
  panel.addEventListener("input", onPanelInput);
  panel.addEventListener("change", (e) => { if (e.target.id === "logoFile") onLogoFile(e.target.files[0]); });
  panel.addEventListener("click", onPanelClick);
  // Re-render the panel after editing number fields so item rows etc. stay in sync.
  $("#zoom").addEventListener("input", () => { applyZoom(); render(); });
  $("#showGuides").addEventListener("change", render);
  $("#btnPrint").addEventListener("click", printReceipt);
  $("#btnExport").addEventListener("click", exportSpec);
  $("#btnReset").addEventListener("click", () => {
    if (!confirm("Reset every setting to the default design? Your logo and sample data will be cleared.")) return;
    adopt(null); buildPanel(); render(); toast("Design reset to defaults");
  });
  $("#btnImport").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { adopt(JSON.parse(await f.text())); buildPanel(); render(); toast("Design imported"); }
    catch { toast("That file is not a valid design JSON"); }
    e.target.value = "";
  });
})();
