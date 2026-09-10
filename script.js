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

const LONG_BREAK_SECONDS = 30 * 60;
const RING_LENGTH = 2 * Math.PI * 52;

const pomodoro = document.getElementById("pomodoro");
const pomodoroTime = document.getElementById("pomodoro-time");
const pomodoroBadge = document.getElementById("pomodoro-badge");
const pomodoroProgress = document.getElementById("pomodoro-progress");
const pomodoroStart = document.getElementById("pomodoro-start");
const pomodoroPause = document.getElementById("pomodoro-pause");
const pomodoroReset = document.getElementById("pomodoro-reset");
const pomodoroModes = document.querySelectorAll(".pomodoro-mode");
const pomodoroMinutesInput = document.getElementById("pomodoro-minutes");
const pomodoroMinus = document.getElementById("pomodoro-minus");
const pomodoroPlus = document.getElementById("pomodoro-plus");
const breakMinutesInput = document.getElementById("break-minutes");
const breakMinus = document.getElementById("break-minus");
const breakPlus = document.getElementById("break-plus");
const pomodoroFocusBtn = document.querySelector('.pomodoro-mode[data-mode="focus"]');
const pomodoroBreakBtn = document.querySelector('.pomodoro-mode[data-mode="break"]');
const pomodoroDots = [...document.querySelectorAll(".pomodoro-dot")];

let focusMinutes = 25;
let breakMinutes = 5;
let completedPomodoros = 0;
let pomodoroMode = "focus";
let pomodoroSeconds = focusMinutes * 60;
let pomodoroRunning = false;
let pomodoroTimer = null;
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function playTone(frequency, startAt, duration, type = "sine", gainValue = 0.12) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startAt);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + startAt + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(ctx.currentTime + startAt);
  oscillator.stop(ctx.currentTime + startAt + duration + 0.02);
}

function playPomodoroEndSound() {
  playTone(392, 0, 0.28, "triangle", 0.14);
  playTone(311, 0.22, 0.45, "triangle", 0.12);
}

function playPomodoroStartSound() {
  playTone(523, 0, 0.18, "sine", 0.11);
  playTone(659, 0.14, 0.18, "sine", 0.11);
  playTone(784, 0.28, 0.32, "sine", 0.13);
}

function formatPomodoro(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function pomodoroDuration() {
  if (pomodoroMode === "focus") return focusMinutes * 60;
  if (pomodoroMode === "long-break") return LONG_BREAK_SECONDS;
  return breakMinutes * 60;
}

function clampMinutes(value, fallback, max) {
  const minutes = Number.parseInt(value, 10);
  if (Number.isNaN(minutes)) return fallback;
  return Math.min(max, Math.max(1, minutes));
}

function applyFocusMinutes(nextMinutes, resetTimer = true) {
  focusMinutes = clampMinutes(nextMinutes, 25, 120);
  pomodoroMinutesInput.value = String(focusMinutes);
  pomodoroFocusBtn.textContent = `${focusMinutes} dk`;
  if (resetTimer && pomodoroMode === "focus") {
    pomodoroRunning = false;
    clearInterval(pomodoroTimer);
    pomodoroSeconds = pomodoroDuration();
  }
  renderPomodoro();
}

function applyBreakMinutes(nextMinutes, resetTimer = true) {
  breakMinutes = clampMinutes(nextMinutes, 5, 60);
  breakMinutesInput.value = String(breakMinutes);
  if (resetTimer && pomodoroMode === "break") {
    pomodoroRunning = false;
    clearInterval(pomodoroTimer);
    pomodoroSeconds = pomodoroDuration();
  }
  renderPomodoro();
}

function renderPomodoro() {
  pomodoroTime.textContent = formatPomodoro(pomodoroSeconds);
  const badges = {
    focus: "Odak",
    break: "Mola",
    "long-break": "Büyük ara",
  };
  pomodoroBadge.textContent = badges[pomodoroMode];
  pomodoro.classList.toggle("is-break", pomodoroMode === "break");
  pomodoro.classList.toggle("is-long-break", pomodoroMode === "long-break");
  pomodoroBreakBtn.textContent = pomodoroMode === "long-break" ? "30 dk" : `${breakMinutes} dk`;
  pomodoroModes.forEach((btn) => {
    const isBreakMode = pomodoroMode === "break" || pomodoroMode === "long-break";
    btn.classList.toggle(
      "is-active",
      btn.dataset.mode === "focus" ? pomodoroMode === "focus" : isBreakMode
    );
  });
  pomodoroDots.forEach((dot, index) => {
    dot.classList.toggle("is-filled", index < completedPomodoros);
  });
  pomodoroProgress.style.strokeDasharray = String(RING_LENGTH);
  pomodoroProgress.style.strokeDashoffset = String(
    (1 - pomodoroSeconds / pomodoroDuration()) * RING_LENGTH
  );
  pomodoroStart.disabled = pomodoroRunning;
  pomodoroPause.disabled = !pomodoroRunning;
}

function notifyPomodoro(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
    return;
  }
  if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") new Notification(title, { body });
    });
  }
}

