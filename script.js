const HINGE_STORAGE_KEY = "hingeCalculatorDiagramV1";
const HINGE_SELECTED_KEY = "hingeCalculatorSelectedHingeDiagramV1";
const STRIKE_STORAGE_KEY = "hingeCalculatorStrikesDiagramV1";
const STRIKE_SELECTED_KEY = "hingeCalculatorSelectedStrikeDiagramV1";
const FLUSH_STORAGE_KEY = "hingeCalculatorFlushesDiagramV1";
const FLUSH_SELECTED_KEY = "hingeCalculatorSelectedFlushDiagramV1";

const LAYOUT_STORAGE_KEY = "kanamonoLayoutPositionsV3";

let hinges = [];
let strikes = [];
let flushes = [];
let manageEditing = { type: null, index: null };

let layoutEditMode = false;
let dragState = null;
let resizeState = null;

const defaultHinges = [
  { name: "DH-508S（3+12）", value: 15, isDefault: true },
  { name: "401-SL501（1+13）", value: 14, isDefault: true }
];

const defaultStrikes = [
  { name: "LA", offset: 22.5, height: 110, thickness: 2.5, isDefault: true }
];

const defaultFlushes = [
  { name: "DE6VN", value: 18.5, isDefault: true },
  { name: "DC800", value: 20.5, isDefault: true }
];

/* E と G は入れ替え済み */
const defaultLayoutPositions = {
  topMituke:    { left: 78,  top: 116,  width: 92,  height: 38, labelLeft: 60,  labelTop: 90,  labelText: "A 見付け" },
  topGap:       { left: 78,  top: 226,  width: 92,  height: 38, labelLeft: 60,  labelTop: 200, labelText: "B 上隙間" },
  diagramH:     { left: 148, top: 495,  width: 92,  height: 38, labelLeft: 182, labelTop: 470, labelText: "I H" },
  dh:           { left: 305, top: 495,  width: 92,  height: 38, labelLeft: 320, labelTop: 470, labelText: "J DH" },

  bottomGap:    { left: 72,  top: 688,  width: 116, height: 42, labelLeft: 28,  labelTop: 645, labelText: "G 下隙間" },
  bottomSill2:  { left: 72,  top: 858,  width: 116, height: 42, labelLeft: 28,  labelTop: 815, labelText: "F 沓摺②" },
  bottomSill1:  { left: 128, top: 1033, width: 116, height: 42, labelLeft: 28,  labelTop: 990, labelText: "E 沓摺①" },

  parentW:      { left: 282, top: 206,  width: 104, height: 38, labelLeft: 272, labelTop: 180, labelText: "S 親W" },
  meetingInput: { left: 495, top: 206,  width: 78,  height: 38, labelLeft: 492, labelTop: 180, labelText: "T 召合わせ" },
  flushMirror:  { left: 675, top: 206,  width: 104, height: 38, labelLeft: 670, labelTop: 180, labelText: "U = S" },
  dwInput:      { left: 428, top: 748,  width: 168, height: 42, labelLeft: 470, labelTop: 720, labelText: "N DW" }
};

function storageAvailable() {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

const canUseStorage = storageAvailable();

function safeGet(key) {
  if (!canUseStorage) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  if (!canUseStorage) return;
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function toHalfWidth(str) {
  return String(str)
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 65248))
    .replace(/－/g, "-")
    .replace(/−/g, "-")
    .replace(/ー/g, "-")
    .replace(/．/g, ".")
    .replace(/，/g, ".")
    .replace(/　/g, " ");
}

function normalizeNumberInputValue(v) {
  return toHalfWidth(v).replace(/[^\d.\-,]/g, "");
}

function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  let v = el.value;
  if (!v) return 0;
  v = toHalfWidth(v).replace(/[^\d.\-]/g, "").trim();
  if (v === "" || v === "-" || v === "." || v === "-.") return 0;
  return Number(v) || 0;
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = (val || val === 0) ? val : "";
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showMessage(id, text, type) {
  const box = document.getElementById(id);
  if (!box) return;
  box.textContent = text;
  box.className = "message " + type;
  box.style.display = "block";
}

