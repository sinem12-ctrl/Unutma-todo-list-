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