function switchPomodoroMode() {
  if (pomodoroMode === "focus") {
    playPomodoroEndSound();
    completedPomodoros += 1;
    if (completedPomodoros >= 4) {
      pomodoroMode = "long-break";
      notifyPomodoro("4 pomodoro tamamlandı", "30 dakikalık büyük molaya geçildi.");
    } else {
      pomodoroMode = "break";
      notifyPomodoro("Odak süresi bitti", `${breakMinutes} dakikalık molaya geçildi.`);
    }
  } else {
    if (pomodoroMode === "long-break") completedPomodoros = 0;
    pomodoroMode = "focus";
    playPomodoroStartSound();
    notifyPomodoro("Mola bitti", `${focusMinutes} dakikalık odaklanmaya geçildi.`);
  }
  pomodoroSeconds = pomodoroDuration();
  renderPomodoro();
}

function tickPomodoro() {
  if (pomodoroSeconds <= 1) {
    pomodoroSeconds = 0;
    renderPomodoro();
    switchPomodoroMode();
    return;
  }
  pomodoroSeconds -= 1;
  renderPomodoro();
}

pomodoroStart.addEventListener("click", () => {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  if (pomodoroRunning) return;
  const isFreshFocus = pomodoroMode === "focus" && pomodoroSeconds === pomodoroDuration();
  pomodoroRunning = true;
  pomodoroTimer = setInterval(tickPomodoro, 1000);
  if (isFreshFocus) playPomodoroStartSound();
  renderPomodoro();
});

pomodoroPause.addEventListener("click", () => {
  pomodoroRunning = false;
  clearInterval(pomodoroTimer);
  renderPomodoro();
});

pomodoroReset.addEventListener("click", () => {
  pomodoroRunning = false;
  clearInterval(pomodoroTimer);
  pomodoroSeconds = pomodoroDuration();
  renderPomodoro();
});

pomodoroModes.forEach((btn) => {
  btn.addEventListener("click", () => {
    pomodoroRunning = false;
    clearInterval(pomodoroTimer);
    pomodoroMode = btn.dataset.mode;
    pomodoroSeconds = pomodoroDuration();
    renderPomodoro();
  });
});

pomodoroMinus.addEventListener("click", () => {
  applyFocusMinutes(focusMinutes - 1);
});

pomodoroPlus.addEventListener("click", () => {
  applyFocusMinutes(focusMinutes + 1);
});

pomodoroMinutesInput.addEventListener("change", () => {
  applyFocusMinutes(pomodoroMinutesInput.value);
});

breakMinus.addEventListener("click", () => {
  applyBreakMinutes(breakMinutes - 1);
});

breakPlus.addEventListener("click", () => {
  applyBreakMinutes(breakMinutes + 1);
});

breakMinutesInput.addEventListener("change", () => {
  applyBreakMinutes(breakMinutesInput.value);
});

renderPomodoro();

const mainEl = document.querySelector("main");
const viewTabs = document.querySelectorAll(".view-tab");
const viewPanels = document.querySelectorAll(".view-panel");
const CAL_STORAGE_KEY = "unutma-calendar-tasks";
const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const calTitle = document.getElementById("cal-title");
const calGrid = document.getElementById("cal-grid");
const calDayLabel = document.getElementById("cal-day-label");
const calForm = document.getElementById("cal-form");
const calInput = document.getElementById("cal-input");
const calAdd = document.getElementById("cal-add");
const calTasks = document.getElementById("cal-tasks");
const calPrev = document.getElementById("cal-prev");
const calNext = document.getElementById("cal-next");

