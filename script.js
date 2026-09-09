const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const clearAllBtn = document.getElementById("clear-all");
const STORAGE_KEY = "unutma-todos";

function saveTodos() {
  const todos = [...list.querySelectorAll("li")].map((li) => {
    const textEl = li.querySelector(".todo-text") || li.querySelector(".edit-input");
    return {
      text: textEl.value ?? textEl.textContent,
      done: li.querySelector('input[type="checkbox"]').checked,
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function createTodoItem(text, done = false) {
  const li = document.createElement("li");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = done;

  const span = document.createElement("span");
  span.className = "todo-text";
  span.textContent = text;
  if (done) span.classList.add("done");

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
    saveTodos();
  });

  editBtn.addEventListener("click", () => {
    if (editing) {
      const editInput = li.querySelector(".edit-input");
      const trimmed = editInput.value.trim();
      if (trimmed) span.textContent = trimmed;
      editInput.replaceWith(span);
      editBtn.textContent = "Düzenle";
      editing = false;
      saveTodos();
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
    saveTodos();
  });

  li.append(checkbox, span, editBtn, deleteBtn);
  return li;
}

function loadTodos() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const todos = JSON.parse(saved);
    todos.forEach(({ text, done }) => {
      list.appendChild(createTodoItem(text, done));
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

clearAllBtn.addEventListener("click", () => {
  list.innerHTML = "";
  saveTodos();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  list.appendChild(createTodoItem(text));
  saveTodos();
  input.value = "";
  input.focus();
});

loadTodos();
