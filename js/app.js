
"use strict";

/* ==========================================
   DAYBOOK — PERSONAL DIGITAL DIARY
   Version 1.0
   ========================================== */

const DB_KEY = "daybook_personal_database_v1";

const defaultData = {
  goals: [],
  ideas: [],
  tasks: [],
  journal: []
};

let db = loadDatabase();

let currentPage = "dashboard";
let goalFilter = "All";
let ideaFilter = "All";
let taskFilter = "All";
let editing = null;
let toastTimer;

function loadDatabase() {
  try {
    const saved = localStorage.getItem(DB_KEY);
    if (!saved) return structuredClone(defaultData);

    const parsed = JSON.parse(saved);

    return {
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      journal: Array.isArray(parsed.journal) ? parsed.journal : []
    };
  } catch (error) {
    console.error("Database loading error:", error);
    return structuredClone(defaultData);
  }
}

function saveDatabase() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    renderAll();
    return true;
  } catch (error) {
    console.error("Database saving error:", error);
    showToast("Unable to save. Browser storage may be full.");
    return false;
  }
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value + "T00:00:00");
  if (isNaN(date.getTime())) return "No date";

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function setPage(page) {
  const target = document.getElementById(page);
  if (!target) return;

  currentPage = page;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.toggle("active", section.id === page);
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  const names = {
    dashboard: "Overview",
    goals: "My Goals",
    ideas: "My Ideas",
    tasks: "My Tasks",
    journal: "Daily Journal",
    analytics: "Analytics",
    archive: "Archive"
  };

  document.getElementById("pageName").textContent = names[page];

  document.getElementById("sidebar").classList.remove("open");

  renderAll();
}

function emptyState(title, description) {
  return `
    <div class="empty-state">
      <span>✳</span>
      <strong>${escapeHTML(title)}</strong>
      <p>${escapeHTML(description)}</p>
    </div>
  `;
}

/* ==========================================
   MODAL AND FORMS
   ========================================== */

function field(label, name, type = "text", value = "", extra = "") {
  return `
    <div class="form-group">
      <label for="field-${name}">${escapeHTML(label)}</label>
      <input
        id="field-${name}"
        name="${name}"
        type="${type}"
        value="${escapeHTML(value)}"
        ${extra}
      >
    </div>
  `;
}

function textareaField(label, name, value = "") {
  return `
    <div class="form-group">
      <label for="field-${name}">${escapeHTML(label)}</label>
      <textarea id="field-${name}" name="${name}">${escapeHTML(value)}</textarea>
    </div>
  `;
}

function selectField(label, name, options, selected) {
  return `
    <div class="form-group">
      <label for="field-${name}">${escapeHTML(label)}</label>
      <select id="field-${name}" name="${name}">
        ${options.map(option => `
          <option value="${escapeHTML(option)}"
            ${selected === option ? "selected" : ""}>
            ${escapeHTML(option)}
          </option>
        `).join("")}
      </select>
    </div>
  `;
}

function openModal(title, html, type, id = null) {
  editing = { type, id };

  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalFields").innerHTML = html;
  document.getElementById("modalOverlay").classList.add("open");

  document.getElementById("modalForm").querySelectorAll("input,textarea,select")
    .forEach(element => {
      element.setAttribute("autocomplete", "off");
    });

  const first = document.querySelector("#modalFields input, #modalFields textarea");
  if (first) first.focus();
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  document.getElementById("modalForm").reset();
  editing = null;
}

function openGoalForm(goal = null) {
  const today = new Date().toISOString().slice(0, 10);

  const html = `
    ${field("Goal title *", "title", "text", goal?.title || "", "required maxlength='100'")}
    ${textareaField("Description", "description", goal?.description || "")}
    ${field("Start date", "startDate", "date", goal?.startDate || today)}
    ${field("Target date", "targetDate", "date", goal?.targetDate || "")}
    ${selectField("Priority", "priority",
      ["Low", "Medium", "High"], goal?.priority || "Medium")}
    ${selectField("Status", "status",
      ["Planned", "In Progress", "Completed", "Ended"],
      goal?.status || "Planned")}
    ${field("Progress (%)", "progress", "number",
      goal?.progress ?? 0, "min='0' max='100'")}
  `;

  openModal(goal ? "Edit Goal" : "Create a Goal", html, "goal", goal?.id);
}