const today = new Date();
let calYear = today.getFullYear();
let calMonth = today.getMonth();
let selectedDateKey = null;
let calendarTasks = {};

function toDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateLabel(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function loadCalendarTasks() {
  try {
    const saved = localStorage.getItem(CAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    localStorage.removeItem(CAL_STORAGE_KEY);
    return {};
  }
}

function saveCalendarTasks() {
  localStorage.setItem(CAL_STORAGE_KEY, JSON.stringify(calendarTasks));
}

selectedDateKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
calendarTasks = loadCalendarTasks();

function switchView(viewName) {
  viewTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === viewName);
  });
  viewPanels.forEach((panel) => {
    const active = panel.dataset.view === viewName;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  mainEl.classList.toggle("is-calendar", viewName === "calendar");
  mainEl.classList.toggle("is-kanban", viewName === "kanban");
  if (viewName === "calendar") renderCalendar();
  if (viewName === "kanban") renderKanban();
}

viewTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

function renderCalendar() {
  calTitle.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;
  calGrid.innerHTML = "";

  const firstDay = new Date(calYear, calMonth, 1);
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

  for (let i = 0; i < 42; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-cell";

    let cellYear = calYear;
    let cellMonth = calMonth;
    let cellDay;

    if (i < startWeekday) {
      cellDay = prevMonthDays - startWeekday + i + 1;
      cellMonth = calMonth - 1;
      if (cellMonth < 0) {
        cellMonth = 11;
        cellYear -= 1;
      }
      cell.classList.add("is-muted");
    } else if (i >= startWeekday + daysInMonth) {
      cellDay = i - startWeekday - daysInMonth + 1;
      cellMonth = calMonth + 1;
      if (cellMonth > 11) {
        cellMonth = 0;
        cellYear += 1;
      }
      cell.classList.add("is-muted");
    } else {
      cellDay = i - startWeekday + 1;
    }

    const key = toDateKey(cellYear, cellMonth, cellDay);
    const daySpan = document.createElement("span");
    daySpan.className = "cal-cell-day";
    daySpan.textContent = String(cellDay);
    cell.appendChild(daySpan);

    if (
      cellYear === today.getFullYear() &&
      cellMonth === today.getMonth() &&
      cellDay === today.getDate()
    ) {
      cell.classList.add("is-today");
    }
    if (key === selectedDateKey) cell.classList.add("is-selected");

    const tasks = calendarTasks[key] || [];
    if (tasks.length) {
      const list = document.createElement("div");
      list.className = "cal-cell-tasks";
      tasks.slice(0, 3).forEach((task) => {
        const item = document.createElement("span");
        item.className = `cal-cell-task${task.done ? " is-done" : ""}`;
        item.textContent = task.text;
        list.appendChild(item);
      });
      if (tasks.length > 3) {
        const more = document.createElement("span");
        more.className = "cal-cell-more";
        more.textContent = `+${tasks.length - 3}`;
        list.appendChild(more);
      }
      cell.appendChild(list);
    }

    cell.addEventListener("click", () => {
      selectedDateKey = key;
      renderCalendar();
      renderSelectedDay();
    });

    calGrid.appendChild(cell);
  }

  renderSelectedDay();
}

function renderSelectedDay() {
  if (!selectedDateKey) {
    calDayLabel.textContent = "Tarih seç";
    calInput.disabled = true;
    calAdd.disabled = true;
    calTasks.innerHTML = "";
    return;
  }

  calDayLabel.textContent = formatDateLabel(selectedDateKey);
  calInput.disabled = false;
  calAdd.disabled = false;
  calTasks.innerHTML = "";

  const tasks = calendarTasks[selectedDateKey] || [];
  tasks.forEach((task) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `cal-task${task.done ? " is-done" : ""}`;
    btn.textContent = task.text;
    btn.addEventListener("click", () => {
      task.done = !task.done;
      saveCalendarTasks();
      renderCalendar();
    });
    calTasks.appendChild(btn);
  });
}

calPrev.addEventListener("click", () => {
  calMonth -= 1;
  if (calMonth < 0) {
    calMonth = 11;
    calYear -= 1;
  }
  renderCalendar();
});