function clearMessage(id) {
  const box = document.getElementById(id);
  if (!box) return;
  box.textContent = "";
  box.style.display = "none";
  box.className = "message";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHinge(item) {
  return {
    name: String(item.name).trim(),
    value: Number(item.value),
    isDefault: Boolean(item.isDefault)
  };
}

function normalizeStrike(item) {
  return {
    name: String(item.name).trim(),
    offset: Number(item.offset),
    height: Number(item.height),
    thickness: Number(item.thickness) || 0,
    isDefault: Boolean(item.isDefault)
  };
}

function normalizeFlush(item) {
  return {
    name: String(item.name).trim(),
    value: Number(item.value),
    isDefault: Boolean(item.isDefault)
  };
}

function loadSavedHinges() {
  try {
    const raw = safeGet(HINGE_STORAGE_KEY);
    if (!raw) {
      hinges = defaultHinges.map(normalizeHinge);
      return;
    }

    const parsed = JSON.parse(raw);
    hinges = Array.isArray(parsed)
      ? parsed
          .filter(item =>
            item &&
            typeof item.name === "string" &&
            item.name.trim() !== "" &&
            Number.isFinite(Number(item.value))
          )
          .map(normalizeHinge)
      : defaultHinges.map(normalizeHinge);

    defaultHinges.forEach(def => {
      const exists = hinges.some(h => h.name === def.name && Number(h.value) === Number(def.value));
      if (!exists) hinges.unshift(normalizeHinge(def));
    });
  } catch {
    hinges = defaultHinges.map(normalizeHinge);
  }
}

function saveHinges() {
  safeSet(HINGE_STORAGE_KEY, JSON.stringify(hinges));
}

function loadSavedStrikes() {
  try {
    const raw = safeGet(STRIKE_STORAGE_KEY);
    if (!raw) {
      strikes = defaultStrikes.map(normalizeStrike);
      return;
    }

    const parsed = JSON.parse(raw);
    strikes = Array.isArray(parsed)
      ? parsed
          .filter(item =>
            item &&
            typeof item.name === "string" &&
            item.name.trim() !== "" &&
            Number.isFinite(Number(item.offset)) &&
            Number.isFinite(Number(item.height))
          )
          .map(normalizeStrike)
      : defaultStrikes.map(normalizeStrike);

    defaultStrikes.forEach(def => {
      const exists = strikes.some(s =>
        s.name === def.name &&
        Number(s.offset) === Number(def.offset) &&
        Number(s.height) === Number(def.height) &&
        Number(s.thickness) === Number(def.thickness)
      );
      if (!exists) strikes.unshift(normalizeStrike(def));
    });
  } catch {
    strikes = defaultStrikes.map(normalizeStrike);
  }
}

function saveStrikes() {
  safeSet(STRIKE_STORAGE_KEY, JSON.stringify(strikes));
}

function loadSavedFlushes() {
  try {
    const raw = safeGet(FLUSH_STORAGE_KEY);
    if (!raw) {
      flushes = defaultFlushes.map(normalizeFlush);
      return;
    }

    const parsed = JSON.parse(raw);
    flushes = Array.isArray(parsed)
      ? parsed
          .filter(item =>
            item &&
            typeof item.name === "string" &&
            item.name.trim() !== "" &&
            Number.isFinite(Number(item.value))
          )
          .map(normalizeFlush)
      : defaultFlushes.map(normalizeFlush);

    defaultFlushes.forEach(def => {
      const exists = flushes.some(f => f.name === def.name && Number(f.value) === Number(def.value));
      if (!exists) flushes.unshift(normalizeFlush(def));
    });
  } catch {
    flushes = defaultFlushes.map(normalizeFlush);
  }
}

function saveFlushes() {
  safeSet(FLUSH_STORAGE_KEY, JSON.stringify(flushes));
}

function loadHingeOptions() {
  const select = document.getElementById("hingeSelect");
  const selectedBefore = safeGet(HINGE_SELECTED_KEY) || "";
  if (!select) return;

  select.innerHTML = "";
  hinges.forEach((h, index) => {
    select.add(new Option(h.isDefault ? `${h.name}（標準）` : h.name, index));
  });

  if (selectedBefore !== "") {
    const idx = Number(selectedBefore);
    if (Number.isInteger(idx) && idx >= 0 && idx < hinges.length) {
      select.value = String(idx);
    }
  }

  if (!select.value && hinges.length > 0) select.selectedIndex = 0;
  safeSet(HINGE_SELECTED_KEY, select.value);
}

function loadStrikeOptions() {
  const select = document.getElementById("strikeSelect");
  const selectedBefore = safeGet(STRIKE_SELECTED_KEY) || "";
  if (!select) return;

  select.innerHTML = "";
  strikes.forEach((s, index) => {
    select.add(new Option(s.isDefault ? `${s.name}（標準）` : s.name, index));
  });

  if (selectedBefore !== "") {
    const idx = Number(selectedBefore);
    if (Number.isInteger(idx) && idx >= 0 && idx < strikes.length) {
      select.value = String(idx);
    }
  }

  if (!select.value && strikes.length > 0) select.selectedIndex = 0;
  safeSet(STRIKE_SELECTED_KEY, select.value);
}

function loadFlushOptions() {
  const select = document.getElementById("flushSelect");
  const selectedBefore = safeGet(FLUSH_SELECTED_KEY) || "";
  if (!select) return;

  select.innerHTML = "";
  flushes.forEach((f, index) => {
    select.add(new Option(f.isDefault ? `${f.name}（標準）` : f.name, index));
  });

  if (selectedBefore !== "") {
    const idx = Number(selectedBefore);
    if (Number.isInteger(idx) && idx >= 0 && idx < flushes.length) {
      select.value = String(idx);
    }
  }

  if (!select.value && flushes.length > 0) select.selectedIndex = 0;
  safeSet(FLUSH_SELECTED_KEY, select.value);
}

function getSelectedHinge() {
  const el = document.getElementById("hingeSelect");
  if (!el) return null;
  const idx = Number(el.value);
  return (Number.isInteger(idx) && idx >= 0 && idx < hinges.length) ? hinges[idx] : null;
}

function getSelectedStrike() {
  const el = document.getElementById("strikeSelect");
  if (!el) return null;
  const idx = Number(el.value);
  return (Number.isInteger(idx) && idx >= 0 && idx < strikes.length) ? strikes[idx] : null;
}

function getSelectedFlush() {
  const el = document.getElementById("flushSelect");
  if (!el) return null;
  const idx = Number(el.value);
  return (Number.isInteger(idx) && idx >= 0 && idx < flushes.length) ? flushes[idx] : null;
}

function refreshSummaryCounts() {
  setText("hingeSummaryText", `丁番一覧（${hinges.length}件）`);
  setText("strikeSummaryText", `ストライク一覧（${strikes.length}件）`);
  setText("flushSummaryText", `フランス落とし一覧（${flushes.length}件）`);
}

function refreshHingeList() {
  const box = document.getElementById("hingeList");
  if (!box) return;
  box.innerHTML = "";

  hinges.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML =
      `<div class="item-title">${escapeHtml(item.name)}${item.isDefault ? '<span class="badge-default">標準</span>' : ''}</div>` +
      `<div class="item-meta">値: ${item.value}</div>` +
      `<div class="item-actions">` +
      `<button type="button" class="btn-edit" data-action="edit" data-kind="hinge" data-index="${index}">編集</button>` +
      `<button type="button" class="btn-delete" data-action="delete" data-kind="hinge" data-index="${index}" ${item.isDefault ? "disabled" : ""}>削除</button>` +
      `</div>`;
    box.appendChild(card);
  });
}

