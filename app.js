const $ = (id) => document.getElementById(id);

const DEFAULT_ROUTINES = [
  {
    id: crypto.randomUUID(),
    name: "Tuesday Pull",
    exercises: [
      "Upper Body Stretch", "Neutral Pull Up", "Lat Pulldown",
      "Cable Crunch", "Bent Over Dumbbell Row", "Dead Bugs", "Dumbbell Curl"
    ]
  },
  {
    id: crypto.randomUUID(),
    name: "Thursday Legs",
    exercises: [
      "Lower Body Stretches", "Leg Extension Machine", "Hamstring Curl",
      "Barbell Squat", "Step Ups", "Standing Calf Raise", "Reverse Crunch"
    ]
  },
  {
    id: crypto.randomUUID(),
    name: "Sunday Upper Body",
    exercises: [
      "Upper Body Stretch", "Neutral Pull Up", "Wide Pull Up",
      "Seated Bench Press", "Pectoral Fly", "Bent Over Dumbbell Row",
      "Hanging Knee Raise", "Dumbbell Curl", "Hammercurl to Press", "Tricep Pushdown"
    ]
  }
];

const state = {
  routines: load("routines", DEFAULT_ROUTINES),
  history: load("history", []),
  current: null
};

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem("ironNotes_" + key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function save() {
  localStorage.setItem("ironNotes_routines", JSON.stringify(state.routines));
  localStorage.setItem("ironNotes_history", JSON.stringify(state.history));
}
function todayText() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "history") renderHistory();
      if (btn.dataset.tab === "progress") renderProgress();
      if (btn.dataset.tab === "settings") renderRoutineEditor();
    });
  });
}

function renderRoutineSelect() {
  $("routineSelect").innerHTML = state.routines
    .map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
}

function loadRoutine(id) {
  const routine = state.routines.find(r => r.id === id);
  if (!routine) return;
  state.current = {
    id: crypto.randomUUID(),
    routineId: routine.id,
    name: routine.name,
    date: new Date().toISOString(),
    exercises: routine.exercises.map(name => ({
      id: crypto.randomUUID(),
      name,
      sets: createDefaultSets(name)
    }))
  };
  renderWorkout();
}

function createDefaultSets(name) {
  const timed = /stretch/i.test(name);
  const bodyweight = /pull up|dead bug|crunch|raise|dip/i.test(name);
  const count = timed ? 1 : 3;
  return Array.from({ length: count }, () => ({
    weight: bodyweight || timed ? "" : "",
    reps: timed ? "" : ""
  }));
}

function renderWorkout() {
  $("workoutDate").textContent = todayText();
  if (!state.current) {
    $("workoutTitle").textContent = "Today’s Workout";
    $("exerciseList").innerHTML = `<p class="small">Pick a routine and tap Load. The iron awaits.</p>`;
    return;
  }
  $("workoutTitle").textContent = state.current.name;
  $("exerciseList").innerHTML = state.current.exercises.map((ex, exIndex) => {
    const suggestion = getSuggestion(ex.name);
    return `<div class="exercise" data-ex="${exIndex}">
      <div class="exercise-head">
        <h3>${escapeHtml(ex.name)}</h3>
        <button class="icon-btn remove-ex" data-index="${exIndex}" title="Remove">✕</button>
      </div>
      ${suggestion ? `<p class="suggestion">${escapeHtml(suggestion)}</p>` : ""}
      <div>
        ${ex.sets.map((set, setIndex) => `
          <div class="set-row">
            <div class="set-label">${setIndex + 1}</div>
            <input inputmode="decimal" placeholder="Weight" value="${escapeHtml(set.weight)}"
              data-field="weight" data-ex="${exIndex}" data-set="${setIndex}" />
            <input inputmode="numeric" placeholder="Reps / time" value="${escapeHtml(set.reps)}"
              data-field="reps" data-ex="${exIndex}" data-set="${setIndex}" />
            <button class="icon-btn remove-set" data-ex="${exIndex}" data-set="${setIndex}">−</button>
          </div>`).join("")}
      </div>
      <button class="secondary add-set" data-ex="${exIndex}">+ Set</button>
    </div>`;
  }).join("");

  document.querySelectorAll("input[data-field]").forEach(input => {
    input.addEventListener("input", (e) => {
      const ex = state.current.exercises[Number(e.target.dataset.ex)];
      const set = ex.sets[Number(e.target.dataset.set)];
      set[e.target.dataset.field] = e.target.value;
    });
  });
  document.querySelectorAll(".add-set").forEach(btn => {
    btn.addEventListener("click", () => {
      state.current.exercises[Number(btn.dataset.ex)].sets.push({ weight: "", reps: "" });
      renderWorkout();
    });
  });
  document.querySelectorAll(".remove-set").forEach(btn => {
    btn.addEventListener("click", () => {
      const sets = state.current.exercises[Number(btn.dataset.ex)].sets;
      if (sets.length > 1) sets.splice(Number(btn.dataset.set), 1);
      renderWorkout();
    });
  });
  document.querySelectorAll(".remove-ex").forEach(btn => {
    btn.addEventListener("click", () => {
      state.current.exercises.splice(Number(btn.dataset.index), 1);
      renderWorkout();
    });
  });
}