calNext.addEventListener("click", () => {
  calMonth += 1;
  if (calMonth > 11) {
    calMonth = 0;
    calYear += 1;
  }
  renderCalendar();
});

calForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedDateKey) return;
  const text = calInput.value.trim();
  if (!text) return;

  if (!calendarTasks[selectedDateKey]) calendarTasks[selectedDateKey] = [];
  calendarTasks[selectedDateKey].push({
    id: Date.now().toString(),
    text,
    done: false,
  });
  saveCalendarTasks();
  calInput.value = "";
  renderCalendar();
});

const KANBAN_STORAGE_KEY = "unutma-kanban-tasks";
const KANBAN_COLUMNS = ["todo", "doing", "done"];
const KANBAN_LABELS = {
  todo: "Yapılacak",
  doing: "Yapıyorum",
  done: "Yaptım",
};

const kanbanForm = document.getElementById("kanban-form");
const kanbanInput = document.getElementById("kanban-input");
const kanbanLists = {
  todo: document.getElementById("kanban-todo"),
  doing: document.getElementById("kanban-doing"),
  done: document.getElementById("kanban-done"),
};
const kanbanCounts = {
  todo: document.getElementById("kanban-count-todo"),
  doing: document.getElementById("kanban-count-doing"),
  done: document.getElementById("kanban-count-done"),
};

function loadKanbanTasks() {
  try {
    const saved = localStorage.getItem(KANBAN_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(KANBAN_STORAGE_KEY);
    return [];
  }
}

function saveKanbanTasks() {
  localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(kanbanTasks));
}

let kanbanTasks = loadKanbanTasks();

function moveKanbanTask(id, targetColumn) {
  const task = kanbanTasks.find((item) => item.id === id);
  if (!task || task.column === targetColumn) return;
  task.column = targetColumn;
  saveKanbanTasks();
  renderKanban();
}

function deleteKanbanTask(id) {
  kanbanTasks = kanbanTasks.filter((item) => item.id !== id);
  saveKanbanTasks();
  renderKanban();
}

function createKanbanCard(task) {
  const card = document.createElement("article");
  card.className = "kanban-card";
  card.draggable = true;
  card.dataset.id = task.id;

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("is-dragging");
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("is-dragging");
    document.querySelectorAll(".kanban-column.is-drop-target").forEach((col) => {
      col.classList.remove("is-drop-target");
    });
  });

  const text = document.createElement("span");
  text.className = "kanban-card-text";
  text.textContent = task.text;

  const actions = document.createElement("div");
  actions.className = "kanban-card-actions";

  KANBAN_COLUMNS.filter((column) => column !== task.column).forEach((column) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kanban-move";
    btn.textContent = KANBAN_LABELS[column];
    btn.addEventListener("click", () => moveKanbanTask(task.id, column));
    actions.appendChild(btn);
  });

  const del = document.createElement("button");
  del.type = "button";
  del.className = "kanban-delete";
  del.textContent = "Sil";
  del.addEventListener("click", () => deleteKanbanTask(task.id));
  actions.appendChild(del);

  card.append(text, actions);
  return card;
}

function setupKanbanDropZones() {
  document.querySelectorAll(".kanban-column").forEach((columnEl) => {
    const column = columnEl.dataset.column;

    columnEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      columnEl.classList.add("is-drop-target");
    });

    columnEl.addEventListener("dragleave", (e) => {
      if (!columnEl.contains(e.relatedTarget)) {
        columnEl.classList.remove("is-drop-target");
      }
    });

    columnEl.addEventListener("drop", (e) => {
      e.preventDefault();
      columnEl.classList.remove("is-drop-target");
      const id = e.dataTransfer.getData("text/plain");
      if (id) moveKanbanTask(id, column);
    });
  });
}

setupKanbanDropZones();

function renderKanban() {
  KANBAN_COLUMNS.forEach((column) => {
    kanbanLists[column].innerHTML = "";
    const items = kanbanTasks.filter((task) => task.column === column);
    kanbanCounts[column].textContent = String(items.length);
    items.forEach((task) => {
      kanbanLists[column].appendChild(createKanbanCard(task));
    });
  });
}

kanbanForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = kanbanInput.value.trim();
  if (!text) return;

  kanbanTasks.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    column: "todo",
  });
  saveKanbanTasks();
  kanbanInput.value = "";
  renderKanban();
});