function refreshStrikeList() {
  const box = document.getElementById("strikeList");
  if (!box) return;
  box.innerHTML = "";

  strikes.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML =
      `<div class="item-title">${escapeHtml(item.name)}${item.isDefault ? '<span class="badge-default">標準</span>' : ''}</div>` +
      `<div class="item-meta">下端: ${item.offset} / 高さ: ${item.height} / 厚み: ${item.thickness}</div>` +
      `<div class="item-actions">` +
      `<button type="button" class="btn-edit" data-action="edit" data-kind="strike" data-index="${index}">編集</button>` +
      `<button type="button" class="btn-delete" data-action="delete" data-kind="strike" data-index="${index}" ${item.isDefault ? "disabled" : ""}>削除</button>` +
      `</div>`;
    box.appendChild(card);
  });
}

function refreshFlushList() {
  const box = document.getElementById("flushList");
  if (!box) return;
  box.innerHTML = "";

  flushes.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML =
      `<div class="item-title">${escapeHtml(item.name)}${item.isDefault ? '<span class="badge-default">標準</span>' : ''}</div>` +
      `<div class="item-meta">値: ${item.value}</div>` +
      `<div class="item-actions">` +
      `<button type="button" class="btn-edit" data-action="edit" data-kind="flush" data-index="${index}">編集</button>` +
      `<button type="button" class="btn-delete" data-action="delete" data-kind="flush" data-index="${index}" ${item.isDefault ? "disabled" : ""}>削除</button>` +
      `</div>`;
    box.appendChild(card);
  });
}

function refreshAllLists() {
  refreshHingeList();
  refreshStrikeList();
  refreshFlushList();
  refreshSummaryCounts();
}

function addHingeFromTab() {
  clearMessage("hingeMessage");
  const name = document.getElementById("newHingeName")?.value.trim() || "";
  const value = getVal("newHingeValue");

  if (!name) return showMessage("hingeMessage", "名前を入力してください", "warn");
  if (!Number.isFinite(value) || value === 0) return showMessage("hingeMessage", "値を入力してください", "warn");
  if (hinges.some(h => h.name.trim().toLowerCase() === name.toLowerCase())) {
    return showMessage("hingeMessage", "登録済みです（同じ名前）", "warn");
  }

  hinges.push({ name, value, isDefault: false });
  saveHinges();
  loadHingeOptions();

  const select = document.getElementById("hingeSelect");
  if (select) select.value = String(hinges.length - 1);
  safeSet(HINGE_SELECTED_KEY, String(hinges.length - 1));

  document.getElementById("newHingeName").value = "";
  document.getElementById("newHingeValue").value = "";
  refreshAllLists();
  showMessage("hingeMessage", "追加しました", "ok");
  calc();
}

function addStrikeFromTab() {
  clearMessage("strikeMessage");
  const name = document.getElementById("newStrikeName")?.value.trim() || "";
  const offset = getVal("newStrikeOffset");
  const height = getVal("newStrikeHeight");
  const thickness = getVal("newStrikeThickness");

  if (!name) return showMessage("strikeMessage", "名前を入力してください", "warn");
  if (!Number.isFinite(offset) || offset === 0 || !Number.isFinite(height) || height === 0) {
    return showMessage("strikeMessage", "下端と高さを入力してください", "warn");
  }
  if (!Number.isFinite(thickness) || thickness === 0) {
    return showMessage("strikeMessage", "厚みを入力してください", "warn");
  }
  if (strikes.some(s => s.name.trim().toLowerCase() === name.toLowerCase())) {
    return showMessage("strikeMessage", "登録済みです（同じ名前）", "warn");
  }

  strikes.push({ name, offset, height, thickness, isDefault: false });
  saveStrikes();
  loadStrikeOptions();

  const select = document.getElementById("strikeSelect");
  if (select) select.value = String(strikes.length - 1);
  safeSet(STRIKE_SELECTED_KEY, String(strikes.length - 1));

  document.getElementById("newStrikeName").value = "";
  document.getElementById("newStrikeOffset").value = "";
  document.getElementById("newStrikeHeight").value = "";
  document.getElementById("newStrikeThickness").value = "";
  refreshAllLists();
  showMessage("strikeMessage", "追加しました", "ok");
  calc();
}

function addFlushFromTab() {
  clearMessage("flushMessage");
  const name = document.getElementById("newFlushName")?.value.trim() || "";
  const value = getVal("newFlushValue");

  if (!name) return showMessage("flushMessage", "名前を入力してください", "warn");
  if (!Number.isFinite(value) || value === 0) return showMessage("flushMessage", "値を入力してください", "warn");
  if (flushes.some(f => f.name.trim().toLowerCase() === name.toLowerCase())) {
    return showMessage("flushMessage", "登録済みです（同じ名前）", "warn");
  }

  flushes.push({ name, value, isDefault: false });
  saveFlushes();
  loadFlushOptions();

  const select = document.getElementById("flushSelect");
  if (select) select.value = String(flushes.length - 1);
  safeSet(FLUSH_SELECTED_KEY, String(flushes.length - 1));

  document.getElementById("newFlushName").value = "";
  document.getElementById("newFlushValue").value = "";
  refreshAllLists();
  showMessage("flushMessage", "追加しました", "ok");
  calc();
}