function openIdeaForm(idea = null) {
  const html = `
    ${field("Idea title *", "title", "text", idea?.title || "", "required maxlength='100'")}
    ${textareaField("Describe your idea", "description", idea?.description || "")}
    ${field("Category", "category", "text", idea?.category || "General")}
  `;

  openModal(idea ? "Edit Idea" : "Save a New Idea", html, "idea", idea?.id);
}

function openTaskForm(task = null) {
  const goalOptions = db.goals.filter(g => g.status !== "Ended");

  const goalField = `
    <div class="form-group">
      <label for="field-goalId">Related goal</label>
      <select name="goalId" id="field-goalId">
        <option value="">No linked goal</option>
        ${goalOptions.map(g => `
          <option value="${escapeHTML(g.id)}"
          ${task?.goalId === g.id ? "selected" : ""}>
            ${escapeHTML(g.title)}
          </option>
        `).join("")}
      </select>
    </div>
  `;

  const html = `
    ${field("Task title *", "title", "text", task?.title || "", "required maxlength='100'")}
    ${textareaField("Description", "description", task?.description || "")}
    ${goalField}
    ${field("Due date", "dueDate", "date", task?.dueDate || "")}
    ${selectField("Status", "status",
      ["Planned", "In Progress", "Waiting", "Completed", "Cancelled"],
      task?.status || "Planned")}
  `;

  openModal(task ? "Edit Task" : "Create a Task", html, "task", task?.id);
}

function openJournalForm(entry = null) {
  const today = new Date().toISOString().slice(0, 10);

  const html = `
    ${field("Entry title *", "title", "text", entry?.title || "", "required maxlength='100'")}
    ${field("Date", "date", "date", entry?.date || today, "required")}
    ${textareaField("What's on your mind? *", "content", entry?.content || "")}
  `;

  openModal(entry ? "Edit Journal Entry" : "New Journal Entry", html, "journal", entry?.id);
}

document.getElementById("modalForm").addEventListener("submit", event => {
  event.preventDefault();

  if (!editing) return;

  const form = new FormData(event.target);
  const values = Object.fromEntries(form.entries());
  const now = new Date().toISOString();

  let collection;
  let record;

  switch (editing.type) {
    case "goal": {
      const progress = Math.max(0, Math.min(100,
        Number(values.progress) || 0));

      let status = values.status;

      if (status === "Completed") {
        values.progress = 100;
      } else if (progress === 100 && status !== "Ended") {
        status = "Completed";
      }

      collection = db.goals;
      record = {
        ...values,
        progress: Number(values.progress),
        status,
        updatedAt: now
      };
      break;
    }

    case "idea":
      collection = db.ideas;
      record = {
        ...values,
        pinned: false,
        archived: false,
        updatedAt: now
      };
      break;

    case "task":
      collection = db.tasks;
      record = {
        ...values,
        goalId: values.goalId || "",
        updatedAt: now
      };
      break;

    case "journal":
      if (!values.content.trim()) {
        showToast("Please write something in your journal.");
        return;
      }
      collection = db.journal;
      record = {
        ...values,
        updatedAt: now
      };
      break;

    default:
      return;
  }

  if (editing.id) {
    const index = collection.findIndex(item => item.id === editing.id);

    if (index !== -1) {
      record = {
        ...collection[index],
        ...record
      };
      collection[index] = record;
    }
  } else {
    collection.unshift({
      id: makeId(),
      ...record,
      createdAt: now
    });
  }

  const success = saveDatabase();

  if (success) {
    closeModal();
    showToast(editing === null ? "Saved successfully!" : "Saved successfully!");
  }
});