function getSuggestion(name) {
  const past = state.history
    .flatMap(w => w.exercises.map(ex => ({...ex, date: w.date})))
    .filter(ex => ex.name.toLowerCase() === name.toLowerCase())
    .sort((a,b) => new Date(b.date) - new Date(a.date))[0];

  if (!past) return "";
  const valid = past.sets.filter(s => Number(s.reps) > 0);
  if (!valid.length) return "";

  const allHit12 = valid.length >= 2 && valid.every(s => Number(s.reps) >= 12);
  const maxWeight = Math.max(...valid.map(s => Number(s.weight) || 0));
  if (allHit12 && maxWeight > 0) {
    return `Last time was strong. Try ${roundToHalf(maxWeight + 5)} lb, or beat your total reps.`;
  }
  const total = valid.reduce((sum, s) => sum + Number(s.reps), 0);
  return `Last time: ${valid.length} sets, ${total} total reps${maxWeight ? `, up to ${maxWeight} lb` : ""}.`;
}
function roundToHalf(n) { return Math.round(n * 2) / 2; }

function finishWorkout() {
  if (!state.current) return alert("Load a routine first.");
  const hasData = state.current.exercises.some(ex =>
    ex.sets.some(s => String(s.reps).trim() || String(s.weight).trim())
  );
  if (!hasData) return alert("Log at least one set before finishing.");
  state.history.unshift(structuredClone(state.current));
  save();
  alert("Workout saved. Tiny digital applause has been deployed.");
  state.current = null;
  renderWorkout();
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    $("historyList").innerHTML = `<p class="small">No saved workouts yet.</p>`;
    return;
  }
  $("historyList").innerHTML = state.history.map(w => `
    <details class="history-item">
      <summary>${escapeHtml(w.name)}</summary>
      <div class="history-meta">${new Date(w.date).toLocaleString()}</div>
      ${w.exercises.map(ex => {
        const logged = ex.sets.filter(s => String(s.reps).trim() || String(s.weight).trim());
        if (!logged.length) return "";
        return `<p><strong>${escapeHtml(ex.name)}</strong><br>
          ${logged.map((s,i) => `Set ${i+1}: ${escapeHtml(s.weight || "BW")} × ${escapeHtml(s.reps || "—")}`).join("<br>")}
        </p>`;
      }).join("")}
    </details>
  `).join("");
}

function allExerciseNames() {
  return [...new Set(state.history.flatMap(w => w.exercises.map(e => e.name)))].sort();
}

function renderProgress() {
  const names = allExerciseNames();
  $("progressExercise").innerHTML = names.length
    ? names.map(n => `<option>${escapeHtml(n)}</option>`).join("")
    : `<option>No data yet</option>`;
  renderProgressDetails();
}
$("progressExercise").addEventListener("change", renderProgressDetails);

function renderProgressDetails() {
  const name = $("progressExercise").value;
  const points = state.history
    .slice().reverse()
    .map(w => {
      const ex = w.exercises.find(e => e.name === name);
      if (!ex) return null;
      const valid = ex.sets.filter(s => Number(s.reps) > 0);
      if (!valid.length) return null;
      const maxWeight = Math.max(...valid.map(s => Number(s.weight) || 0));
      const totalReps = valid.reduce((a,s) => a + Number(s.reps), 0);
      const volume = valid.reduce((a,s) => a + (Number(s.weight)||0) * Number(s.reps), 0);
      return { date: new Date(w.date), maxWeight, totalReps, volume };
    }).filter(Boolean);

  if (!points.length) {
    $("progressSummary").innerHTML = `<p class="small">Finish a workout to unlock progress tracking.</p>`;
    drawChart([]);
    return;
  }
  const latest = points.at(-1);
  const bestWeight = Math.max(...points.map(p => p.maxWeight));
  const bestVolume = Math.max(...points.map(p => p.volume));
  $("progressSummary").innerHTML = `
    <div class="metric"><strong>${latest.maxWeight || "BW"}</strong><span>Latest max weight</span></div>
    <div class="metric"><strong>${bestWeight || "BW"}</strong><span>Best weight</span></div>
    <div class="metric"><strong>${Math.round(bestVolume)}</strong><span>Best volume</span></div>
  `;
  drawChart(points);
}

