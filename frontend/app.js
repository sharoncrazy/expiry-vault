// ============================================================
// Settings
// ============================================================

// Where the FastAPI backend is running. Change this if you move it.
const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_BASE_URL = isLocal
  ? "http://localhost:8000"
  : "https://expiry-vault.onrender.com";

// The key used to save the login token in the browser's localStorage.
const TOKEN_KEY = "reminder_app_token";


// ============================================================
// Token helpers
// ============================================================

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Send the user to the login page, forgetting their token.
function logout() {
  clearToken();
  window.location.replace("login.html");
}

// Call this at the top of any page that needs a logged-in user.
function requireLogin() {
  if (!getToken()) {
    window.location.replace("login.html");
  }
}


// ============================================================
// Talking to the API
// ============================================================

// Turn FastAPI's error body into a readable message.
// FastAPI sends errors as { "detail": ... } where detail is either
//   - a string, e.g. "Invalid email or password"
//   - a list of validation errors, e.g. [{ "loc": ["body", "password"], "msg": "..." }]
function errorMessageFrom(body, status) {
  if (body && typeof body.detail === "string") {
    return body.detail;
  }
  if (body && Array.isArray(body.detail)) {
    return body.detail
      .map(function (err) {
        const field = err.loc ? err.loc[err.loc.length - 1] : "";
        return field ? field + ": " + err.msg : err.msg;
      })
      .join("\n");
  }
  return "Request failed (status " + status + ")";
}

// Make a request to the API and return the parsed JSON (or null if there is no body).
// Throws an Error with the API's message if the request fails.
//
// options:
//   method  - "GET", "POST", "DELETE" ...   (default "GET")
//   body    - a JS object to send as JSON   (optional)
//   auth    - true to send the login token  (default true)
async function apiRequest(path, options) {
  options = options || {};
  const useAuth = options.auth !== false;

  const headers = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (useAuth) {
    headers["Authorization"] = "Bearer " + getToken();
  }

  let response;
  try {
    response = await fetch(API_BASE_URL + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkError) {
    throw new Error("Could not reach the server at " + API_BASE_URL + ". Is the backend running?");
  }

  // Token missing, expired or invalid: log out.
  // (Only for logged-in requests - a 401 from the login form just means a wrong password.)
  if (response.status === 401 && useAuth) {
    logout();
    throw new Error("Your session has expired. Please log in again.");
  }

  // 204 No Content (e.g. after a delete) has no body to read.
  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = null;
    }
  }

  if (!response.ok) {
    throw new Error(errorMessageFrom(body, response.status));
  }
  return body;
}


// ============================================================
// Formatting helpers
// ============================================================

// "2026-10-15" -> "15 Oct 2026" (in the user's own locale style).
// We split the string ourselves because new Date("2026-10-15") is treated as
// UTC midnight and can show the previous day in some time zones.
function formatDate(isoDate) {
  const parts = isoDate.split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// "2026-09-30T10:15:00+00:00" -> "30 Sept 2026, 10:15"
function formatDateTime(isoDateTime) {
  const date = new Date(isoDateTime);
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// True if an expiry date like "2026-10-15" is before today.
function isPast(isoDate) {
  const today = new Date();
  const todayString =
    today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0") + "-" +
    String(today.getDate()).padStart(2, "0");
  return isoDate < todayString;
}

// The API sends cost as a string like "12.50", or null.
function formatCost(cost) {
  return Number(cost).toFixed(2);
}


// ============================================================
// Small UI helpers
// ============================================================

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = "message " + type; // "error" or "success"
  element.hidden = false;
}

function hideMessage(element) {
  element.hidden = true;
  element.textContent = "";
}

// Disable a button and change its label while something is loading.
function setButtonLoading(button, isLoading, loadingText) {
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}


// ============================================================
// login.html
// ============================================================

function initLoginPage() {
  // Already logged in? Go straight to the reminders.
  if (getToken()) {
    window.location.replace("index.html");
    return;
  }

  const form = document.getElementById("login-form");
  const button = document.getElementById("login-button");
  const message = document.getElementById("message");

  // Show a note if we just came from the register page.
  if (new URLSearchParams(window.location.search).get("registered")) {
    showMessage(message, "Account created. You can log in now.", "success");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideMessage(message);
    setButtonLoading(button, true, "Logging in…");

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        auth: false,
        body: {
          email: document.getElementById("email").value.trim(),
          password: document.getElementById("password").value,
        },
      });
      saveToken(data.access_token);
      window.location.replace("index.html");
    } catch (error) {
      showMessage(message, error.message, "error");
      setButtonLoading(button, false);
    }
  });
}