/* ==========================================
   GOAL MANAGEMENT
   ========================================== */

function goalCard(goal) {
  const progress = goal.status === "Completed"
    ? 100
    : Math.max(0, Math.min(100, Number(goal.progress) || 0));

  return `
    <article class="data-card">
      <div class="card-meta">
        <span class="status status-${goal.status.toLowerCase().replaceAll(" ", "-")}">
          ${escapeHTML(goal.status)}
        </span>
        <span>${escapeHTML(goal.priority)} priority</span>
      </div>

      <h3>${escapeHTML(goal.title)}</h3>
      <p>${escapeHTML(goal.description || "No description added.")}</p>

      <div class="goal-progress">
        <span style="width:${progress}%"></span>
      </div>

      <div class="card-meta" style="margin-top:10px">
        <span>${progress}% complete</span>
        <span>Due: ${formatDate(goal.targetDate)}</span>
      </div>

      <div class="card-actions">
        <button class="action-btn" data-action="edit-goal" data-id="${goal.id}">Edit</button>
        <button class="action-btn" data-action="goal-status" data-id="${goal.id}">Change Status</button>
        <button class="action-btn" data-action="delete-goal" data-id="${goal.id}">Delete</button>
      </div>
    </article>
  `;
}

function renderGoals() {
  const filtered = db.goals.filter(goal =>
    goalFilter === "All" || goal.status === goalFilter
  );

  document.getElementById("goalsList").innerHTML = filtered.length
    ? filtered.map(goalCard).join("")
    : emptyState("No goals found", "Create your first goal and start making progress.");
}

function changeGoalStatus(id) {
  const goal = db.goals.find(g => g.id === id);
  if (!goal) return;

  const statuses = ["Planned", "In Progress", "Completed", "Ended"];
  const next = statuses[(statuses.indexOf(goal.status) + 1) % statuses.length];

  goal.status = next;
  if (next === "Completed") goal.progress = 100;

  saveDatabase();
  showToast("Goal status updated.");
}

/* ==========================================
   IDEA MANAGEMENT
   ========================================== */

function ideaCard(idea) {
  return `
    <article class="data-card">
      <div class="card-meta">
        <span>${escapeHTML(idea.category || "General")}</span>
        <span>${idea.pinned ? "★ Pinned" : "✳ Idea"}</span>
      </div>

      <h3>${escapeHTML(idea.title)}</h3>
      <p>${escapeHTML(idea.description || "No description.")}</p>

      <div class="card-meta" style="margin-top:14px">
        <span>${formatDate(idea.createdAt?.slice(0, 10))}</span>
      </div>

      <div class="card-actions">
        <button class="action-btn" data-action="edit-idea" data-id="${idea.id}">Edit</button>
        <button class="action-btn" data-action="pin-idea" data-id="${idea.id}">
          ${idea.pinned ? "Unpin" : "Pin"}
        </button>
        <button class="action-btn" data-action="archive-idea" data-id="${idea.id}">
          ${idea.archived ? "Restore" : "Archive"}
        </button>
        <button class="action-btn" data-action="delete-idea" data-id="${idea.id}">Delete</button>
      </div>
    </article>
  `;
}

function renderIdeas() {
  const search = document.getElementById("ideaSearch").value.toLowerCase().trim();

  let filtered = db.ideas.filter(idea => {
    if (ideaFilter === "Pinned" && (!idea.pinned || idea.archived)) return false;
    if (ideaFilter === "Archived" && !idea.archived) return false;
    if (ideaFilter === "All" && idea.archived) return false;

    return (
      idea.title.toLowerCase().includes(search) ||
      (idea.description || "").toLowerCase().includes(search) ||
      (idea.category || "").toLowerCase().includes(search)
    );
  });

  document.getElementById("ideasList").innerHTML = filtered.length
    ? filtered.map(ideaCard).join("")
    : emptyState("No ideas found", "Save a new idea or try another search.");
}

