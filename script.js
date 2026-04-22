const LAYOUT_STORAGE_KEY = "kanamonoLayoutPositionsUIV2";
const HINGE_STORAGE_KEY = "kanamonoHingesUIV2";
const STRIKE_STORAGE_KEY = "kanamonoStrikesUIV2";
const FLUSH_STORAGE_KEY = "kanamonoFlushesUIV2";
const HINGE_SELECTED_KEY = "kanamonoSelectedHingeUIV2";
const STRIKE_SELECTED_KEY = "kanamonoSelectedStrikeUIV2";
const FLUSH_SELECTED_KEY = "kanamonoSelectedFlushUIV2";

let layoutEditMode = false;
let dragState = null;
let hinges = [];
let strikes = [];
let flushes = [];
let manageEditing = { type: null, index: null };

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

function cloneDeep(obj){
  return JSON.parse(JSON.stringify(obj));
}

function toHalfWidth(str){
  return String(str)
    .replace(/[０-９]/g,s=>String.fromCharCode(s.charCodeAt(0)-65248))
    .replace(/[－−ー]/g,"-")
    .replace(/[．，]/g,".")
    .replace(/　/g," ");
}

function normalizeNumberInputValue(v){
  return toHalfWidth(v).replace(/[^\d.\-,]/g,"");
}

function num(v){
  return Number(toHalfWidth(v).replace(/[^\d.\-]/g,"")) || 0;
}

function getVal(id){
  const el = document.getElementById(id);
  if(!el) return 0;
  return num(el.value);
}

function setValue(id,val){
  const el = document.getElementById(id);
  if(!el) return;
  el.value = (val || val === 0) ? val : "";
}

function showMessage(id,text,type){
  const box = document.getElementById(id);
  if(!box) return;
  box.textContent = text;
  box.className = "message " + type;
  box.style.display = "block";
}

function clearMessage(id){
  const box = document.getElementById(id);
  if(!box) return;
  box.textContent = "";
  box.style.display = "none";
  box.className = "message";
}

function getStoredJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return cloneDeep(fallback);
    return JSON.parse(raw);
  }catch{
    return cloneDeep(fallback);
  }
}

function setStoredJSON(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch{}
}

function fitDiagramCanvas(canvasId){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const stage = canvas.parentElement;
  const baseWidth = Number(canvas.dataset.baseWidth);
  const baseHeight = Number(canvas.dataset.baseHeight);
  const stageWidth = stage.clientWidth;
  if(!baseWidth || !stageWidth) return;
  const scale = stageWidth / baseWidth;
  canvas.style.transform = `scale(${scale})`;
  stage.style.height = `${baseHeight * scale}px`;
}

function fitAllDiagramCanvases(){
  fitDiagramCanvas("verticalCanvas");
  fitDiagramCanvas("horizontalCanvas");
}

function findOverlayLabel(inputEl){
  return document.querySelector(`.overlay-label[data-for="${inputEl.id}"]`);
}

function applyLayoutPositions(){
  const map = getStoredJSON(LAYOUT_STORAGE_KEY, defaultLayoutPositions);
  document.querySelectorAll(".overlay-input[data-link]").forEach(el=>{
    const pos = map[el.dataset.link];
    if(!pos) return;

    el.style.left = pos.left + "px";
    el.style.top = pos.top + "px";
    el.style.width = pos.width + "px";
    el.style.height = pos.height + "px";

    const label = findOverlayLabel(el);
    if(label){
      label.style.left = (pos.labelLeft ?? pos.left) + "px";
      label.style.top = (pos.labelTop ?? Math.max(0,pos.top - 26)) + "px";
      label.textContent = pos.labelText || label.textContent;
    }
  });
}

function getCurrentLayoutPositions(){
  const map = {};
  document.querySelectorAll(".overlay-input[data-link]").forEach(el=>{
    const label = findOverlayLabel(el);
    map[el.dataset.link] = {
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
      width: parseFloat(el.style.width) || 100,
      height: parseFloat(el.style.height) || 40,
      labelLeft: label ? (parseFloat(label.style.left) || 0) : 0,
      labelTop: label ? (parseFloat(label.style.top) || 0) : 0,
      labelText: label ? label.textContent : ""
    };
  });
  return map;
}