function startManageEdit(kind, index) {
  clearMessage("manageMessage");
  manageEditing = { type: kind, index };
  document.getElementById("manageType").value = kind;

  if (kind === "hinge") {
    const item = hinges[index];
    document.getElementById("manageName").value = item.name;
    document.getElementById("manageValue1").value = item.value;
    document.getElementById("manageValue2").value = "";
  }

  if (kind === "strike") {
    const item = strikes[index];
    document.getElementById("manageName").value = item.name;
    document.getElementById("manageValue1").value = item.offset;
    document.getElementById("manageValue2").value = item.height + "," + item.thickness;
  }

  if (kind === "flush") {
    const item = flushes[index];
    document.getElementById("manageName").value = item.name;
    document.getElementById("manageValue1").value = item.value;
    document.getElementById("manageValue2").value = "";
  }
}

function clearManageEdit() {
  manageEditing = { type: null, index: null };
  document.getElementById("manageType").value = "hinge";
  document.getElementById("manageName").value = "";
  document.getElementById("manageValue1").value = "";
  document.getElementById("manageValue2").value = "";
}

function parseStrikeExtra(text) {
  const raw = toHalfWidth(text).split(",");
  const h = Number((raw[0] || "").trim()) || 0;
  const t = Number((raw[1] || "").trim()) || 0;
  return { height: h, thickness: t };
}

function saveManageEdit() {
  clearMessage("manageMessage");
  const kind = manageEditing.type;
  const index = manageEditing.index;

  if (kind === null || index === null) {
    return showMessage("manageMessage", "一覧から編集する項目を選んでください", "warn");
  }

  const name = document.getElementById("manageName").value.trim();
  const v1 = Number(normalizeNumberInputValue(document.getElementById("manageValue1").value)) || 0;
  const v2raw = document.getElementById("manageValue2").value;

  if (!name) return showMessage("manageMessage", "名前を入力してください", "warn");

  if (kind === "hinge") {
    if (!v1) return showMessage("manageMessage", "値を入力してください", "warn");
    if (hinges.some((x, i) => i !== index && x.name.trim().toLowerCase() === name.toLowerCase())) {
      return showMessage("manageMessage", "登録済みです（同じ名前）", "warn");
    }
    hinges[index].name = name;
    hinges[index].value = v1;
    saveHinges();
    loadHingeOptions();
  }

  if (kind === "strike") {
    if (!v1) return showMessage("manageMessage", "下端を入力してください", "warn");
    const extra = parseStrikeExtra(v2raw);
    if (!extra.height || !extra.thickness) {
      return showMessage("manageMessage", "値2に『高さ,厚み』を入力してください 例: 110,2.5", "warn");
    }
    if (strikes.some((x, i) => i !== index && x.name.trim().toLowerCase() === name.toLowerCase())) {
      return showMessage("manageMessage", "登録済みです（同じ名前）", "warn");
    }
    strikes[index].name = name;
    strikes[index].offset = v1;
    strikes[index].height = extra.height;
    strikes[index].thickness = extra.thickness;
    saveStrikes();
    loadStrikeOptions();
  }

  if (kind === "flush") {
    if (!v1) return showMessage("manageMessage", "値を入力してください", "warn");
    if (flushes.some((x, i) => i !== index && x.name.trim().toLowerCase() === name.toLowerCase())) {
      return showMessage("manageMessage", "登録済みです（同じ名前）", "warn");
    }
    flushes[index].name = name;
    flushes[index].value = v1;
    saveFlushes();
    loadFlushOptions();
  }

  refreshAllLists();
  clearManageEdit();
  showMessage("manageMessage", "更新しました", "ok");
  calc();
}

function deleteManaged(kind, index) {
  clearMessage("manageMessage");

  if (kind === "hinge") {
    const item = hinges[index];
    if (!item || item.isDefault) return showMessage("manageMessage", "標準の丁番は削除できません", "warn");
    hinges.splice(index, 1);
    saveHinges();
    loadHingeOptions();
  }

  if (kind === "strike") {
    const item = strikes[index];
    if (!item || item.isDefault) return showMessage("manageMessage", "標準のストライクは削除できません", "warn");
    strikes.splice(index, 1);
    saveStrikes();
    loadStrikeOptions();
  }

  if (kind === "flush") {
    const item = flushes[index];
    if (!item || item.isDefault) return showMessage("manageMessage", "標準のフランス落としは削除できません", "warn");
    flushes.splice(index, 1);
    saveFlushes();
    loadFlushOptions();
  }

  if (manageEditing.type === kind && manageEditing.index === index) clearManageEdit();
  refreshAllLists();
  showMessage("manageMessage", "削除しました", "info");
  calc();
}

document.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("button[data-action]");
  if (!actionBtn) return;
  const kind = actionBtn.dataset.kind;
  const index = Number(actionBtn.dataset.index);
  const action = actionBtn.dataset.action;
  if (action === "edit") startManageEdit(kind, index);
  if (action === "delete") deleteManaged(kind, index);
});

function bindDiagramTabs() {
  document.querySelectorAll("[data-diagram-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-diagram-tab]").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".diagram-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`diagram-${btn.dataset.diagramTab}`).classList.add("active");
      setTimeout(fitAllDiagramCanvases, 0);
    });
  });
}

function fitDiagramCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const stage = canvas.parentElement;
  const baseWidth = Number(canvas.dataset.baseWidth);
  const baseHeight = Number(canvas.dataset.baseHeight);
  const stageWidth = stage.clientWidth;
  if (!baseWidth || !stageWidth) return;
  const scale = stageWidth / baseWidth;
  canvas.style.transform = `scale(${scale})`;
  stage.style.height = `${baseHeight * scale}px`;
}