/* ==========================================
   TASK MANAGEMENT
   ========================================== */

function renderTasks() {
  const filtered = db.tasks.filter(task =>
    taskFilter === "All" || task.status === taskFilter
  );

  const html = filtered.map(task => {
    const goal = db.goals.find(g => g.id === task.goalId);

    return `
      <div class="task-row ${task.status === "Completed" ? "done" : ""}">
        <input
          class="task-check"
          type="checkbox"
          ${task.status === "Completed" ? "checked" : ""}
          data-action="toggle-task"
          data-id="${task.id}"
          aria-label="Mark ${escapeHTML(task.title)} as completed"
        >
        <div class="task-info">
          <strong>${escapeHTML(task.title)}</strong>
          <small>
            ${goal ? "Goal: " + escapeHTML(goal.title) + " · " : ""}
            Due: ${formatDate(task.dueDate)}
          </small>
        </div>

        <span class="status status-${task.status.toLowerCase().replaceAll(" ", "-")}">
          ${escapeHTML(task.status)}
        </span>

        <button class="action-btn" data-action="edit-task" data-id="${task.id}">Edit</button>
        <button class="action-btn" data-action="delete-task" data-id="${task.id}">×</button>
      </div>
    `;
  }).join("");

  document.getElementById("tasksList").innerHTML = html ||
    emptyState("No tasks yet", "Create tasks to turn your goals into action.");
}

/* ==========================================
   JOURNAL MANAGEMENT
   ========================================== */

function renderJournal() {
  const entries = [...db.journal].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );

  document.getElementById("journalList").innerHTML = entries.length
    ? entries.map(entry => `
      <article class="journal-card">
        <div class="card-meta">
          <span>PERSONAL REFLECTION</span>
          <span>${formatDate(entry.date)}</span>
        </div>
        <h3>${escapeHTML(entry.title)}</h3>
        <p>${escapeHTML(entry.content)}</p>
        <div class="card-actions">
          <button class="action-btn" data-action="edit-journal" data-id="${entry.id}">Edit</button>
          <button class="action-btn" data-action="delete-journal" data-id="${entry.id}">Delete</button>
        </div>
      </article>
    `).join("")
    : emptyState("Your story starts here", "Write your first journal entry.");
}

/* ==========================================
   DASHBOARD
   ========================================== */

function renderDashboard() {
  const total = db.goals.length;
  const completed = db.goals.filter(g => g.status === "Completed").length;
  const active = db.goals.filter(g => g.status === "In Progress").length;

  document.getElementById("totalGoals").textContent = total;
  document.getElementById("activeGoals").textContent = active;
  document.getElementById("completedGoals").textContent = completed;
  document.getElementById("totalIdeas").textContent =
    db.ideas.filter(i => !i.archived).length;

  const percent = total ? Math.round(completed / total * 100) : 0;

  document.getElementById("overallPercent").textContent = percent + "%";
  document.getElementById("overallCircle").style.background =
    `conic-gradient(var(--primary) ${percent * 3.6}deg, #eeeafc 0deg)`;

  const recentGoals = db.goals.slice(0, 5);

  document.getElementById("dashboardGoals").innerHTML =
    recentGoals.length
      ? recentGoals.map(g => `
        <div class="goal-row">
          <div style="flex:1;min-width:0">
            <strong>${escapeHTML(g.title)}</strong>
            <small>${escapeHTML(g.status)}</small>
            <div class="goal-progress">
              <span style="width:${g.status === "Completed" ? 100 : g.progress}%"></span>
            </div>
          </div>
          <strong>${g.status === "Completed" ? 100 : Number(g.progress) || 0}%</strong>
        </div>
      `).join("")
      : emptyState("No goals yet", "Add your first goal.");

  const recentIdeas = db.ideas.filter(i => !i.archived).slice(0, 4);

  document.getElementById("recentIdeas").innerHTML =
    recentIdeas.length
      ? recentIdeas.map(i => `
        <div class="recent-item">
          <div class="recent-icon">✳</div>
          <div>
            <strong>${escapeHTML(i.title)}</strong>
            <small>${escapeHTML(i.category || "General")}</small>
          </div>
        </div>
      `).join("")
      : emptyState("No ideas saved", "Your next great idea belongs here.");

  const tasks = db.tasks.filter(t =>
    t.status !== "Completed" && t.status !== "Cancelled"
  ).slice(0, 4);

  document.getElementById("upcomingTasks").innerHTML =
    tasks.length
      ? tasks.map(t => `
        <div class="recent-item">
          <div class="recent-icon">☷</div>
          <div>
            <strong>${escapeHTML(t.title)}</strong>
            <small>${formatDate(t.dueDate)} · ${escapeHTML(t.status)}</small>
          </div>
        </div>
      `).join("")
      : emptyState("All caught up", "Create a task when you're ready.");
}

