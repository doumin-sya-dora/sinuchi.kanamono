const LAYOUT_STORAGE_KEY = "kanamonoLayoutPositionsStage1";

let layoutEditMode = false;
let dragState = null;

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

function showMessage(id, text, type) {
  const box = document.getElementById(id);
  if (!box) return;
  box.textContent = text;
  box.className = "message " + type;
  box.style.display = "block";
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
  if (!input) return;

  const label = findOverlayLabel(input);
  if (!label) return;

  label.textContent = newName;
  refreshLayoutItemSelectLabels();
  saveLayoutPositions(getCurrentLayoutPositions());
  showMessage("layoutMessage", "ラベル名を保存しました", "ok");
}

function exportLayoutPositions() {
  const text = JSON.stringify(getCurrentLayoutPositions(), null, 2);
  document.getElementById("layoutExportWrap").style.display = "block";
  document.getElementById("layoutExportText").value = text;

  navigator.clipboard.writeText(text).then(() => {
    showMessage("layoutMessage", "座標JSONを表示し、コピーしました", "ok");
  }).catch(() => {
    showMessage("layoutMessage", "座標JSONを表示しました", "info");
  });
}

function resetLayoutPositions() {
  saveLayoutPositions(cloneLayoutMap(defaultLayoutPositions));
  applyLayoutPositions();
  refreshLayoutItemSelectLabels();
  loadLabelEditorFromSelection();
  calc();
  showMessage("layoutMessage", "配置を初期化しました", "ok");
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function setLayoutEditMode(on) {
  layoutEditMode = on;
  document.body.classList.toggle("layout-edit-on", on);

  const btn = document.getElementById("toggleLayoutEditBtn");
  if (btn) btn.textContent = "配置調整モード: " + (on ? "ON" : "OFF");

  document.querySelectorAll(".overlay-input[data-link]").forEach(el => {
    if (on) {
      el.setAttribute("readonly", "readonly");
    } else {
      if (el.dataset.link !== "flushMirror") el.removeAttribute("readonly");
    }
  });

  showMessage(
    "layoutMessage",
    on ? "配置調整中です。ドラッグで移動できます。" : "通常表示に戻しました。",
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

function bindOverlayInputs() {
  document.querySelectorAll(".overlay-input").forEach(input => {
    input.addEventListener("input", e => {
      if (layoutEditMode) return;
      e.target.value = normalizeNumberInputValue(e.target.value);
      calc();
    });

    input.addEventListener("focus", () => {
      if (layoutEditMode) return;
      if (typeof input.select === "function") input.select();
    });
  });
}

function bindGeneralInputs() {
  [
    "topBase",
    "bottomBase",
    "strikeBase",
    "frameThickness",
    "hingeValueInput",
    "hingeCount",
    "strikeOffsetInput",
    "strikeHeightInput",
    "strikeThicknessInput",
    "flushValueInput"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", e => {
      e.target.value = normalizeNumberInputValue(e.target.value);
      calc();
    });
  });
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
  const hingeValue = getVal("hingeValueInput");
  const count = Math.floor(getVal("hingeCount"));

  const topDim = topMituke + topGap + topBase + hingeValue;
  const bottomDim = bottomSill + bottomGap + bottomBase - hingeValue;
  const frameLength = topMituke + topGap + dh + bottomGap + bottomSill;

  const strikeOffset = getVal("strikeOffsetInput");
  const strikeHeight = getVal("strikeHeightInput");
  const strikeThickness = getVal("strikeThicknessInput");
  const strikeBase = getVal("strikeBase");
  const strikeFromBottom = bottomSill1 + bottomSill2;
  const strikeResult = strikeFromBottom + strikeBase - strikeOffset;
  const strikeTop = strikeResult + strikeHeight;
  const strikeCenter = strikeResult + strikeHeight / 2;

  const frameThickness = getVal("frameThickness");
  const spacer = strikeThickness - frameThickness;

  const parentW = getVal("parentW");
  const meetingInput = getVal("meetingInput");
  const meetingHalf = meetingInput / 2;
  const flushValue = getVal("flushValueInput");
  const flushMirror = parentW;
  const flushResult = parentW + meetingHalf + flushMirror + flushValue - parentW;

  setValue("flushMirror", flushMirror || "");
  setValue("meetingInput", meetingInput || "");
  setValue("dwInput", getVal("dwInput") || "");

  const result = document.getElementById("resultText");
  let text = "";

  text += "■ 丁番\n";
  if (frameLength > 0 && topDim > 0 && bottomDim > 0 && count >= 2) {
    const usableLength = frameLength - topDim - bottomDim;
    if (usableLength < 0) {
      text += "※ 枠全長より上下寸法の合計が大きいです\n\n";
    } else {
      const pitch = usableLength / (count - 1);
      text += `上丁番: ${topDim.toFixed(1)} mm\n`;
      text += `下丁番: ${bottomDim.toFixed(1)} mm\n`;
      text += `枠全長: ${frameLength.toFixed(1)} mm\n`;
      text += `ピッチ: ${pitch.toFixed(1)} mm\n\n`;
    }
  } else {
    text += "※ A・B・J・E・F・G・基準・丁番寸法・丁番枚数を入力してください\n\n";
  }

  text += "■ ストライク\n";
  if (strikeResult > 0) {
    text += `下端位置: ${strikeResult.toFixed(1)} mm\n`;
    text += `上端: ${strikeTop.toFixed(1)} mm\n`;
    text += `中心: ${strikeCenter.toFixed(1)} mm\n`;
    if (spacer > 0) text += `必要スペーサー: ${spacer.toFixed(1)} mm\n`;
    else if (spacer === 0) text += `必要スペーサー: 0 mm\n`;
    else text += "必要スペーサー: 不要\n";
    text += "\n";
  } else {
    text += "※ E・F・ストライク基準・下端・高さを入力してください\n\n";
  }

  text += "■ フランス落とし\n";
  if (parentW > 0 || meetingInput > 0 || flushValue > 0) {
    text += `親W: ${parentW.toFixed(1)} mm\n`;
    text += `召合わせ/2: ${meetingHalf.toFixed(1)} mm\n`;
    text += `U=S: ${flushMirror.toFixed(1)} mm\n`;
    text += `金物寸法: ${flushValue.toFixed(1)} mm\n`;
    text += `位置: ${(flushMirror + meetingHalf + flushValue).toFixed(1)} mm\n\n`;
  } else {
    text += "※ S・T・金物寸法を入力してください\n\n";
  }

  text += "■ DW\n";
  const dw = getVal("dwInput");
  if (dw > 0) text += `DW: ${dw.toFixed(1)} mm\n`;
  else text += "※ DWを入力してください\n";

  result.textContent = text;

  const quick = [];
  if (topDim > 0) quick.push("上丁番 " + topDim.toFixed(1));
  if (bottomDim > 0) quick.push("下丁番 " + bottomDim.toFixed(1));
  if (strikeResult > 0) quick.push("ストライク " + strikeResult.toFixed(1));
  if ((flushMirror + meetingHalf + flushValue) > 0) quick.push("フランス " + (flushMirror + meetingHalf + flushValue).toFixed(1));
  if (dw > 0) quick.push("DW " + dw.toFixed(1));

  document.getElementById("quickResult").textContent = quick.length ? quick.join(" / ") + " mm" : "未入力";
}