function drawChart(points) {
  const canvas = $("progressChart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  if (!points.length) return;

  const pad = 45;
  const values = points.map(p => p.maxWeight || p.totalReps);
  const max = Math.max(...values, 1);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 20);
  ctx.lineTo(pad, canvas.height-pad);
  ctx.lineTo(canvas.width-20, canvas.height-pad);
  ctx.stroke();

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((p,i) => {
    const x = pad + i * ((canvas.width-pad-25) / Math.max(points.length-1, 1));
    const y = canvas.height-pad - (values[i] / max) * (canvas.height-pad-35);
    if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.font = "14px system-ui";
  ctx.fillText(`Max: ${max}`, 6, 28);
  ctx.fillText(points.at(-1).date.toLocaleDateString(), canvas.width-120, canvas.height-12);
}

function renderRoutineEditor() {
  $("routineEditor").innerHTML = state.routines.map((r, i) => `
    <div class="routine-item">
      <div class="row space-between">
        <div>
          <strong>${escapeHtml(r.name)}</strong>
          <div class="small">${r.exercises.length} exercises</div>
        </div>
        <button class="danger delete-routine" data-index="${i}">Delete</button>
      </div>
    </div>`).join("");
  document.querySelectorAll(".delete-routine").forEach(btn => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this routine?")) {
        state.routines.splice(Number(btn.dataset.index), 1);
        save();
        renderRoutineEditor();
        renderRoutineSelect();
      }
    });
  });
}

function addExercise() {
  $("exerciseName").value = "";
  $("exerciseSets").value = 3;
  $("exerciseDialog").showModal();
}
$("exerciseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!$("exerciseName").value.trim()) return;
  if (!state.current) {
    state.current = {
      id: crypto.randomUUID(), routineId: null, name: "Custom Workout",
      date: new Date().toISOString(), exercises: []
    };
  }
  state.current.exercises.push({
    id: crypto.randomUUID(),
    name: $("exerciseName").value.trim(),
    sets: Array.from({length: Number($("exerciseSets").value)}, () => ({weight:"", reps:""}))
  });
  $("exerciseDialog").close();
  renderWorkout();
});

$("newRoutineBtn").addEventListener("click", () => {
  $("routineName").value = "";
  $("routineExercises").value = "";
  $("routineDialog").showModal();
});
$("routineForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("routineName").value.trim();
  const exercises = $("routineExercises").value.split("\n").map(x => x.trim()).filter(Boolean);
  if (!name || !exercises.length) return;
  state.routines.push({ id: crypto.randomUUID(), name, exercises });
  save();
  $("routineDialog").close();
  renderRoutineEditor();
  renderRoutineSelect();
});

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({routines: state.routines, history: state.history}, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `iron-notes-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$("importInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.routines) || !Array.isArray(data.history)) throw new Error();
    state.routines = data.routines;
    state.history = data.history;
    save();
    renderRoutineSelect();
    renderHistory();
    renderProgress();
    alert("Backup imported.");
  } catch {
    alert("That backup file does not look valid.");
  }
});
$("resetBtn").addEventListener("click", () => {
  if (!confirm("Delete all routines and workout history?")) return;
  localStorage.removeItem("ironNotes_routines");
  localStorage.removeItem("ironNotes_history");
  location.reload();
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  })[c]);
}

$("loadRoutineBtn").addEventListener("click", () => loadRoutine($("routineSelect").value));
$("addExerciseBtn").addEventListener("click", addExercise);
$("finishWorkoutBtn").addEventListener("click", finishWorkout);

let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("installBtn").classList.remove("hidden");
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

setupTabs();
renderRoutineSelect();
renderWorkout();
renderHistory();
renderProgress();
renderRoutineEditor();