/* ==========================================
   ANALYTICS
   ========================================== */

function renderAnalytics() {
  const completedTasks = db.tasks.filter(t => t.status === "Completed").length;

  document.getElementById("analyticsTasks").textContent = db.tasks.length;
  document.getElementById("analyticsCompletedTasks").textContent = completedTasks;
  document.getElementById("analyticsEnded").textContent =
    db.goals.filter(g => g.status === "Ended").length;
  document.getElementById("analyticsJournal").textContent = db.journal.length;

  const statuses = ["Planned", "In Progress", "Completed", "Ended"];

  document.getElementById("analyticsBars").innerHTML =
    statuses.map(status => {
      const count = db.goals.filter(g => g.status === status).length;
      const percentage = db.goals.length
        ? Math.round(count / db.goals.length * 100)
        : 0;

      return `
        <div class="analytics-bar">
          <div class="analytics-bar-top">
            <strong>${status}</strong>
            <span>${count} goals · ${percentage}%</span>
          </div>
          <div class="analytics-bar-track">
            <span style="width:${percentage}%"></span>
          </div>
        </div>
      `;
    }).join("");
}

/* ==========================================
   ARCHIVE
   ========================================== */

function renderArchive() {
  const archived = db.ideas.filter(i => i.archived);

  document.getElementById("archiveList").innerHTML =
    archived.length
      ? archived.map(ideaCard).join("")
      : emptyState("Your archive is empty", "Archived ideas will appear here.");
}

/* ==========================================
   CENTRAL RENDER ENGINE
   ========================================== */

function renderAll() {
  renderDashboard();
  renderGoals();
  renderIdeas();
  renderTasks();
  renderJournal();
  renderAnalytics();
  renderArchive();
}