function initLayoutEditor() {
  applyLayoutPositions();
  populateLayoutItemSelect();
  loadLabelEditorFromSelection();

  document.getElementById("toggleLayoutEditBtn").addEventListener("click", () => {
    setLayoutEditMode(!layoutEditMode);
  });

  document.getElementById("resetLayoutBtn").addEventListener("click", resetLayoutPositions);
  document.getElementById("exportLayoutBtn").addEventListener("click", exportLayoutPositions);
  document.getElementById("saveLabelBtn").addEventListener("click", saveLabelNameFromEditor);
  document.getElementById("layoutItemSelect").addEventListener("change", loadLabelEditorFromSelection);

  document.addEventListener("mousedown", startDragBox);
  document.addEventListener("touchstart", startDragBox, { passive: false });
  document.addEventListener("mousemove", moveDragBox, { passive: false });
  document.addEventListener("touchmove", moveDragBox, { passive: false });
  document.addEventListener("mouseup", endDragBox);
  document.addEventListener("touchend", endDragBox);
}

function initDefaults() {
  if (!getVal("topBase")) setValue("topBase", 150);
  if (!getVal("bottomBase")) setValue("bottomBase", 150);
  if (!getVal("hingeCount")) setValue("hingeCount", 2);
}

function init() {
  bindDiagramTabs();
  bindOverlayInputs();
  bindGeneralInputs();
  initDefaults();
  applyLayoutPositions();
  fitAllDiagramCanvases();
  initLayoutEditor();
  calc();
}

window.addEventListener("resize", fitAllDiagramCanvases);
window.addEventListener("load", fitAllDiagramCanvases);
document.addEventListener("DOMContentLoaded", init);
