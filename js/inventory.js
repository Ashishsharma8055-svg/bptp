// js/inventory.js
// Inventory page renderer + routing to costing pages + PDF download
// - Reads inventory via apiGet('inventory')
// - Filters by selected project (localStorage or URL param)
// - Shows only available units
// - Search, download PDF, and Get Cost routing
// - Uses global showLoader/hideLoader when available

import { apiGet } from "./app.js";

/* -------------------- Helpers -------------------- */

/**
 * fmtNumber
 * Format numbers with Indian grouping (1,23,45,678). No currency symbol.
 */
function fmtNumber(n) {
  try {
    const v = Math.round(Number(n) || 0);
    return new Intl.NumberFormat("en-IN").format(v);
  } catch (e) {
    return String(Math.round(Number(n) || 0));
  }
}

/**
 * safeGet
 * Get first existing property from object given array of possible keys.
 */
function safeGet(obj, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
      return obj[k];
    }
  }
  return "";
}

/**
 * normalizeKey
 * Normalize a string for tolerant comparisons (trim + lowercase).
 */
function normalizeKey(v) {
  return String(v ?? "").trim().toLowerCase();
}

/* ------------------ PDF libs loader ------------------ */

/**
 * loadScript
 * Dynamically load a script URL (returns promise).
 */
function loadScript(src, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // If already present, resolve quickly
    if (Array.from(document.scripts).some(s => s.src && s.src.indexOf(src) !== -1)) return resolve();
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
    // fallback timeout to avoid hanging
    setTimeout(() => resolve(), timeout);
  });
}

/**
 * ensurePdfLibs
 * Ensure jsPDF and autoTable are available; try to load them if not.
 */
async function ensurePdfLibs() {
  if (window.jspdf && window.jspdf.jsPDF && window.jspdf.autoTable) return window.jspdf;
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js");
    // small pause so UMD attaches
    await new Promise(r => setTimeout(r, 120));
  } catch (err) {
    console.warn("PDF libraries load attempt failed:", err);
  }

  // normalize alternate global names
  if (!window.jspdf && window.jsPDF) window.jspdf = { jsPDF: window.jsPDF };
  if (window.jspdf && !window.jspdf.autoTable && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable) {
    window.jspdf.autoTable = window.jspdf.jsPDF.API.autoTable;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("jsPDF not available after attempted load.");
  }
  return window.jspdf;
}

/* ------------------ DOM helpers ------------------ */

const qs = (sel) => document.querySelector(sel);

/* ------------------ State ------------------ */

let cachedRows = []; // inventory rows filtered for the current project (available only)
let currentProjectName = ""; // normalized project name used for filtering

/* ------------------ Rendering ------------------ */

/**
 * renderRow
 * Adds a table row for one inventory item and wires the Get Cost button.
 */
function renderRow(tbody, rawRow) {
  const unitNo = safeGet(rawRow, ["Unit No", "Unit No.", "Unit", "Unit Number", "UnitNo"]) || "-";
  const size   = safeGet(rawRow, ["Size", "Area", "Carpet", "Super Area"]) || "-";
  const type   = safeGet(rawRow, ["Type", "Typology"]) || "-";
  const possession = safeGet(rawRow, ["Possession", "Possession Date"]) || "-";
  const payment = safeGet(rawRow, ["Payment", "Payment Plan", "Plan"]) || "-";
  const costingPlan = safeGet(rawRow, ["CostingPlan", "Costing Plan", "Costing"]) || "";

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="td-unit">${unitNo}</td>
    <td class="td-size">${size}</td>
    <td class="td-type">${type}</td>
    <td class="td-possession">${possession}</td>
    <td class="td-payment">${payment}</td>
    <td class="td-action"><button class="btn-get-cost" type="button">Get Cost</button></td>
  `;

  // Attach click to the button to route to appropriate costing page
  const btn = tr.querySelector(".btn-get-cost");
  btn.addEventListener("click", () => handleGetCost(rawRow));

  tbody.appendChild(tr);
}

/**
 * renderTable
 * Clear & render current cachedRows into table body.
 */
function renderTable(rows) {
  const tbody = qs("#inventoryBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No units</td></tr>`;
    return;
  }

  rows.forEach(r => renderRow(tbody, r));
}

/* ------------------ Events / Actions ------------------ */

/**
 * handleGetCost
 * Save selected unit details into localStorage and redirect to corresponding costing page.
 */