/* ==========================================
   ACTION HANDLER
   ========================================== */

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-page]");
  if (nav) {
    setPage(nav.dataset.page);
    return;
  }

  const go = event.target.closest("[data-go]");
  if (go) {
    setPage(go.dataset.go);
    return;
  }

  const filter = event.target.closest("[data-goal-filter]");
  if (filter) {
    goalFilter = filter.dataset.goalFilter;
    document.querySelectorAll("[data-goal-filter]").forEach(b =>
      b.classList.toggle("selected", b === filter)
    );
    renderGoals();
    return;
  }

  const ideaFilterButton = event.target.closest("[data-idea-filter]");
  if (ideaFilterButton) {
    ideaFilter = ideaFilterButton.dataset.ideaFilter;
    document.querySelectorAll("[data-idea-filter]").forEach(b =>
      b.classList.toggle("selected", b === ideaFilterButton)
    );
    renderIdeas();
    return;
  }

  const taskFilterButton = event.target.closest("[data-task-filter]");
  if (taskFilterButton) {
    taskFilter = taskFilterButton.dataset.taskFilter;
    document.querySelectorAll("[data-task-filter]").forEach(b =>
      b.classList.toggle("selected", b === taskFilterButton)
    );
    renderTasks();
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  switch (action) {
    case "edit-goal": {
      const item = db.goals.find(g => g.id === id);
      if (item) openGoalForm(item);
      break;
    }
    case "goal-status":
      changeGoalStatus(id);
      break;
    case "delete-goal":
      if (confirm("Delete this goal? Linked tasks will remain but lose their connection.")) {
        db.goals = db.goals.filter(g => g.id !== id);
        db.tasks.forEach(t => {
          if (t.goalId === id) t.goalId = "";
        });
        saveDatabase();
        showToast("Goal deleted.");
      }
      break;

    case "edit-idea": {
      const item = db.ideas.find(i => i.id === id);
      if (item) openIdeaForm(item);
      break;
    }
    case "pin-idea": {
      const item = db.ideas.find(i => i.id === id);
      if (item) {
        item.pinned = !item.pinned;
        saveDatabase();
        showToast(item.pinned ? "Idea pinned." : "Idea unpinned.");
      }
      break;
    }
    case "archive-idea": {
      const item = db.ideas.find(i => i.id === id);
      if (item) {
        item.archived = !item.archived;
        saveDatabase();
        showToast(item.archived ? "Idea archived." : "Idea restored.");
      }
      break;
    }
    case "delete-idea":
      if (confirm("Permanently delete this idea?")) {
        db.ideas = db.ideas.filter(i => i.id !== id);
        saveDatabase();
        showToast("Idea deleted.");
      }
      break;

    case "edit-task": {
      const item = db.tasks.find(t => t.id === id);
      if (item) openTaskForm(item);
      break;
    }
    case "delete-task":
      if (confirm("Delete this task?")) {
        db.tasks = db.tasks.filter(t => t.id !== id);
        saveDatabase();
        showToast("Task deleted.");
      }
      break;

    case "edit-journal": {
      const item = db.journal.find(j => j.id === id);
      if (item) openJournalForm(item);
      break;
    }
    case "delete-journal":
      if (confirm("Delete this journal entry?")) {
        db.journal = db.journal.filter(j => j.id !== id);
        saveDatabase();
        showToast("Journal entry deleted.");
      }
      break;
  }
});

document.addEventListener("change", event => {
  const checkbox = event.target.closest('[data-action="toggle-task"]');
  if (!checkbox) return;

  const task = db.tasks.find(t => t.id === checkbox.dataset.id);
  if (!task) return;

  task.status = checkbox.checked ? "Completed" : "In Progress";
  saveDatabase();
  showToast("Task updated.");
});

/* ==========================================
   BUTTONS AND SEARCH
   ========================================== */

document.getElementById("addGoal").addEventListener("click", () => openGoalForm());
document.getElementById("addIdea").addEventListener("click", () => openIdeaForm());
document.getElementById("addTask").addEventListener("click", () => openTaskForm());
document.getElementById("addJournal").addEventListener("click", () => openJournalForm());

document.getElementById("quickAdd").addEventListener("click", () => {
  const html = `
    ${selectField("What would you like to create?", "type",
      ["Goal", "Idea", "Task", "Journal Entry"], "Goal")}
  `;
  openModal("Create Something New", html, "quick");
});

document.getElementById("modalFields").addEventListener("change", event => {
  if (event.target.name !== "type" || editing?.type !== "quick") return;

  const type = event.target.value;
  closeModal();

  if (type === "Goal") openGoalForm();
  if (type === "Idea") openIdeaForm();
  if (type === "Task") openTaskForm();
  if (type === "Journal Entry") openJournalForm();
});

document.getElementById("ideaSearch").addEventListener("input", renderIdeas);

document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);

document.getElementById("modalOverlay").addEventListener("click", event => {
  if (event.target.id === "modalOverlay") closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

/* ==========================================
   INITIALIZE APPLICATION
   ========================================== */

function initializeApp() {
  const now = new Date();

  document.getElementById("todayDate").textContent =
    now.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });

  document.getElementById("welcomeDay").textContent =
    now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    });

  renderAll();
}

initializeApp();
