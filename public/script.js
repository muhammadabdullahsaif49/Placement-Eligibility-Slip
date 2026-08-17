// ---------- Slip header ----------
document.getElementById("slip-no").textContent = Math.floor(
  100000 + Math.random() * 900000
);
document.getElementById("slip-date").textContent = new Date().toLocaleDateString(
  "en-GB",
  { day: "2-digit", month: "short", year: "numeric" }
);

// ---------- Dark mode ----------
const themeToggle = document.getElementById("theme-toggle");
function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  themeToggle.textContent = dark ? "☀️" : "🌙";
}
const savedTheme = localStorage.getItem("placement-theme");
applyTheme(savedTheme === "dark");
themeToggle.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark");
  applyTheme(isDark);
  localStorage.setItem("placement-theme", isDark ? "dark" : "light");
});

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "chart") drawChart();
    if (btn.dataset.tab === "history") renderHistory();
  });
});

// ---------- History (localStorage) ----------
const HISTORY_KEY = "placement-history";
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}
function addHistory(entry) {
  const history = getHistory();
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
}
function renderHistory() {
  const list = document.getElementById("history-list");
  const history = getHistory();
  if (history.length === 0) {
    list.innerHTML = '<p class="history-empty">No predictions yet. Try the Predict tab.</p>';
    return;
  }
  list.innerHTML = history
    .map(
      (h) => `
      <div class="history-item">
        <span>CGPA ${h.cgpa} · IQ ${h.iq}</span>
        <span class="${h.placed ? "yes" : "no"}">${h.placed ? "Placed" : "Not Placed"} (${h.probability}%)</span>
      </div>`
    )
    .join("");
}
document.getElementById("clear-history").addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

// ---------- Predict form ----------
const form = document.getElementById("predict-form");
const btn = document.getElementById("submit-btn");
const errorMsg = document.getElementById("error-msg");
const result = document.getElementById("result");
const confidenceVal = document.getElementById("confidence-val");
const resultNote = document.getElementById("result-note");
const resultTip = document.getElementById("result-tip");
const stamp = document.getElementById("stamp");
const stampText = document.getElementById("stamp-text");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.classList.add("hidden");
  result.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Evaluating…";

  const cgpa = document.getElementById("cgpa").value;
  const iq = document.getElementById("iq").value;

  try {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cgpa, iq }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.error || "Something went wrong.";
      errorMsg.classList.remove("hidden");
    } else {
      confidenceVal.textContent = `${data.probability}%`;
      resultNote.textContent = data.placed
        ? "Profile matches historical placement pattern."
        : "Profile falls below the placement threshold.";

      if (data.tip) {
        resultTip.textContent = data.tip;
        resultTip.classList.remove("hidden");
      } else {
        resultTip.classList.add("hidden");
      }

      stamp.classList.remove("placed");
      if (data.placed) {
        stamp.classList.add("placed");
        stampText.textContent = "Placed";
      } else {
        stampText.textContent = "Not\nPlaced";
      }
      stamp.style.animation = "none";
      void stamp.offsetWidth;
      stamp.style.animation = "";
      result.classList.remove("hidden");

      addHistory({ cgpa, iq, placed: data.placed, probability: data.probability });
    }
  } catch {
    errorMsg.textContent = "Could not reach the prediction service.";
    errorMsg.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit for Evaluation";
  }
});

// ---------- Batch upload ----------
const batchBtn = document.getElementById("batch-btn");
const batchError = document.getElementById("batch-error");
const batchResults = document.getElementById("batch-results");

batchBtn.addEventListener("click", async () => {
  const fileInput = document.getElementById("batch-file");
  const file = fileInput.files[0];
  batchError.classList.add("hidden");
  batchResults.classList.add("hidden");

  if (!file) {
    batchError.textContent = "Choose a CSV file first.";
    batchError.classList.remove("hidden");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  batchBtn.disabled = true;
  batchBtn.textContent = "Processing…";

  try {
    const res = await fetch("/api/batch", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      batchError.textContent = data.error || "Could not process the file.";
      batchError.classList.remove("hidden");
    } else if (data.results.length === 0) {
      batchError.textContent = "No valid rows found (need 'cgpa' and 'iq' columns).";
      batchError.classList.remove("hidden");
    } else {
      const rows = data.results
        .map(
          (r) => `
        <tr>
          <td>${r.row}</td>
          <td>${r.cgpa}</td>
          <td>${r.iq}</td>
          <td class="${r.placed ? "yes" : "no"}">${r.placed ? "Placed" : "Not Placed"}</td>
          <td>${r.probability}%</td>
        </tr>`
        )
        .join("");
      batchResults.innerHTML = `
        <table>
          <thead><tr><th>#</th><th>CGPA</th><th>IQ</th><th>Result</th><th>Confidence</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      batchResults.classList.remove("hidden");
    }
  } catch {
    batchError.textContent = "Could not reach the server.";
    batchError.classList.remove("hidden");
  } finally {
    batchBtn.disabled = false;
    batchBtn.textContent = "Run Batch Prediction";
  }
});

// ---------- Chart (plain SVG, no external library) ----------
let chartDrawn = false;
let chartDataCache = null;

async function drawChart() {
  if (chartDrawn) return; // draw once
  const container = document.getElementById("scatter-chart");
  try {
    if (!chartDataCache) {
      const res = await fetch("dataset_sample.json");
      chartDataCache = await res.json();
    }

    const width = 460;
    const height = 340;
    const pad = 40;

    const cgpas = chartDataCache.map((d) => d.cgpa);
    const iqs = chartDataCache.map((d) => d.iq);
    const xMin = Math.min(...cgpas) - 0.3;
    const xMax = Math.max(...cgpas) + 0.3;
    const yMin = Math.min(...iqs) - 3;
    const yMax = Math.max(...iqs) + 3;

    const xScale = (v) => pad + ((v - xMin) / (xMax - xMin)) * (width - pad * 1.5);
    const yScale = (v) => height - pad - ((v - yMin) / (yMax - yMin)) * (height - pad * 1.5);

    const points = chartDataCache
      .map((d) => {
        const color = d.placement === 1 ? "var(--stamp-green)" : "var(--stamp)";
        return `<circle cx="${xScale(d.cgpa).toFixed(1)}" cy="${yScale(d.iq).toFixed(1)}" r="3.5" fill="${color}" fill-opacity="0.7" />`;
      })
      .join("");

    const svg = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Scatter plot of CGPA vs IQ colored by placement">
        <line x1="${pad}" y1="${height - pad}" x2="${width - pad * 0.5}" y2="${height - pad}" stroke="var(--paper-line)" stroke-width="1.5" />
        <line x1="${pad}" y1="${pad * 0.5}" x2="${pad}" y2="${height - pad}" stroke="var(--paper-line)" stroke-width="1.5" />
        <text x="${width / 2}" y="${height - 6}" text-anchor="middle" font-size="11" fill="var(--ink-soft)" font-family="var(--font-mono)">CGPA</text>
        <text x="12" y="${height / 2}" text-anchor="middle" font-size="11" fill="var(--ink-soft)" font-family="var(--font-mono)" transform="rotate(-90 12 ${height / 2})">IQ</text>
        ${points}
      </svg>`;

    container.innerHTML = svg;
    chartDrawn = true;
  } catch {
    container.innerHTML = '<p class="history-empty">Could not load dataset.</p>';
  }
}

renderHistory();
