// js/costing.js
// Clean, commented, easy-to-edit costing script.
// - Displays numbers with Indian grouping (1,23,45,678) and NO currency symbol
// - Dynamically loads jsPDF + autoTable if not available
// - Single guarded binding for Download PDF button
// - Uses global showLoader/hideLoader if present

import { apiGet } from "./app.js"; // keep this import if you use apiGet elsewhere

/* ---------------------- Helpers ---------------------- */

/**
 * fmtNumber(n)
 * Format numbers using Indian grouping (en-IN). Returns a readable string with commas.
 * Example: fmtNumber(1234567) -> "12,34,567"
 * Accepts numeric or string input.
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
 * safeNumber(v)
 * Convert a value to a numeric value (strip commas, spaces, currency chars).
 * Returns 0 for non-numeric input.
 */
function safeNumber(v) {
  const num = Number(String(v || "").replace(/[^0-9.\-]/g, ""));
  return isNaN(num) ? 0 : num;
}

/**
 * makeRow(desc, val)
 * Create a DOM element for a two-column row used in the "breakdown" or "payment" boxes.
 */
function makeRow(desc, val) {
  const d = document.createElement("div");
  d.className = "row";
  d.innerHTML = `<div class="desc">${desc}</div><div class="val">${val}</div>`;
  return d;
}

/* ------------------ PDF Libraries Loader ------------------ */

/**
 * loadScript(src)
 * Dynamically load a script by URL. Returns a Promise that resolves when loaded.
 */
function loadScript(src, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // If the script is already present, resolve immediately
    if (Array.from(document.scripts).some((s) => s.src && s.src.indexOf(src) !== -1)) {
      return resolve();
    }
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);

    // safety fallback
    setTimeout(() => resolve(), timeout);
  });
}

/**
 * ensurePdfLibs()
 * Ensure jsPDF and autoTable are available. Attempts to load from CDN if needed.
 * Returns the jspdf object (window.jspdf) or throws if not available after loading.
 */
async function ensurePdfLibs() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf;

  // try to load UMD jsPDF + autoTable
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js");
    // small wait for UMD attach
    await new Promise((r) => setTimeout(r, 120));
  } catch (err) {
    console.warn("Error loading PDF libs:", err);
  }

  // try to normalize presence
  if (!window.jspdf && window.jsPDF) window.jspdf = { jsPDF: window.jsPDF };
  if (window.jspdf && !window.jspdf.autoTable && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable) {
    window.jspdf.autoTable = window.jspdf.jsPDF.API.autoTable;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("jsPDF not available after attempting to load it.");
  }
  return window.jspdf;
}

/* ------------------ Core: Render & PDF ------------------ */