function populateLayoutItemSelect(){
  const select = document.getElementById("layoutItemSelect");
  if(!select) return;
  select.innerHTML = "";
  document.querySelectorAll(".overlay-input[data-link]").forEach(el=>{
    const label = findOverlayLabel(el);
    select.add(new Option(label ? label.textContent : el.dataset.link, el.dataset.link));
  });
}

function refreshLayoutItemSelectLabels(){
  const select = document.getElementById("layoutItemSelect");
  if(!select) return;
  const current = select.value;
  populateLayoutItemSelect();
  if(current) select.value = current;
}

function loadLabelEditorFromSelection(){
  const key = document.getElementById("layoutItemSelect").value;
  const target = document.querySelector(`.overlay-input[data-link="${key}"]`);
  if(!target) return;
  const label = findOverlayLabel(target);
  document.getElementById("layoutLabelName").value = label ? label.textContent : "";
}

function saveLabelNameFromEditor(){
  const key = document.getElementById("layoutItemSelect").value;
  const newName = document.getElementById("layoutLabelName").value.trim();
  if(!key || !newName) return showMessage("layoutMessage","項目とラベル名を確認してください","warn");

  const target = document.querySelector(`.overlay-input[data-link="${key}"]`);
  if(!target) return;
  const label = findOverlayLabel(target);
  if(!label) return;

  label.textContent = newName;
  refreshLayoutItemSelectLabels();
  setStoredJSON(LAYOUT_STORAGE_KEY, getCurrentLayoutPositions());
  showMessage("layoutMessage","ラベル名を保存しました","ok");
}

function exportLayoutPositions(){
  const text = JSON.stringify(getCurrentLayoutPositions(), null, 2);
  document.getElementById("layoutExportWrap").style.display = "block";
  document.getElementById("layoutExportText").value = text;
  navigator.clipboard.writeText(text).then(()=>{
    showMessage("layoutMessage","座標JSONをコピーしました","ok");
  }).catch(()=>{
    showMessage("layoutMessage","座標JSONを表示しました","info");
  });
}

function resetLayoutPositions(){
  setStoredJSON(LAYOUT_STORAGE_KEY, defaultLayoutPositions);
  applyLayoutPositions();
  refreshLayoutItemSelectLabels();
  loadLabelEditorFromSelection();
  calc();
  showMessage("layoutMessage","配置を初期化しました","ok");
}

function clamp(numValue, min, max){
  return Math.max(min, Math.min(max, numValue));
}

function setLayoutEditMode(on){
  layoutEditMode = on;
  document.body.classList.toggle("layout-edit-on", on);
  document.getElementById("toggleLayoutEditBtn").textContent = "配置調整モード: " + (on ? "ON" : "OFF");

  document.querySelectorAll(".overlay-input[data-link]").forEach(el=>{
    if(on){
      el.setAttribute("readonly","readonly");
    }else{
      if(el.dataset.link !== "flushMirror" && el.dataset.link !== "dh"){
        el.removeAttribute("readonly");
      }
    }
  });

  showMessage("layoutMessage", on ? "配置調整中です。ドラッグで移動できます。" : "通常表示に戻しました。", "info");
}

function getPointerClientXY(e){
  if(e.touches && e.touches[0]) return {x:e.touches[0].clientX, y:e.touches[0].clientY};
  if(e.changedTouches && e.changedTouches[0]) return {x:e.changedTouches[0].clientX, y:e.changedTouches[0].clientY};
  return {x:e.clientX, y:e.clientY};
}

function startDragBox(e){
  if(!layoutEditMode) return;
  const target = e.target.closest(".overlay-input[data-link]");
  if(!target) return;

  e.preventDefault();

  const canvas = target.closest(".diagram-canvas");
  if(!canvas) return;

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
  document.getElementById("layoutItemSelect").value = target.dataset.link;
  loadLabelEditorFromSelection();
}

