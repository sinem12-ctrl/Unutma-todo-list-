const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const clearAllBtn = document.getElementById("clear-all");

clearAllBtn.addEventListener("click", () => {
  list.innerHTML = "";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  const li = document.createElement("li");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";

  const span = document.createElement("span");
  span.className = "todo-text";
  span.textContent = text;

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "edit-btn";
  editBtn.textContent = "Düzenle";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Sil";

  let editing = false;

  checkbox.addEventListener("change", () => {
    span.classList.toggle("done", checkbox.checked);
  });

  editBtn.addEventListener("click", () => {
    if (editing) {
      const editInput = li.querySelector(".edit-input");
      const trimmed = editInput.value.trim();
      if (trimmed) span.textContent = trimmed;
      editInput.replaceWith(span);
      editBtn.textContent = "Düzenle";
      editing = false;
      return;
    }

    editing = true;
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "edit-input";
    editInput.value = span.textContent;

    span.replaceWith(editInput);
    editBtn.textContent = "Kaydet";
    editInput.focus();
    editInput.select();

    editInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        editBtn.click();
      }
      if (event.key === "Escape") {
        editInput.replaceWith(span);
        editBtn.textContent = "Düzenle";
        editing = false;
      }
    });
  });

  deleteBtn.addEventListener("click", () => {
    li.remove();
  });

  li.append(checkbox, span, editBtn, deleteBtn);
  list.appendChild(li);
  input.value = "";
  input.focus();
});