function handleGetCost(rawRow) {
  // canonicalize fields and save to localStorage for costing page
  const projectName = safeGet(rawRow, ["Project Name", "Project", "ProjectName"]) || currentProjectName || "";
  const unitNo = safeGet(rawRow, ["Unit No", "Unit No.", "Unit", "Unit Number", "UnitNo"]) || "";
  const size = safeGet(rawRow, ["Size", "Area", "Carpet", "Super Area"]) || "";
  const type = safeGet(rawRow, ["Type", "Typology"]) || "";
  const price = safeGet(rawRow, ["Price", "Base Rate", "Rate", "Price Rate"]) || "";
  const plc = safeGet(rawRow, ["PLC", "PLC Rate"]) || "";
  const costingPlanRaw = safeGet(rawRow, ["CostingPlan", "Costing Plan", "Costing"]) || "";

  // store
  localStorage.setItem("selectedProjectName", projectName);
  localStorage.setItem("selectedUnitNo", unitNo);
  localStorage.setItem("selectedUnitSize", size);
  localStorage.setItem("selectedUnitType", type);
  localStorage.setItem("selectedPriceRate", price);
  localStorage.setItem("selectedPLCRate", plc);
  localStorage.setItem("selectedCostingPlan", costingPlanRaw);

  
  // Determine costing page based on costingPlan (normalized)    
  
  const planKey = String(costingPlanRaw || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "");

   // Show preparation loader while redirecting (if available)
  if (typeof window.showLoader === "function") window.showLoader("Preparing Cost Sheet...");


// Define mappings (add more easily later)
const routes = {
  "costing102highrise": "costing-102-highrise.html",
  "costing102plotsnew": "costing-102-plotsnew.html",
  "costingterra": "costing-37d-terra.html",
  "costing102plotsold": "costing-102-plotsOld.html",
  "costing60daysfortuna": "costing-102-plotsOld.html",
};

// Find route
if (routes[planKey]) {
  window.location.href = routes[planKey];
  return;
}

// Fallback
if (typeof window.hideLoader === "function") window.hideLoader();
alert("No cost sheet configured for this unit.\nConnect to +91-98-73-133-190");
}

/* ------------------ Search ------------------ */

/**
 * applySearch
 * Filter cached rows using the search query and re-render table.
 */
function applySearch(q) {
  const s = String(q || "").toLowerCase().trim();
  if (!s) {
    renderTable(cachedRows);
    return;
  }
  const filtered = cachedRows.filter(r => {
    return Object.values(r || {}).some(v => String(v || "").toLowerCase().includes(s));
  });
  renderTable(filtered);
}

/* ------------------ PDF Download ------------------ */

/**
 * downloadPDF
 * Create a PDF of the currently cached rows (for the current project).
 * Uses jsPDF + autoTable; will attempt to lazy-load them if missing.
 */
async function downloadPDF() {
  try {
    if (typeof window.showLoader === "function") window.showLoader("Preparing PDF...");
    await ensurePdfLibs();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(12);

    const projectLabel = localStorage.getItem("selectedProjectName") || currentProjectName || "Inventory";
    doc.text(`${projectLabel} - Inventory`, 14, 16);

    const body = (cachedRows || []).map(r => [
      safeGet(r, ["Unit No", "Unit No.", "Unit"]) || "-",
      safeGet(r, ["Size", "Area"]) || "-",
      safeGet(r, ["Type", "Typology"]) || "-",
      safeGet(r, ["Possession"]) || "-",
      safeGet(r, ["Payment"]) || "-"
    ]);

    doc.autoTable({
      head: [["Unit No", "Size", "Type", "Possession", "Payment"]],
      body,
      startY: 22,
      styles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 40 } }
    });

    const safeName = (projectLabel || "inventory").replace(/[^\w\-]+/g, "_").slice(0, 80);
    doc.save(`${safeName}_Inventory.pdf`);
  } catch (err) {
    console.error("downloadPDF error:", err);
    alert("Could not create PDF. See console.");
  } finally {
    if (typeof window.hideLoader === "function") window.hideLoader();
  }
}

/* ------------------ Initialization ------------------ */

/**
 * init
 * Main entry to load, filter and render inventory for current project.
 */
async function init() {
  // Show loader (if provided)
  if (typeof window.showLoader === "function") window.showLoader("Loading Inventory...");

  try {
    // Determine project name from localStorage or URL param
    const urlParams = new URLSearchParams(window.location.search);
    const projectFromStorage = localStorage.getItem("selectedProjectName") || "";
    const projectFromUrl = urlParams.get("project") || "";
    currentProjectName = projectFromStorage || projectFromUrl;

    // Update title
    const titleEl = qs("#inventoryTitle");
    if (titleEl) titleEl.innerText = currentProjectName ? `${currentProjectName} - Inventory` : "Inventory";

    // Fetch inventory via API
    const data = await apiGet("inventory") || [];

    // Filter rows for the current project & available status
    cachedRows = data.filter(row => {
      const pName = safeGet(row, ["Project Name", "Project", "ProjectName"]);
      const status = safeGet(row, ["Status", "Availability"]);
      const sameProject = currentProjectName ? normalizeKey(pName) === normalizeKey(currentProjectName) : true;
      const isAvailable = String(status || "").toLowerCase() === "available";
      return sameProject && isAvailable;
    });

    // render
    renderTable(cachedRows);

    // Wire search box (prevent duplicate handlers by removing then adding)
    const searchBox = qs("#searchBox");
    if (searchBox) {
      searchBox.removeEventListener("input", _searchHandler);
      searchBox.addEventListener("input", _searchHandler);
    }

    // Wire download PDF (guard)
    const downloadBtn = qs("#downloadPdf");
    if (downloadBtn && downloadBtn.dataset._bind !== "1") {
      downloadBtn.dataset._bind = "1";
      downloadBtn.addEventListener("click", () => downloadPDF());
    }
  } catch (err) {
    console.error("Inventory init error:", err);
    const tbody = qs("#inventoryBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6">Error loading inventory. Check console.</td></tr>`;
  } finally {
    if (typeof window.hideLoader === "function") window.hideLoader();
  }
}

/* small wrapper so we can remove listener if re-init */
function _searchHandler(e) {
  applySearch(e.target.value);
}

// Auto-run on DOM ready
document.addEventListener("DOMContentLoaded", init);