function fitAllDiagramCanvases() {
  fitDiagramCanvas("verticalCanvas");
  fitDiagramCanvas("horizontalCanvas");
}

function syncOverlayToInput(link, value) {
  document.querySelectorAll(`.overlay-input[data-link="${link}"]`).forEach(el => {
    if (document.activeElement !== el) {
      el.value = (value || value === 0) ? value : "";
    }
  });
}

function syncMirrors() {
  setValue("topMitukeMirror", getVal("topMituke") || "");
  setValue("topGapMirror", getVal("topGap") || "");
  setValue("topBaseMirror", getVal("topBase") || "");
  setValue("bottomSill1Mirror", getVal("bottomSill1") || "");
  setValue("bottomSill2Mirror", getVal("bottomSill2") || "");
  setValue("bottomGapMirror", getVal("bottomGap") || "");
  setValue("bottomBaseMirror", getVal("bottomBase") || "");
  setValue("dhMirror", getVal("dh") || "");
  setValue("diagramHMirror", getVal("diagramH") || "");
  setValue("strikeFromBottomMirror", getVal("strikeFromBottom") || "");
  setValue("strikeBaseMirror", getVal("strikeBase") || "");
  setValue("parentWMirror", getVal("parentW") || "");
  setValue("meetingInputMirror", getVal("meetingInput") || "");
  setValue("dwMirror2", getVal("dwInput") || "");
  setValue("dwInputMirror", getVal("dwInput") || "");
}

function calc() {
  const topMituke = getVal("topMituke");
  const topGap = getVal("topGap");
  const topBase = getVal("topBase");
  const bottomSill1 = getVal("bottomSill1");
  const bottomSill2 = getVal("bottomSill2");
  const bottomSill = bottomSill1 + bottomSill2;
  const bottomGap = getVal("bottomGap");
  const bottomBase = getVal("bottomBase");
  const dh = getVal("dh");
  const count = Math.floor(getVal("hingeCount"));

  const strikeFromBottom = bottomSill1 + bottomSill2;
  setValue("strikeFromBottom", strikeFromBottom || "");

  const selectedHinge = getSelectedHinge();
  const hingeValue = selectedHinge ? Number(selectedHinge.value) : 0;
  setValue("hingeValueViewTop", hingeValue || "");
  setValue("hingeValueViewBottom", hingeValue || "");

  const topDim = topMituke + topGap + topBase + hingeValue;
  const bottomDim = bottomSill + bottomGap + bottomBase - hingeValue;
  const frameLength = topMituke + topGap + dh + bottomGap + bottomSill;
  setValue("topDim", topDim || "");
  setValue("bottomDim", bottomDim || "");
  setValue("frameLength", frameLength || "");

  const selectedStrike = getSelectedStrike();
  const strikeOffset = selectedStrike ? Number(selectedStrike.offset) : 0;
  const strikeHeight = selectedStrike ? Number(selectedStrike.height) : 0;
  const strikeThickness = selectedStrike ? Number(selectedStrike.thickness) : 0;
  setValue("strikeOffsetView", strikeOffset || "");
  setValue("strikeHeightView", strikeHeight || "");
  setValue("strikeThicknessView", strikeThickness || "");

  const strikeBase = getVal("strikeBase");
  const strikeResult = strikeFromBottom + strikeBase - strikeOffset;
  setValue("strikeResult", strikeResult || "");
  const strikeTop = strikeResult + strikeHeight;
  const strikeCenter = strikeResult + strikeHeight / 2;
  setValue("strikeTop", strikeTop || "");
  setValue("strikeCenter", strikeCenter || "");

  const frameThickness = getVal("frameThickness");
  const spacer = strikeThickness - frameThickness;
  setValue("spacerResult", spacer > 0 ? spacer.toFixed(1) : spacer === 0 ? "0" : "");

  const parentW = getVal("parentW");
  const meetingInput = getVal("meetingInput");
  const meetingHalf = meetingInput / 2;
  const flushMirror = parentW;
  setValue("flushMirror", flushMirror || "");
  setValue("flushValueView", flushMirror || "");
  setValue("flushValueMirror", flushMirror || "");
  const flushResult = parentW + meetingHalf + flushMirror;
  setValue("meetingHalf", meetingHalf || "");
  setValue("flushResult", flushResult || "");

  const hingeSelect = document.getElementById("hingeSelect");
  const strikeSelect = document.getElementById("strikeSelect");
  const flushSelect = document.getElementById("flushSelect");
  if (hingeSelect) safeSet(HINGE_SELECTED_KEY, hingeSelect.value);
  if (strikeSelect) safeSet(STRIKE_SELECTED_KEY, strikeSelect.value);
  if (flushSelect) safeSet(FLUSH_SELECTED_KEY, flushSelect.value);

  syncOverlayToInput("topMituke", topMituke || "");
  syncOverlayToInput("topGap", topGap || "");
  syncOverlayToInput("diagramH", getVal("diagramH") || "");
  syncOverlayToInput("dh", dh || "");
  syncOverlayToInput("bottomSill1", bottomSill1 || "");
  syncOverlayToInput("bottomSill2", bottomSill2 || "");
  syncOverlayToInput("bottomGap", bottomGap || "");
  syncOverlayToInput("parentW", parentW || "");
  syncOverlayToInput("meetingInput", meetingInput || "");
  syncOverlayToInput("flushMirror", flushMirror || "");
  syncOverlayToInput("dwInput", getVal("dwInput") || "");

  syncMirrors();

  const result = document.getElementById("resultText");
  if (!result) return;

  let text = "";

  if (frameLength > 0 && topDim > 0 && bottomDim > 0 && count >= 2) {
    const usableLength = frameLength - topDim - bottomDim;
    if (usableLength < 0) {
      text += "■ 丁番\n※ 枠全長より上下寸法の合計が大きくなっています\n\n";
    } else {
      const pitch = usableLength / (count - 1);
      const positions = [];
      for (let i = 0; i < count; i++) positions.push(topDim + pitch * i);
      text += "■ 丁番\n";
      text += "枠全長: " + frameLength.toFixed(1) + " mm\n";
      text += "ピッチ: " + pitch.toFixed(1) + " mm\n";
      positions.forEach((p, i) => {
        text += (i + 1) + "枚目: " + p.toFixed(1) + " mm\n";
      });
      text += "\n";
    }
  } else {
    text += "■ 丁番\n※ A・B・C・E・F・G・J・丁番枚数を確認してください\n\n";
  }

  text += "■ ストライク\n";
  if (strikeResult > 0) {
    text += "SA（枠下端〜Hまで）: " + strikeFromBottom.toFixed(1) + " mm\n";
    text += "位置: " + strikeResult.toFixed(1) + " mm\n";
    text += "上端: " + strikeTop.toFixed(1) + " mm\n";
    text += "中心: " + strikeCenter.toFixed(1) + " mm\n";
    if (spacer > 0) text += "スペーサー: " + spacer.toFixed(1) + " mm\n";
    else if (spacer === 0) text += "スペーサー: 0 mm\n";
    else text += "スペーサー: 不要\n";
    text += "\n";
  } else {
    text += "※ E・F・ストライク基準・ストライク種類を確認してください\n\n";
  }

  text += "■ フランス落とし\n";
  if (flushResult > 0) {
    text += "親W: " + parentW.toFixed(1) + " mm\n";
    text += "召合わせ/2: " + meetingHalf.toFixed(1) + " mm\n";
    text += "U=S: " + flushMirror.toFixed(1) + " mm\n";
    text += "位置: " + flushResult.toFixed(1) + " mm\n\n";
  } else {
    text += "※ 親W・召合わせを確認してください\n\n";
  }

  text += "■ DW\n";
  const dw = getVal("dwInput");
  if (dw > 0) {
    text += "DW: " + dw.toFixed(1) + " mm\n\n";
  } else {
    text += "※ DWを入力してください\n\n";
  }

  text += "■ 選択中の金物\n";
  text += "丁番: " + (selectedHinge ? selectedHinge.name : "未選択") + "\n";
  text += "ストライク: " + (selectedStrike ? selectedStrike.name : "未選択") + "\n";
  text += "フランス落とし: " + (getSelectedFlush() ? getSelectedFlush().name : "未選択") + "\n";

  result.textContent = text;

  const quickLines = [];
  if (topDim > 0) quickLines.push("上丁番 " + topDim.toFixed(1) + " mm");
  if (bottomDim > 0) quickLines.push("下丁番 " + bottomDim.toFixed(1) + " mm");
  if (strikeResult > 0) quickLines.push("ストライク " + strikeResult.toFixed(1) + " mm");
  if (flushResult > 0) quickLines.push("フランス落とし " + flushResult.toFixed(1) + " mm");
  if (dw > 0) quickLines.push("DW " + dw.toFixed(1) + " mm");

  setText("quickResult", quickLines.length ? quickLines.join(" / ") : "未入力");
}