// ============================================================
// register.html
// ============================================================

function initRegisterPage() {
  const form = document.getElementById("register-form");
  const button = document.getElementById("register-button");
  const message = document.getElementById("message");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideMessage(message);
    setButtonLoading(button, true, "Creating account…");

    try {
      await apiRequest("/auth/register", {
        method: "POST",
        auth: false,
        body: {
          email: document.getElementById("email").value.trim(),
          password: document.getElementById("password").value,
        },
      });
      window.location.href = "login.html?registered=1";
    } catch (error) {
      showMessage(message, error.message, "error");
      setButtonLoading(button, false);
    }
  });
}


// ============================================================
// index.html (the reminders list)
// ============================================================

function initRemindersPage() {
  // requireLogin() in the <head> is already redirecting; don't start any requests.
  if (!getToken()) {
    return;
  }

  const form = document.getElementById("reminder-form");
  const addButton = document.getElementById("add-button");
  const formMessage = document.getElementById("form-message");
  const listMessage = document.getElementById("list-message");
  const list = document.getElementById("reminder-list");
  const loading = document.getElementById("loading");
  const emptyState = document.getElementById("empty-state");

  document.getElementById("logout-button").addEventListener("click", logout);

  // Build one <li> for a reminder.
  // We use textContent (not innerHTML) so reminder names can never inject HTML.
  function renderReminder(reminder) {
    const item = document.createElement("li");
    item.className = "reminder";

    const info = document.createElement("div");
    info.className = "reminder-info";

    const name = document.createElement("div");
    name.className = "reminder-name";
    name.textContent = reminder.name;
    info.appendChild(name);

    const details = document.createElement("div");
    details.className = "reminder-details";
    let detailText = "Expires " + formatDate(reminder.expiry_date);
    if (reminder.cost !== null) {
      detailText += " · Cost " + formatCost(reminder.cost);
    }
    details.textContent = detailText;
    if (isPast(reminder.expiry_date)) {
      const tag = document.createElement("span");
      tag.className = "tag-expired";
      tag.textContent = "Expired";
      details.appendChild(tag);
    }
    info.appendChild(details);

    const created = document.createElement("div");
    created.className = "reminder-created";
    created.textContent = "Added " + formatDateTime(reminder.created_at);
    info.appendChild(created);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button-danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", function () {
      deleteReminder(reminder, deleteButton);
    });

    item.appendChild(info);
    item.appendChild(deleteButton);
    return item;
  }

  async function loadReminders() {
    hideMessage(listMessage);
    loading.hidden = false;
    emptyState.hidden = true;
    list.innerHTML = "";

    try {
      const reminders = await apiRequest("/reminders");
      reminders.forEach(function (reminder) {
        list.appendChild(renderReminder(reminder));
      });
      emptyState.hidden = reminders.length > 0;
    } catch (error) {
      showMessage(listMessage, error.message, "error");
    } finally {
      loading.hidden = true;
    }
  }

  async function deleteReminder(reminder, button) {
    if (!confirm('Delete "' + reminder.name + '"?')) {
      return;
    }
    hideMessage(listMessage);
    setButtonLoading(button, true, "Deleting…");

    try {
      await apiRequest("/reminders/" + reminder.id, { method: "DELETE" });
      await loadReminders();
    } catch (error) {
      showMessage(listMessage, error.message, "error");
      setButtonLoading(button, false);
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideMessage(formMessage);
    setButtonLoading(addButton, true, "Adding…");

    // Cost is optional: send null when the box is empty.
    const costText = document.getElementById("cost").value.trim();

    try {
      await apiRequest("/reminders", {
        method: "POST",
        body: {
          name: document.getElementById("name").value.trim(),
          expiry_date: document.getElementById("expiry_date").value, // already "YYYY-MM-DD"
          cost: costText === "" ? null : costText,
        },
      });
      form.reset();
      await loadReminders();
    } catch (error) {
      showMessage(formMessage, error.message, "error");
    } finally {
      setButtonLoading(addButton, false);
    }
  });

  loadReminders();
}