function moveDragBox(e){
  if(!dragState || !layoutEditMode) return;
  e.preventDefault();

  const {target, canvas, scale, startClientX, startClientY, startLeft, startTop} = dragState;
  const pt = getPointerClientXY(e);

  const dx = (pt.x - startClientX) / scale;
  const dy = (pt.y - startClientY) / scale;

  const newLeft = clamp(startLeft + dx, 0, canvas.offsetWidth - target.offsetWidth);
  const newTop = clamp(startTop + dy, 0, canvas.offsetHeight - target.offsetHeight);

  target.style.left = newLeft + "px";
  target.style.top = newTop + "px";

  const label = findOverlayLabel(target);
  if(label){
    label.style.left = Math.max(0, newLeft - 18) + "px";
    label.style.top = Math.max(0, newTop - 26) + "px";
  }
}

function endDragBox(){
  if(!dragState) return;
  dragState.target.classList.remove("dragging");
  dragState = null;
  setStoredJSON(LAYOUT_STORAGE_KEY, getCurrentLayoutPositions());
}

function loadHardware(){
  hinges = getStoredJSON(HINGE_STORAGE_KEY, defaultHinges);
  strikes = getStoredJSON(STRIKE_STORAGE_KEY, defaultStrikes);
  flushes = getStoredJSON(FLUSH_STORAGE_KEY, defaultFlushes);

  defaultHinges.forEach(def=>{
    if(!hinges.some(x=>x.name === def.name && Number(x.value) === Number(def.value))) hinges.unshift(def);
  });
  defaultStrikes.forEach(def=>{
    if(!strikes.some(x=>x.name === def.name && Number(x.offset) === Number(def.offset) && Number(x.height) === Number(def.height) && Number(x.thickness) === Number(def.thickness))) strikes.unshift(def);
  });
  defaultFlushes.forEach(def=>{
    if(!flushes.some(x=>x.name === def.name && Number(x.value) === Number(def.value))) flushes.unshift(def);
  });
}

function saveHardware(){
  setStoredJSON(HINGE_STORAGE_KEY, hinges);
  setStoredJSON(STRIKE_STORAGE_KEY, strikes);
  setStoredJSON(FLUSH_STORAGE_KEY, flushes);
}

function loadHardwareOptions(){
  const hingeSelect = document.getElementById("hingeSelect");
  const strikeSelect = document.getElementById("strikeSelect");
  const flushSelect = document.getElementById("flushSelect");

  const hingeBefore = localStorage.getItem(HINGE_SELECTED_KEY) || "";
  const strikeBefore = localStorage.getItem(STRIKE_SELECTED_KEY) || "";
  const flushBefore = localStorage.getItem(FLUSH_SELECTED_KEY) || "";

  hingeSelect.innerHTML = "";
  strikeSelect.innerHTML = "";
  flushSelect.innerHTML = "";

  hinges.forEach((item,i)=>hingeSelect.add(new Option(item.isDefault ? `${item.name}（標準）` : item.name, i)));
  strikes.forEach((item,i)=>strikeSelect.add(new Option(item.isDefault ? `${item.name}（標準）` : item.name, i)));
  flushes.forEach((item,i)=>flushSelect.add(new Option(item.isDefault ? `${item.name}（標準）` : item.name, i)));

  if(hingeBefore !== "" && hingeSelect.options[hingeBefore]) hingeSelect.value = hingeBefore;
  if(strikeBefore !== "" && strikeSelect.options[strikeBefore]) strikeSelect.value = strikeBefore;
  if(flushBefore !== "" && flushSelect.options[flushBefore]) flushSelect.value = flushBefore;

  if(!hingeSelect.value && hinges.length) hingeSelect.selectedIndex = 0;
  if(!strikeSelect.value && strikes.length) strikeSelect.selectedIndex = 0;
  if(!flushSelect.value && flushes.length) flushSelect.selectedIndex = 0;
}

function getSelectedHinge(){
  const idx = Number(document.getElementById("hingeSelect").value);
  return hinges[idx] || null;
}