function bindOverlayInputs() {
  document.querySelectorAll(".overlay-input").forEach(input => {
    input.addEventListener("input", e => {
      e.target.value = normalizeNumberInputValue(e.target.value);
      calc();
    });

    input.addEventListener("focus", () => {
      if (typeof input.select === "function") input.select();
    });
  });
}

function bindGeneralInputs() {
  ["topBase", "bottomBase", "strikeBase", "frameThickness", "hingeCount"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", e => {
      e.target.value = normalizeNumberInputValue(e.target.value);
      calc();
    });
  });

  ["hingeSelect", "strikeSelect", "flushSelect"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", calc);
  });
}

function preventIosZoomLikeBehavior() {
  document.querySelectorAll("input, select, textarea").forEach(el => {
    el.setAttribute("autocapitalize", "off");
    el.setAttribute("autocomplete", "off");
    el.setAttribute("autocorrect", "off");
    el.setAttribute("spellcheck", "false");
  });
}

function ensureResizeHandles() {
  document.querySelectorAll(".overlay-input[data-link]").forEach(el => {
    if (el.querySelector(".resize-handle")) return;
    const handle = document.createElement("span");
    handle.className = "resize-handle";
    handle.dataset.role = "resize-handle";
    el.appendChild(handle);
  });
}

function cloneLayoutMap(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getSavedLayoutPositions() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return cloneLayoutMap(defaultLayoutPositions);
    const parsed = JSON.parse(raw);
    return { ...cloneLayoutMap(defaultLayoutPositions), ...parsed };
  } catch {
    return cloneLayoutMap(defaultLayoutPositions);
  }
}

function saveLayoutPositions(map) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

function findOverlayLabel(inputEl) {
  const id = inputEl.id;
  return document.querySelector(`.overlay-label[data-for="${id}"]`);
}

function applyLayoutPositions() {
  const map = getSavedLayoutPositions();

  document.querySelectorAll(".overlay-input[data-link]").forEach(el => {
    const key = el.dataset.link;
    const pos = map[key];
    if (!pos) return;

    el.style.left = pos.left + "px";
    el.style.top = pos.top + "px";
    el.style.width = pos.width + "px";
    el.style.height = pos.height + "px";

    const label = findOverlayLabel(el);
    if (label) {
      label.style.left = (pos.labelLeft ?? pos.left) + "px";
      label.style.top = (pos.labelTop ?? Math.max(0, pos.top - 26)) + "px";
      label.textContent = pos.labelText || label.textContent;
    }
  });
}