async function init() {
  // Show loader (if provided)
  if (typeof window.showLoader === "function") window.showLoader("Preparing Costing...");

  try {
    // Read project & unit info from localStorage or URL parameters (robust fallback)
    const urlParams = new URLSearchParams(window.location.search);
    const projectName = localStorage.getItem("selectedProjectName") || urlParams.get("project") || "Project";
    const unitNo = localStorage.getItem("selectedUnitNo") || urlParams.get("unit") || "-";
    const sizeStr = localStorage.getItem("selectedUnitSize") || "0";
    const unitType = localStorage.getItem("selectedUnitType") || "-";
    const priceRateStr = localStorage.getItem("selectedPriceRate") || "0";
    const plcRateStr = localStorage.getItem("selectedPLCRate") || "0";

    // Put header and summary values on the page
    const projectTitleEl = document.getElementById("projectTitle");
    if (projectTitleEl) projectTitleEl.innerText = projectName;

    const uNoEl = document.getElementById("uNo");
    const uSizeEl = document.getElementById("uSize");
    const uTypeEl = document.getElementById("uType");
    if (uNoEl) uNoEl.innerText = unitNo;
    if (uSizeEl) uSizeEl.innerText = sizeStr;
    if (uTypeEl) uTypeEl.innerText = unitType;

    // Numeric conversions (safe)
    const size = safeNumber(sizeStr);
    const priceRate = safeNumber(priceRateStr);
    const plcRate = safeNumber(plcRateStr);

    // Cost calculations
    const price = priceRate * size; // Price = base rate * size
    const plc = plcRate * size;     // PLC amount
    const gst = 0.05 * (price + plc); // 5% GST on (Price + PLC)
    const prfc = 25000 * 1.18;      // PRFC + 18% GST (fixed base 25,000)
    const ifms = 50 * size;         // IFMS @50 per size unit
    const rcd = 150000;             // Refundable contingency (fixed)
    const grandTotal = price + plc + gst + prfc + ifms + rcd;
    const baseTotal = price + plc + gst; // used for payment splits

    /* ----- Render Cost Breakdown (Box 2) ----- */
    const breakdownEl = document.getElementById("breakdownList");
    if (breakdownEl) {
      breakdownEl.innerHTML = ""; // clear
      // Base rates
      breakdownEl.appendChild(makeRow("Base Rate (per unit area)", priceRate ? fmtNumber(priceRate) : "-"));
      breakdownEl.appendChild(makeRow("PLC Rate (per unit area)", plcRate ? fmtNumber(plcRate) : "-"));
      breakdownEl.appendChild(document.createElement("hr"));
      // Calculated amounts
      breakdownEl.appendChild(makeRow("Price (Rate × Size)", fmtNumber(price)));
      breakdownEl.appendChild(makeRow("PLC (Rate × Size)", fmtNumber(plc)));
      breakdownEl.appendChild(makeRow("GST @5% on (Price + PLC)", fmtNumber(gst)));
      breakdownEl.appendChild(makeRow("PRFC + 18% GST (25000)", fmtNumber(prfc)));
      breakdownEl.appendChild(makeRow("IFMS (50 × Size)", fmtNumber(ifms)));
      breakdownEl.appendChild(makeRow("IRFCD (Fixed)", fmtNumber(rcd)));
      breakdownEl.appendChild(document.createElement("hr"));
      breakdownEl.appendChild(makeRow("Total (Indicative)", fmtNumber(grandTotal)));
    }

    /* ----- Render Payment Plan (Box 3) ----- */
    const pct = (p) => (p / 100) * baseTotal;
    const bookingAmt = pct(9) + prfc;
    const within60Amt = pct(11);
    const within120Amt = pct(10);
    const topFloorAmt = pct(30);
    const appOCAmt = pct(25);
    const recvOCAmt = pct(10);
    const possessionAmt = pct(5) + ifms + rcd;

    const paymentEl = document.getElementById("paymentList");
    if (paymentEl) {
      paymentEl.innerHTML = "";
      paymentEl.appendChild(makeRow("Booking Amount @9% + PRFC", fmtNumber(bookingAmt)));
      paymentEl.appendChild(makeRow("Within 60 days @11%", fmtNumber(within60Amt)));
      paymentEl.appendChild(makeRow("Within 120 days @10%", fmtNumber(within120Amt)));
      paymentEl.appendChild(makeRow("On Top Residential Floor @30%", fmtNumber(topFloorAmt)));
      paymentEl.appendChild(makeRow("On Application of OC @25%", fmtNumber(appOCAmt)));
      paymentEl.appendChild(makeRow("On Receiving of OC @10%", fmtNumber(recvOCAmt)));
      paymentEl.appendChild(makeRow("On Offer of Possession @5% + IFMS + IRFCD", fmtNumber(possessionAmt)));
    }

    /* ----- Set up Download PDF button (guarded bind) ----- */
    // We will use a small guard on the button to avoid duplicate listeners/duplicate downloads
    const downloadBtn = document.getElementById("downloadCostingPdf");
    if (downloadBtn && downloadBtn.dataset._costBind !== "1") {
      downloadBtn.dataset._costBind = "1";
      downloadBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        try {
          if (typeof window.showLoader === "function") window.showLoader("Preparing Cost Sheet...");
          // Ensure PDF libs
          await ensurePdfLibs();
          // Build PDF
          const jspdf = window.jspdf;
          const { jsPDF } = jspdf;
          const doc = new jsPDF({ unit: "pt", format: "a4" });
          const pageW = doc.internal.pageSize.getWidth();
          const margin = 36;

          // Header band
          doc.setFillColor(12, 84, 122);
          doc.rect(margin, 28, pageW - margin * 2, 58, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.text(projectName, pageW / 2, 60, { align: "center" });
          doc.setTextColor(40, 40, 40);

          // Unit summary
          doc.autoTable({
            startY: 100,
            theme: "plain",
            head: [["Unit No", "Size", "Type"]],
            body: [[unitNo, String(sizeStr), unitType]],
            styles: { fontSize: 11 },
            headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30] },
            columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 100 }, 2: { cellWidth: pageW * 0.4 } }
          });

          // Breakdown table
          const breakdownRows = [
            ["Base Rate (per unit area)", fmtNumber(priceRate)],
            ["PLC Rate (per unit area)", fmtNumber(plcRate)],
            ["Price (Rate × Size)", fmtNumber(price)],
            ["PLC (Rate × Size)", fmtNumber(plc)],
            ["GST (5%)", fmtNumber(gst)],
            ["PRFC + 18% GST (25000)", fmtNumber(prfc)],
            ["IFMS (50 × Size)", fmtNumber(ifms)],
            ["Refundable Contingency Deposit", fmtNumber(rcd)],
            ["Total (Indicative)", fmtNumber(grandTotal)]
          ];
          doc.autoTable({
            startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 160,
            head: [["Particulars", "Amount"]],
            body: breakdownRows,
            styles: { fontSize: 10 },
            headStyles: { fillColor: [12, 84, 122], textColor: [255, 255, 255] },
            columnStyles: { 0: { cellWidth: pageW * 0.65 }, 1: { halign: "right", cellWidth: pageW * 0.25 } }
          });

          // Payment plan table
          const payments = [
            ["Booking Amount @9% + PRFC", fmtNumber(bookingAmt)],
            ["Within 60 days @11%", fmtNumber(within60Amt)],
            ["Within 120 days @10%", fmtNumber(within120Amt)],
            ["On Top Residential Floor @30%", fmtNumber(topFloorAmt)],
            ["On Application of OC @25%", fmtNumber(appOCAmt)],
            ["On Receiving of OC @10%", fmtNumber(recvOCAmt)],
            ["On Offer of Possession @5% + IFMS + RCD", fmtNumber(possessionAmt)]
          ];
          const startY2 = doc.lastAutoTable ? doc.lastAutoTable.finalY + 14 : 400;
          doc.autoTable({
            startY: startY2,
            head: [["Milestone", "Amount"]],
            body: payments,
            styles: { fontSize: 10 },
            headStyles: { fillColor: [12, 84, 122], textColor: [255, 255, 255] },
            columnStyles: { 0: { cellWidth: pageW * 0.65 }, 1: { halign: "right", cellWidth: pageW * 0.25 } }
          });

          // Final total (sum of payments)
          const numericSum = [
            bookingAmt,
            within60Amt,
            within120Amt,
            topFloorAmt,
            appOCAmt,
            recvOCAmt,
            possessionAmt
          ].reduce((s, x) => s + safeNumber(x), 0);
          const ytot = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : (startY2 + 160);
          doc.setFontSize(11);
          doc.setFont(undefined, "bold");
          doc.text("Total (Payment Plan)", margin + 6, ytot);
          doc.text(fmtNumber(numericSum), pageW - margin - 6, ytot, { align: "right" });

          // Save PDF
          const safeName = projectName.replace(/[^\w\-]+/g, "_").slice(0, 80);
          doc.save(`${safeName}_Costing_${unitNo || "unit"}.pdf`);
        } catch (err) {
          console.error("Error generating PDF:", err);
          alert("Could not generate PDF. See console for details.");
        } finally {
          if (typeof window.hideLoader === "function") window.hideLoader();
        }
      });
    }f

  } catch (err) {
    console.error("Costing init error:", err);
    if (typeof window.hideLoader === "function") window.hideLoader();
  } finally {
    // Ensure loader hidden if something went wrong earlier
    if (typeof window.hideLoader === "function") window.hideLoader();
  }
}

// init on DOM ready
document.addEventListener("DOMContentLoaded", init);