function getSelectedStrike(){
  const idx = Number(document.getElementById("strikeSelect").value);
  return strikes[idx] || null;
}

function getSelectedFlush(){
  const idx = Number(document.getElementById("flushSelect").value);
  return flushes[idx] || null;
}

function addHinge(){
  clearMessage("hingeMessage");
  const name = document.getElementById("newHingeName").value.trim();
  const value = num(document.getElementById("newHingeValue").value);
  if(!name || !value) return showMessage("hingeMessage","名前と値を入力してください","warn");
  if(hinges.some(x=>x.name.toLowerCase() === name.toLowerCase())) return showMessage("hingeMessage","同じ名前があります","warn");

  hinges.push({name, value, isDefault:false});
  saveHardware();
  loadHardwareOptions();
  refreshAllLists();
  document.getElementById("newHingeName").value = "";
  document.getElementById("newHingeValue").value = "";
  showMessage("hingeMessage","追加しました","ok");
  calc();
}

function addStrike(){
  clearMessage("strikeMessage");
  const name = document.getElementById("newStrikeName").value.trim();
  const offset = num(document.getElementById("newStrikeOffset").value);
  const height = num(document.getElementById("newStrikeHeight").value);
  const thickness = num(document.getElementById("newStrikeThickness").value);
  if(!name || !offset || !height || !thickness) return showMessage("strikeMessage","全部入力してください","warn");
  if(strikes.some(x=>x.name.toLowerCase() === name.toLowerCase())) return showMessage("strikeMessage","同じ名前があります","warn");

  strikes.push({name, offset, height, thickness, isDefault:false});
  saveHardware();
  loadHardwareOptions();
  refreshAllLists();
  document.getElementById("newStrikeName").value = "";
  document.getElementById("newStrikeOffset").value = "";
  document.getElementById("newStrikeHeight").value = "";
  document.getElementById("newStrikeThickness").value = "";
  showMessage("strikeMessage","追加しました","ok");
  calc();
}

function addFlush(){
  clearMessage("flushMessage");
  const name = document.getElementById("newFlushName").value.trim();
  const value = num(document.getElementById("newFlushValue").value);
  if(!name || !value) return showMessage("flushMessage","名前と値を入力してください","warn");
  if(flushes.some(x=>x.name.toLowerCase() === name.toLowerCase())) return showMessage("flushMessage","同じ名前があります","warn");

  flushes.push({name, value, isDefault:false});
  saveHardware();
  loadHardwareOptions();
  refreshAllLists();
  document.getElementById("newFlushName").value = "";
  document.getElementById("newFlushValue").value = "";
  showMessage("flushMessage","追加しました","ok");
  calc();
}

function refreshSummaryCounts(){
  document.getElementById("hingeSummaryText").textContent = `丁番一覧（${hinges.length}件）`;
  document.getElementById("strikeSummaryText").textContent = `ストライク一覧（${strikes.length}件）`;
  document.getElementById("flushSummaryText").textContent = `フランス落とし一覧（${flushes.length}件）`;
}

function refreshHingeList(){
  const box = document.getElementById("hingeList");
  box.innerHTML = "";
  hinges.forEach((item,index)=>{
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-title">${item.name}${item.isDefault ? '<span class="badge-default">標準</span>' : ''}</div>
      <div class="item-meta">値: ${item.value}</div>
      <div class="item-actions">
        <button type="button" class="btn-edit" data-action="edit" data-kind="hinge" data-index="${index}">編集</button>
        <button type="button" class="btn-delete" data-action="delete" data-kind="hinge" data-index="${index}" ${item.isDefault ? "disabled" : ""}>削除</button>
      </div>
    `;
    box.appendChild(card);
  });
}

function refreshStrikeList(){
  const box = document.getElementById("strikeList");
  box.innerHTML = "";
  strikes.forEach((item,index)=>{
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-title">${item.name}${item.isDefault ? '<span class="badge-default">標準</span>' : ''}</div>
      <div class="item-meta">下端: ${item.offset} / 高さ: ${item.height} / 厚み: ${item.thickness}</div>
      <div class="item-actions">
        <button type="button" class="btn-edit" data-action="edit" data-kind="strike" data-index="${index}">編集</button>
        <button type="button" class="btn-delete" data-action="delete" data-kind="strike" data-index="${index}" ${item.isDefault ? "disabled" : ""}>削除</button>
      </div>
    `;
    box.appendChild(card);
  });
}