function getCurrentLayoutPositions() {
  const map = {};
  document.querySelectorAll(".overlay-input[data-link]").forEach(el => {
    const key = el.dataset.link;
    const label = findOverlayLabel(el);
    map[key] = {
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
      width: parseFloat(el.style.width) || el.offsetWidth || 100,
      height: parseFloat(el.style.height) || el.offsetHeight || 40,
      labelLeft: label ? (parseFloat(label.style.left) || 0) : (parseFloat(el.style.left) || 0),
      labelTop: label ? (parseFloat(label.style.top) || 0) : Math.max(0, (parseFloat(el.style.top) || 0) - 26),
      labelText: label ? label.textContent : ""
    };
  });
  return map;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function setLayoutEditMode(on) {
  layoutEditMode = on;
  document.body.classList.toggle("layout-edit-on", on);
  const btn = document.getElementById("toggleLayoutEditBtn");
  if (btn) btn.textContent = "配置調整モード: " + (on ? "ON" : "OFF");
  showMessage(
    "layoutMessage",
    on ? "配置調整中です。ドラッグで移動、右下の丸でサイズ変更、ラベル名変更ができます。" : "通常表示です。色付きBOXとラベルを非表示にしました。",
    "info"
  );
}

function getPointerClientXY(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function startDragBox(e) {
  if (!layoutEditMode) return;

  const resizeHandle = e.target.closest(".resize-handle");
  if (resizeHandle) return;

  const target = e.target.closest(".overlay-input[data-link]");
  if (!target) return;

  e.preventDefault();

  const canvas = target.closest(".diagram-canvas");
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / canvas.offsetWidth || 1;
  const pt = getPointerClientXY(e);

  dragState = {
    target,
    canvas,
    scale,
    startClientX: pt.x,
    startClientY: pt.y,
    startLeft: parseFloat(target.style.left) || 0,
    startTop: parseFloat(target.style.top) || 0
  };

  target.classList.add("dragging");

  const select = document.getElementById("layoutItemSelect");
  if (select) {
    select.value = target.dataset.link;
    loadLabelEditorFromSelection();
  }
}

function moveDragBox(e) {
  if (!dragState || !layoutEditMode) return;
  e.preventDefault();

  const { target, canvas, scale, startClientX, startClientY, startLeft, startTop } = dragState;
  const pt = getPointerClientXY(e);

  const dx = (pt.x - startClientX) / scale;
  const dy = (pt.y - startClientY) / scale;

  const newLeft = clamp(startLeft + dx, 0, canvas.offsetWidth - target.offsetWidth);
  const newTop = clamp(startTop + dy, 0, canvas.offsetHeight - target.offsetHeight);

  target.style.left = newLeft + "px";
  target.style.top = newTop + "px";

  const label = findOverlayLabel(target);
  if (label) {
    label.style.left = Math.max(0, newLeft - 18) + "px";
    label.style.top = Math.max(0, newTop - 26) + "px";
  }
}

function endDragBox() {
  if (!dragState) return;
  dragState.target.classList.remove("dragging");
  dragState = null;
  saveLayoutPositions(getCurrentLayoutPositions());
}

function startResizeBox(e) {
  if (!layoutEditMode) return;

  const handle = e.target.closest(".resize-handle");
  if (!handle) return;

  const target = handle.parentElement;
  const canvas = target.closest(".diagram-canvas");
  if (!target || !canvas) return;

  e.preventDefault();
  e.stopPropagation();

  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / canvas.offsetWidth || 1;
  const pt = getPointerClientXY(e);

  resizeState = {
    target,
    canvas,
    scale,
    startClientX: pt.x,
    startClientY: pt.y,
    startWidth: parseFloat(target.style.width) || target.offsetWidth,
    startHeight: parseFloat(target.style.height) || target.offsetHeight
  };

  target.classList.add("resizing");

  const select = document.getElementById("layoutItemSelect");
  if (select) {
    select.value = target.dataset.link;
    loadLabelEditorFromSelection();
  }
}

function moveResizeBox(e) {
  if (!resizeState || !layoutEditMode) return;
  e.preventDefault();

  const { target, scale, startClientX, startClientY, startWidth, startHeight } = resizeState;
  const pt = getPointerClientXY(e);

  const dx = (pt.x - startClientX) / scale;
  const dy = (pt.y - startClientY) / scale;

  const newWidth = clamp(startWidth + dx, 48, 320);
  const newHeight = clamp(startHeight + dy, 30, 90);

  target.style.width = newWidth + "px";
  target.style.height = newHeight + "px";
}

function endResizeBox() {
  if (!resizeState) return;
  resizeState.target.classList.remove("resizing");
  resizeState = null;
  saveLayoutPositions(getCurrentLayoutPositions());
}

function populateLayoutItemSelect() {
  const select = document.getElementById("layoutItemSelect");
  if (!select) return;

  select.innerHTML = "";
  document.querySelectorAll(".overlay-input[data-link]").forEach(el => {
    const label = findOverlayLabel(el);
    const text = label ? label.textContent : el.dataset.link;
    select.add(new Option(text, el.dataset.link));
  });
}

function refreshLayoutItemSelectLabels() {
  const select = document.getElementById("layoutItemSelect");
  if (!select) return;
  const current = select.value;
  populateLayoutItemSelect();
  if (current) select.value = current;
}

function loadLabelEditorFromSelection() {
  const select = document.getElementById("layoutItemSelect");
  const input = document.getElementById("layoutLabelName");
  if (!select || !input) return;

  const key = select.value;
  const target = document.querySelector(`.overlay-input[data-link="${key}"]`);
  if (!target) return;

  const label = findOverlayLabel(target);
  input.value = label ? label.textContent : "";
}

function saveLabelNameFromEditor() {
  const key = document.getElementById("layoutItemSelect")?.value;
  const newName = document.getElementById("layoutLabelName")?.value.trim() || "";

  if (!key) return showMessage("layoutMessage", "項目を選んでください", "warn");
  if (!newName) return showMessage("layoutMessage", "ラベル名を入力してください", "warn");

  const input = document.querySelector(`.overlay-input[data-link="${key}"]`);
  if (!input) return showMessage("layoutMessage", "対象が見つかりません", "warn");

  const label = findOverlayLabel(input);
  if (!label) return showMessage("layoutMessage", "ラベルが見つかりません", "warn");

  label.textContent = newName;
  refreshLayoutItemSelectLabels();
  saveLayoutPositions(getCurrentLayoutPositions());
  showMessage("layoutMessage", "ラベル名を保存しました", "ok");
}

function exportLayoutPositions() {
  const map = getCurrentLayoutPositions();
  const text = JSON.stringify(map, null, 2);

  const wrap = document.getElementById("layoutExportWrap");
  const area = document.getElementById("layoutExportText");

  if (wrap) wrap.style.display = "block";
  if (area) area.value = text;

  navigator.clipboard.writeText(text).then(() => {
    showMessage("layoutMessage", "座標JSONを表示し、クリップボードにもコピーしました", "ok");
  }).catch(() => {
    showMessage("layoutMessage", "座標JSONを表示しました", "info");
  });
}

function resetLayoutPositions() {
  saveLayoutPositions(cloneLayoutMap(defaultLayoutPositions));
  applyLayoutPositions();
  refreshLayoutItemSelectLabels();
  loadLabelEditorFromSelection();
  showMessage("layoutMessage", "配置とラベルを初期位置に戻しました", "ok");
}

function initLayoutEditor() {
  ensureResizeHandles();
  applyLayoutPositions();
  populateLayoutItemSelect();
  loadLabelEditorFromSelection();

  const toggleBtn = document.getElementById("toggleLayoutEditBtn");
  const resetBtn = document.getElementById("resetLayoutBtn");
  const exportBtn = document.getElementById("exportLayoutBtn");
  const saveLabelBtn = document.getElementById("saveLabelBtn");
  const layoutItemSelect = document.getElementById("layoutItemSelect");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      setLayoutEditMode(!layoutEditMode);
    });
  }

  if (resetBtn) resetBtn.addEventListener("click", resetLayoutPositions);
  if (exportBtn) exportBtn.addEventListener("click", exportLayoutPositions);
  if (saveLabelBtn) saveLabelBtn.addEventListener("click", saveLabelNameFromEditor);
  if (layoutItemSelect) layoutItemSelect.addEventListener("change", loadLabelEditorFromSelection);

  document.addEventListener("mousedown", startResizeBox);
  document.addEventListener("touchstart", startResizeBox, { passive: false });
  document.addEventListener("mousemove", moveResizeBox, { passive: false });
  document.addEventListener("touchmove", moveResizeBox, { passive: false });
  document.addEventListener("mouseup", endResizeBox);
  document.addEventListener("touchend", endResizeBox);

  document.addEventListener("mousedown", startDragBox);
  document.addEventListener("touchstart", startDragBox, { passive: false });
  document.addEventListener("mousemove", moveDragBox, { passive: false });
  document.addEventListener("touchmove", moveDragBox, { passive: false });
  document.addEventListener("mouseup", endDragBox);
  document.addEventListener("touchend", endDragBox);
}

