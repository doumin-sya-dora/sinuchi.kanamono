let editMode = false;
let drag = null;

const btn = document.getElementById("toggleLayoutEditBtn");

btn.onclick = () => {
  editMode = !editMode;
  document.body.classList.toggle("layout-edit-on", editMode);
  btn.textContent = "配置調整モード: " + (editMode ? "ON" : "OFF");
};

document.addEventListener("mousedown", e => {
  if (!editMode) return;

  const target = e.target.closest(".overlay-input");
  if (!target) return;

  drag = {
    el: target,
    startX: e.clientX,
    startY: e.clientY,
    left: parseInt(target.style.left),
    top: parseInt(target.style.top)
  };
});

document.addEventListener("mousemove", e => {
  if (!drag) return;

  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;

  drag.el.style.left = drag.left + dx + "px";
  drag.el.style.top = drag.top + dy + "px";
});

document.addEventListener("mouseup", () => {
  drag = null;
});