function refreshFlushList(){
  const box = document.getElementById("flushList");
  box.innerHTML = "";
  flushes.forEach((item,index)=>{
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-title">${item.name}${item.isDefault ? '<span class="badge-default">標準</span>' : ''}</div>
      <div class="item-meta">値: ${item.value}</div>
      <div class="item-actions">
        <button type="button" class="btn-edit" data-action="edit" data-kind="flush" data-index="${index}">編集</button>
        <button type="button" class="btn-delete" data-action="delete" data-kind="flush" data-index="${index}" ${item.isDefault ? "disabled" : ""}>削除</button>
      </div>
    `;
    box.appendChild(card);
  });
}

function refreshAllLists(){
  refreshSummaryCounts();
  refreshHingeList();
  refreshStrikeList();
  refreshFlushList();
}

function startManageEdit(kind,index){
  manageEditing = {type:kind,index};
  document.getElementById("manageType").value = kind;
  clearMessage("manageMessage");

  if(kind === "hinge"){
    const item = hinges[index];
    document.getElementById("manageName").value = item.name;
    document.getElementById("manageValue1").value = item.value;
    document.getElementById("manageValue2").value = "";
  }

  if(kind === "strike"){
    const item = strikes[index];
    document.getElementById("manageName").value = item.name;
    document.getElementById("manageValue1").value = item.offset;
    document.getElementById("manageValue2").value = `${item.height},${item.thickness}`;
  }

  if(kind === "flush"){
    const item = flushes[index];
    document.getElementById("manageName").value = item.name;
    document.getElementById("manageValue1").value = item.value;
    document.getElementById("manageValue2").value = "";
  }
}

function clearManageEdit(){
  manageEditing = {type:null,index:null};
  document.getElementById("manageType").value = "hinge";
  document.getElementById("manageName").value = "";
  document.getElementById("manageValue1").value = "";
  document.getElementById("manageValue2").value = "";
}

function saveManageEdit(){
  clearMessage("manageMessage");
  if(manageEditing.type === null) return showMessage("manageMessage","一覧から編集対象を選んでください","warn");

  const kind = manageEditing.type;
  const index = manageEditing.index;
  const name = document.getElementById("manageName").value.trim();
  const value1 = num(document.getElementById("manageValue1").value);
  const value2 = document.getElementById("manageValue2").value.trim();

  if(!name) return showMessage("manageMessage","名前を入力してください","warn");

  if(kind === "hinge"){
    if(!value1) return showMessage("manageMessage","値を入力してください","warn");
    hinges[index].name = name;
    hinges[index].value = value1;
  }

  if(kind === "strike"){
    const arr = value2.split(",");
    const height = num(arr[0] || "");
    const thickness = num(arr[1] || "");
    if(!value1 || !height || !thickness) return showMessage("manageMessage","値を確認してください","warn");
    strikes[index].name = name;
    strikes[index].offset = value1;
    strikes[index].height = height;
    strikes[index].thickness = thickness;
  }

  if(kind === "flush"){
    if(!value1) return showMessage("manageMessage","値を入力してください","warn");
    flushes[index].name = name;
    flushes[index].value = value1;
  }

  saveHardware();
  loadHardwareOptions();
  refreshAllLists();
  clearManageEdit();
  showMessage("manageMessage","更新しました","ok");
  calc();
}

function deleteManaged(kind,index){
  clearMessage("manageMessage");

  if(kind === "hinge"){
    if(hinges[index].isDefault) return showMessage("manageMessage","標準は削除できません","warn");
    hinges.splice(index,1);
  }

  if(kind === "strike"){
    if(strikes[index].isDefault) return showMessage("manageMessage","標準は削除できません","warn");
    strikes.splice(index,1);
  }

  if(kind === "flush"){
    if(flushes[index].isDefault) return showMessage("manageMessage","標準は削除できません","warn");
    flushes.splice(index,1);
  }

  saveHardware();
  loadHardwareOptions();
  refreshAllLists();
  clearManageEdit();
  showMessage("manageMessage","削除しました","ok");
  calc();
}

function exportHardwareBackup(){
  const payload = {
    exportedAt: new Date().toISOString(),
    hinges,
    strikes,
    flushes
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kanamono-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  showMessage("backupMessage","バックアップを書き出しました","ok");
}

function importHardwareBackup(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);

      if(!Array.isArray(data.hinges) || !Array.isArray(data.strikes) || !Array.isArray(data.flushes)){
        throw new Error("format");
      }

      hinges = data.hinges.map(x=>({
        name:String(x.name).trim(),
        value:Number(x.value) || 0,
        isDefault:Boolean(x.isDefault)
      }));

      strikes = data.strikes.map(x=>({
        name:String(x.name).trim(),
        offset:Number(x.offset) || 0,
        height:Number(x.height) || 0,
        thickness:Number(x.thickness) || 0,
        isDefault:Boolean(x.isDefault)
      }));

      flushes = data.flushes.map(x=>({
        name:String(x.name).trim(),
        value:Number(x.value) || 0,
        isDefault:Boolean(x.isDefault)
      }));

      defaultHinges.forEach(def=>{
        if(!hinges.some(x=>x.name === def.name)) hinges.unshift(def);
      });
      defaultStrikes.forEach(def=>{
        if(!strikes.some(x=>x.name === def.name)) strikes.unshift(def);
      });
      defaultFlushes.forEach(def=>{
        if(!flushes.some(x=>x.name === def.name)) flushes.unshift(def);
      });

      saveHardware();
      loadHardwareOptions();
      refreshAllLists();
      calc();
      showMessage("backupMessage","バックアップを読み込みました","ok");
    }catch{
      showMessage("backupMessage","バックアップJSONの形式が違います","warn");
    }
  };
  reader.readAsText(file);
}

function getSelectedValues(){
  const hinge = getSelectedHinge();
  const strike = getSelectedStrike();
  const flush = getSelectedFlush();

  return {
    hingeValue: hinge ? Number(hinge.value) : 0,
    strikeOffset: strike ? Number(strike.offset) : 0,
    strikeHeight: strike ? Number(strike.height) : 0,
    strikeThickness: strike ? Number(strike.thickness) : 0,
    flushValue: flush ? Number(flush.value) : 0
  };
}

function calc(){
  const A = getVal("topMituke");
  const B = getVal("topGap");
  const I = getVal("diagramH");
  const F = getVal("bottomSill2");
  const G = getVal("bottomGap");
  const E = getVal("bottomSill1");

  const J = I + 15 - B - F - G;
  setValue("dh", J || 0);
  document.getElementById("jFormulaPreview").textContent = `J = ${I.toFixed(1)} + 15 - ${B.toFixed(1)} - ${F.toFixed(1)} - ${G.toFixed(1)} = ${J.toFixed(1)}`;

  const topBase = getVal("topBase");
  const bottomBase = getVal("bottomBase");
  const strikeBase = getVal("strikeBase");
  const frameThickness = getVal("frameThickness");
  const hingeCount = Math.floor(getVal("hingeCount"));

  const selected = getSelectedValues();

  setValue("hingeValueView", selected.hingeValue || "");
  setValue("strikeOffsetView", selected.strikeOffset || "");
  setValue("strikeHeightView", selected.strikeHeight || "");
  setValue("strikeThicknessView", selected.strikeThickness || "");
  setValue("flushValueView", selected.flushValue || "");

  const topDim = A + B + topBase + selected.hingeValue;
  const bottomDim = (E + F) + G + bottomBase - selected.hingeValue;
  const frameLength = A + B + J + G + (E + F);

  let pitch = 0;
  if(hingeCount >= 2){
    pitch = (frameLength - topDim - bottomDim) / (hingeCount - 1);
  }

  const strikePos = (E + F) + strikeBase - selected.strikeOffset;
  const strikeTop = strikePos + selected.strikeHeight;
  const strikeCenter = strikePos + selected.strikeHeight / 2;
  const spacer = selected.strikeThickness - frameThickness;

  const S = getVal("parentW");
  const T = getVal("meetingInput");
  const U = S;
  setValue("flushMirror", U || "");
  const flushPos = S + (T / 2) + selected.flushValue;

  const DW = getVal("dwInput");

  localStorage.setItem(HINGE_SELECTED_KEY, document.getElementById("hingeSelect").value);
  localStorage.setItem(STRIKE_SELECTED_KEY, document.getElementById("strikeSelect").value);
  localStorage.setItem(FLUSH_SELECTED_KEY, document.getElementById("flushSelect").value);

  let text = "";

  text += "■ 丁番\n";
  if(frameLength > 0 && topDim > 0 && bottomDim > 0 && hingeCount >= 2){
    if((frameLength - topDim - bottomDim) < 0){
      text += "※ 枠全長より上下寸法の合計が大きいです\n\n";
    }else{
      text += `上丁番: ${topDim.toFixed(1)} mm\n`;
      text += `下丁番: ${bottomDim.toFixed(1)} mm\n`;
      text += `枠全長: ${frameLength.toFixed(1)} mm\n`;
      text += `ピッチ: ${pitch.toFixed(1)} mm\n\n`;
    }
  }else{
    text += "※ A・B・I・E・F・G・基準・丁番・丁番枚数を入力してください\n\n";
  }

  text += "■ J 自動計算\n";
  text += `J = I + 15 - B - F - G = ${J.toFixed(1)} mm\n\n`;

  text += "■ ストライク\n";
  if(strikePos > 0){
    text += `下端位置: ${strikePos.toFixed(1)} mm\n`;
    text += `上端: ${strikeTop.toFixed(1)} mm\n`;
    text += `中心: ${strikeCenter.toFixed(1)} mm\n`;
    if(spacer > 0) text += `必要スペーサー: ${spacer.toFixed(1)} mm\n`;
    else if(spacer === 0) text += "必要スペーサー: 0 mm\n";
    else text += "必要スペーサー: 不要\n";
    text += "\n";
  }else{
    text += "※ E・F・ストライク基準・ストライク種類を確認してください\n\n";
  }

  text += "■ フランス落とし\n";
  if(flushPos > 0){
    text += `親W: ${S.toFixed(1)} mm\n`;
    text += `召合わせ/2: ${(T/2).toFixed(1)} mm\n`;
    text += `U=S: ${U.toFixed(1)} mm\n`;
    text += `金物寸法: ${selected.flushValue.toFixed(1)} mm\n`;
    text += `位置: ${flushPos.toFixed(1)} mm\n\n`;
  }else{
    text += "※ S・T・フランス落とし種類を確認してください\n\n";
  }

  text += "■ DW\n";
  if(DW > 0) text += `DW: ${DW.toFixed(1)} mm\n`;
  else text += "※ DWを入力してください\n";

  document.getElementById("resultText").textContent = text;

  const quick = [];
  if(topDim > 0) quick.push("上丁番 " + topDim.toFixed(1));
  if(bottomDim > 0) quick.push("下丁番 " + bottomDim.toFixed(1));
  if(strikePos > 0) quick.push("ストライク " + strikePos.toFixed(1));
  if(flushPos > 0) quick.push("フランス " + flushPos.toFixed(1));
  if(DW > 0) quick.push("DW " + DW.toFixed(1));

  document.getElementById("quickResult").textContent = quick.length ? quick.join(" / ") + " mm" : "未入力";
}

function bindOverlayInputs(){
  document.querySelectorAll(".overlay-input").forEach(input=>{
    input.addEventListener("input", e=>{
      if(layoutEditMode) return;
      e.target.value = normalizeNumberInputValue(e.target.value);

      if(e.target.id === "parentW"){
        setValue("flushMirror", getVal("parentW") || "");
      }

      calc();
    });

    input.addEventListener("focus", ()=>{
      if(layoutEditMode) return;
      if(typeof input.select === "function") input.select();
    });
  });
}

function bindGeneralInputs(){
  ["topBase","bottomBase","strikeBase","frameThickness","hingeCount","newHingeValue","newStrikeOffset","newStrikeHeight","newStrikeThickness","newFlushValue","manageValue1"].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener("input", e=>{
      e.target.value = normalizeNumberInputValue(e.target.value);
      calc();
    });
  });

  ["hingeSelect","strikeSelect","flushSelect"].forEach(id=>{
    document.getElementById(id).addEventListener("change", calc);
  });
}

function bindTabs(){
  document.querySelectorAll("[data-main-tab]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll("[data-main-tab]").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`panel-${btn.dataset.mainTab}`).classList.add("active");
      setTimeout(fitAllDiagramCanvases, 0);
    });
  });

  document.querySelectorAll("[data-diagram-tab]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll("[data-diagram-tab]").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".diagram-panel").forEach(p=>p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`diagram-${btn.dataset.diagramTab}`).classList.add("active");
      setTimeout(fitAllDiagramCanvases, 0);
    });
  });
}

function bindLayoutEditor(){
  applyLayoutPositions();
  populateLayoutItemSelect();
  loadLabelEditorFromSelection();

  document.getElementById("toggleLayoutEditBtn").addEventListener("click", ()=>{
    setLayoutEditMode(!layoutEditMode);
  });
  document.getElementById("resetLayoutBtn").addEventListener("click", resetLayoutPositions);
  document.getElementById("exportLayoutBtn").addEventListener("click", exportLayoutPositions);
  document.getElementById("saveLabelBtn").addEventListener("click", saveLabelNameFromEditor);
  document.getElementById("layoutItemSelect").addEventListener("change", loadLabelEditorFromSelection);

  document.addEventListener("mousedown", startDragBox);
  document.addEventListener("touchstart", startDragBox, {passive:false});
  document.addEventListener("mousemove", moveDragBox, {passive:false});
  document.addEventListener("touchmove", moveDragBox, {passive:false});
  document.addEventListener("mouseup", endDragBox);
  document.addEventListener("touchend", endDragBox);
}

function bindHardwareButtons(){
  document.getElementById("addHingeBtn").addEventListener("click", addHinge);
  document.getElementById("addStrikeBtn").addEventListener("click", addStrike);
  document.getElementById("addFlushBtn").addEventListener("click", addFlush);

  document.getElementById("manageSaveBtn").addEventListener("click", saveManageEdit);
  document.getElementById("manageCancelBtn").addEventListener("click", ()=>{
    clearManageEdit();
    clearMessage("manageMessage");
  });

  document.getElementById("backupExportBtn").addEventListener("click", exportHardwareBackup);
  document.getElementById("backupImportFile").addEventListener("change", (e)=>{
    importHardwareBackup(e.target.files[0]);
    e.target.value = "";
  });

  document.addEventListener("click", e=>{
    const btn = e.target.closest("button[data-action]");
    if(!btn) return;

    const kind = btn.dataset.kind;
    const index = Number(btn.dataset.index);
    const action = btn.dataset.action;

    if(action === "edit") startManageEdit(kind, index);
    if(action === "delete") deleteManaged(kind, index);
  });
}

function initDefaults(){
  if(!getVal("topBase")) setValue("topBase", 150);
  if(!getVal("bottomBase")) setValue("bottomBase", 150);
  if(!getVal("hingeCount")) setValue("hingeCount", 2);
}

function init(){
  bindTabs();
  bindOverlayInputs();
  bindGeneralInputs();
  bindLayoutEditor();
  bindHardwareButtons();
  initDefaults();

  loadHardware();
  loadHardwareOptions();
  refreshAllLists();
  applyLayoutPositions();
  fitAllDiagramCanvases();
  calc();
}

window.addEventListener("resize", fitAllDiagramCanvases);
window.addEventListener("load", fitAllDiagramCanvases);
document.addEventListener("DOMContentLoaded", init);
