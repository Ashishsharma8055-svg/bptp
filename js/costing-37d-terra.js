// js/costing.js
// Clean, commented, readable costing script.
// - Formats numbers with Indian grouping (no currency symbol)
// - Dynamically loads jsPDF + autoTable when needed
// - Single guarded binding for Download PDF button
// - Uses global showLoader/hideLoader if present

import { apiGet } from "./app.js"; // keep if you need api calls later

/* ---------------------- Utilities ---------------------- */

/** fmtNumber(n) - Indian grouping, rounded, no currency symbol */
function fmtNumber(n) {
  try {
    const v = Math.round(Number(n) || 0);
    return new Intl.NumberFormat("en-IN").format(v);
  } catch (e) {
    return String(Math.round(Number(n) || 0));
  }
}

/** safeNumber(v) - parse numeric-like values (remove commas, symbols) */
function safeNumber(v) {
  const n = Number(String(v || "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/** makeRow(desc, val) - helper to create a two-column DOM row */
function makeRow(desc, val) {
  const d = document.createElement("div");
  d.className = "row";
  d.innerHTML = `<div class="desc">${desc}</div><div class="val">${val}</div>`;
  return d;
}

/* -------------------- Dynamic script loader -------------------- */

/** loadScript(src, timeout) - injects a script and resolves when loaded */
function loadScript(src, timeout = 10000) {
  return new Promise((resolve, reject) => {
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
    // fallback resolve after timeout to avoid blocking forever
    setTimeout(() => resolve(), timeout);
  });
}

/** ensurePdfLibs() - ensure jsPDF + autotable are available; loads from CDN if needed */
async function ensurePdfLibs() {
  // UMD bundle attaches as window.jspdf (with jsPDF property)
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf;

  // Attempt to load common CDN builds
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js");
    // small pause to allow UMD to attach
    await new Promise((r) => setTimeout(r, 120));
  } catch (err) {
    console.warn("PDF libs load warning:", err);
  }

  // Normalize fallback if library exposed differently
  if (!window.jspdf && window.jsPDF) window.jspdf = { jsPDF: window.jsPDF };
  if (window.jspdf && !window.jspdf.autoTable && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable) {
    window.jspdf.autoTable = window.jspdf.jsPDF.API.autoTable;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("jsPDF not available after loading attempts.");
  }
  return window.jspdf;
}

/* -------------------- Core: render & download -------------------- */

async function init() {
  // show loader if available
  if (typeof window.showLoader === "function") window.showLoader("Preparing Costing...");

  try {
    // Robustly read values: localStorage first, then URL params
    const params = new URLSearchParams(window.location.search);
    const projectName = localStorage.getItem("selectedProjectName") || params.get("project") || "Project";
    const unitNo = localStorage.getItem("selectedUnitNo") || params.get("unit") || "-";
    const sizeStr = localStorage.getItem("selectedUnitSize") || "0";
    const unitType = localStorage.getItem("selectedUnitType") || "-";
    const priceRateStr = localStorage.getItem("selectedPriceRate") || "0";
    const plcRateStr = localStorage.getItem("selectedPLCRate") || "0";

    // Put header and summary into DOM if present
    const projectTitleEl = document.getElementById("projectTitle");
    if (projectTitleEl) projectTitleEl.innerText = projectName;

    const uNoEl = document.getElementById("uNo");
    const uSizeEl = document.getElementById("uSize");
    const uTypeEl = document.getElementById("uType");
    if (uNoEl) uNoEl.innerText = unitNo;
    if (uSizeEl) uSizeEl.innerText = sizeStr;
    if (uTypeEl) uTypeEl.innerText = unitType;

    // Numeric conversions
    const size = safeNumber(sizeStr);
    const priceRate = safeNumber(priceRateStr);
    //const plcRate = safeNumber(plcRateStr); // kept for future uses

    // Calculations (adjust as required)
    const price = priceRate * size;        // Rate × Size
    const gst = 0.05 * price ;      // GST 5%
    const prfc = 20000 * 1.18;             // fixed PRFC (20000 + 18% GST)
    const ifms = 50 * size;                // IFMS rate * size
    const baseTotal = price + gst;   // base for payment splits
    const grandTotal = price + gst + prfc + ifms;

    /* ----- Render Cost Breakdown (Box 2) ----- */
    const breakdownEl = document.getElementById("breakdownList");
    if (breakdownEl) {
      breakdownEl.innerHTML = "";
      // Base rates shown (no symbol)
      breakdownEl.appendChild(makeRow("Base Price", priceRate ? fmtNumber(priceRate) : "-"));
      breakdownEl.appendChild(document.createElement("hr"));
      // Calculated totals
      breakdownEl.appendChild(makeRow("Base Cost", fmtNumber(price)));
      breakdownEl.appendChild(makeRow("GST @5%", fmtNumber(gst)));
      breakdownEl.appendChild(makeRow("PRFC + 18% GST", fmtNumber(prfc)));
      breakdownEl.appendChild(makeRow("IFMS (50/- )", fmtNumber(ifms)));
      //breakdownEl.appendChild(makeRow("Refundable Contingency Deposit (Fixed)", fmtNumber(rcd)));
      breakdownEl.appendChild(document.createElement("hr"));
      breakdownEl.appendChild(makeRow("Total (Indicative)", fmtNumber(grandTotal)));
    }

    /* ----- Render Payment Plan (Box 3) ----- */
    const pct = (p) => (p / 100) * baseTotal; // helper
    const bookingAmt = pct(10) + prfc;         // 10% + PRFC (example)
    const within30Amt = pct(10);
    const within90Amt = pct(75);
    const possessionAmt = pct(5) + ifms;

    const paymentEl = document.getElementById("paymentList");
    if (paymentEl) {
      paymentEl.innerHTML = "";
      paymentEl.appendChild(makeRow("Booking Amount @ 10% + PRFC", fmtNumber(bookingAmt)));
      paymentEl.appendChild(makeRow("Within 30 days @ 10%", fmtNumber(within30Amt)));
      paymentEl.appendChild(makeRow("Within 90 days @ 75%", fmtNumber(within90Amt)));
      paymentEl.appendChild(makeRow("On Offer of Possession @ 5% + IFMS", fmtNumber(possessionAmt)));
      // total of payment plan (sanity)
      const paymentTotal = bookingAmt + within30Amt + within90Amt + possessionAmt;
      paymentEl.appendChild(document.createElement("hr"));
      paymentEl.appendChild(makeRow("Total (Payment Plan)", fmtNumber(paymentTotal)));
    }

    /* ----- Download PDF binding (guarded) ----- */
    const downloadBtn = document.getElementById("downloadCostingPdf");
    if (downloadBtn && downloadBtn.dataset._bound !== "1") {
      downloadBtn.dataset._bound = "1";
      downloadBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        try {
          if (typeof window.showLoader === "function") window.showLoader("Preparing Cost Sheet...");
          await ensurePdfLibs();
          const jspdf = window.jspdf;
          const { jsPDF } = jspdf;
          const doc = new jsPDF({ unit: "pt", format: "a4" });
          const pageW = doc.internal.pageSize.getWidth();
          const margin = 36;

          // Header band (colored)
          doc.setFillColor(12, 84, 122);
          doc.rect(margin, 28, pageW - margin * 2, 58, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.text(projectName, pageW / 2, 60, { align: "center" });
          doc.setTextColor(40, 40, 40);

          // Unit summary table
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
            ["Base Price", fmtNumber(priceRate)],
            ["Base Cost ", fmtNumber(price)],
            ["GST @5%", fmtNumber(gst)],
            ["PRFC + 18% GST", fmtNumber(prfc)],
            ["IFMS", fmtNumber(ifms)],
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
            ["Booking Amount @ 10% + PRFC", fmtNumber(bookingAmt)],
            ["Within 30 days @ 10%", fmtNumber(within30Amt)],
            ["Within 90 days @ 75%", fmtNumber(within90Amt)],
            ["On Offer of Possession @ 5% + IFMS", fmtNumber(possessionAmt)]
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

          // Final sum of payments (numeric)
          const numericSum = payments.reduce((s, r) => s + safeNumber(r[1].replace(/,/g, "")), 0);
          const ytot = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : startY2 + 160;
          doc.setFontSize(11);
          doc.setFont(undefined, "bold");
          doc.text("Total (Payment Plan)", margin + 6, ytot);
          doc.text(fmtNumber(numericSum), pageW - margin - 6, ytot, { align: "right" });

          // Save PDF
          const safeName = (projectName || "costing").replace(/[^\w\-]+/g, "_").slice(0, 80);
          doc.save(`${safeName}_Costing_${unitNo || "unit"}.pdf`);
        } catch (err) {
          console.error("PDF generation error:", err);
          alert("Could not generate PDF. See console for details.");
        } finally {
          if (typeof window.hideLoader === "function") window.hideLoader();
        }
      });
    }
  } catch (err) {
    console.error("Costing init error:", err);
    if (typeof window.hideLoader === "function") window.hideLoader();
  } finally {
    // Ensure loader hidden
    if (typeof window.hideLoader === "function") window.hideLoader();
  }
}

/* Initialize on DOM ready */
document.addEventListener("DOMContentLoaded", init);