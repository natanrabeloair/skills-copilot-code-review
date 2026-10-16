// Announcements: public banners + signed-in management dialog
(() => {
  const banners = document.getElementById("announcement-banners");
  const manageBtn = document.getElementById("manage-announcements-button");
  const modal = document.getElementById("announcements-modal");
  const closeBtn = document.getElementById("close-announcements");
  const form = document.getElementById("announcement-form");
  const idInput = document.getElementById("ann-id");
  const messageInput = document.getElementById("ann-message");
  const startInput = document.getElementById("ann-start");
  const expInput = document.getElementById("ann-expiration");
  const saveBtn = document.getElementById("ann-save");
  const cancelBtn = document.getElementById("ann-cancel");
  const feedback = document.getElementById("ann-feedback");
  const list = document.getElementById("ann-list");

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("currentUser"));
  } catch (e) {
    user = null;
  }
  let items = [];

  const qs = () => `teacher_username=${encodeURIComponent(user.username)}`;
  const today = () => new Date().toISOString().slice(0, 10);

  async function loadBanners() {
    try {
      const res = await fetch("/announcements");
      const data = await res.json();
      banners.innerHTML = "";
      data.forEach((a) => {
        const div = document.createElement("div");
        div.className = "announcement-banner";
        div.textContent = a.message;
        banners.appendChild(div);
      });
    } catch (e) {
      console.error("Error loading announcements", e);
    }
  }

  function flash(text, type = "success") {
    feedback.textContent = text;
    feedback.className = `message ${type}`;
    setTimeout(() => feedback.classList.add("hidden"), 3500);
  }

  function status(a) {
    if (a.expiration_date < today()) return ["expired", "Expired"];
    if (a.start_date && a.start_date > today()) return ["scheduled", "Scheduled"];
    return ["active", "Active"];
  }

  function render() {
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = '<li class="ann-empty">No announcements yet.</li>';
      return;
    }
    items.forEach((a) => {
      const [cls, label] = status(a);
      const li = document.createElement("li");
      li.className = `ann-item ${cls}`;
      const body = document.createElement("div");
      const msg = document.createElement("p");
      msg.className = "ann-item-message";
      msg.textContent = a.message;
      const meta = document.createElement("div");
      meta.className = "ann-item-meta";
      const badge = document.createElement("span");
      badge.className = "ann-badge";
      badge.textContent = label;
      const dates = document.createElement("span");
      dates.textContent =
        (a.start_date ? `From ${a.start_date} · ` : "") +
        `Expires ${a.expiration_date}`;
      meta.append(badge, dates);
      body.append(msg, meta);

      const actions = document.createElement("div");
      actions.className = "ann-item-actions";
      const edit = document.createElement("button");
      edit.textContent = "✏️ Edit";
      edit.addEventListener("click", () => startEdit(a));
      const del = document.createElement("button");
      del.className = "ann-delete";
      del.textContent = "🗑️ Delete";
      del.addEventListener("click", () => remove(a));
      actions.append(edit, del);

      li.append(body, actions);
      list.appendChild(li);
    });
  }

  async function loadAll() {
    const res = await fetch(`/announcements/all?${qs()}`);
    if (!res.ok) {
      flash("Could not load announcements", "error");
      return;
    }
    items = await res.json();
    render();
  }

  function resetForm() {
    form.reset();
    idInput.value = "";
    saveBtn.textContent = "Add announcement";
    cancelBtn.classList.add("hidden");
  }

  function startEdit(a) {
    idInput.value = a.id;
    messageInput.value = a.message;
    startInput.value = a.start_date || "";
    expInput.value = a.expiration_date;
    saveBtn.textContent = "Save changes";
    cancelBtn.classList.remove("hidden");
    messageInput.focus();
  }

  async function remove(a) {
    if (!confirm(`Delete this announcement?\n\n"${a.message}"`)) return;
    const res = await fetch(`/announcements/${a.id}?${qs()}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (idInput.value === a.id) resetForm();
      flash("Announcement deleted");
      await Promise.all([loadAll(), loadBanners()]);
    } else {
      flash("Delete failed", "error");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = idInput.value;
    const payload = {
      message: messageInput.value,
      start_date: startInput.value || null,
      expiration_date: expInput.value,
    };
    const res = await fetch(
      id ? `/announcements/${id}?${qs()}` : `/announcements?${qs()}`,
      {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (res.ok) {
      flash(id ? "Announcement updated" : "Announcement added");
      resetForm();
      await Promise.all([loadAll(), loadBanners()]);
    } else {
      const err = await res.json().catch(() => ({}));
      const detail = Array.isArray(err.detail)
        ? "Please check the form fields"
        : err.detail;
      flash(detail || "Save failed", "error");
    }
  });

  cancelBtn.addEventListener("click", resetForm);

  function open() {
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("show"), 10);
    loadAll();
  }
  function close() {
    modal.classList.remove("show");
    modal.classList.add("hidden");
    resetForm();
  }

  manageBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) close();
  });

  window.onAuthChange = (u) => {
    user = u;
    manageBtn.classList.toggle("hidden", !u);
    if (!u) close();
  };

  manageBtn.classList.toggle("hidden", !user);
  loadBanners();
})();