function initButtons() {
  const addHingeBtn = document.getElementById("addHingeBtn");
  const addStrikeBtn = document.getElementById("addStrikeBtn");
  const addFlushBtn = document.getElementById("addFlushBtn");
  const manageSaveBtn = document.getElementById("manageSaveBtn");
  const manageCancelBtn = document.getElementById("manageCancelBtn");

  if (addHingeBtn) addHingeBtn.addEventListener("click", addHingeFromTab);
  if (addStrikeBtn) addStrikeBtn.addEventListener("click", addStrikeFromTab);
  if (addFlushBtn) addFlushBtn.addEventListener("click", addFlushFromTab);
  if (manageSaveBtn) manageSaveBtn.addEventListener("click", saveManageEdit);
  if (manageCancelBtn) {
    manageCancelBtn.addEventListener("click", () => {
      clearManageEdit();
      clearMessage("manageMessage");
    });
  }
}

function initDefaults() {
  if (!getVal("topBase")) setValue("topBase", 150);
  if (!getVal("bottomBase")) setValue("bottomBase", 150);
  if (!getVal("hingeCount")) setValue("hingeCount", 2);
}

function init() {
  loadSavedHinges();
  loadSavedStrikes();
  loadSavedFlushes();

  loadHingeOptions();
  loadStrikeOptions();
  loadFlushOptions();

  refreshAllLists();
  bindDiagramTabs();
  bindOverlayInputs();
  bindGeneralInputs();
  initButtons();
  initDefaults();
  preventIosZoomLikeBehavior();

  calc();
  fitAllDiagramCanvases();
  initLayoutEditor();
}

window.addEventListener("resize", fitAllDiagramCanvases);
window.addEventListener("load", fitAllDiagramCanvases);
document.addEventListener("DOMContentLoaded", init);