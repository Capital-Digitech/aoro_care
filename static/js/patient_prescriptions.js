/* =========================================================
   AORO CARE — Patient Prescriptions
   Accordion behaviour (one prescription open at a time, one
   section open inside each prescription).
   Load AFTER patient_dashboard.js.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  const prescriptionList =
    document.getElementById("prescriptionList");

  if (!prescriptionList) {
    return;
  }


  const prescriptions =
    Array.from(
      prescriptionList.querySelectorAll(
        ".hr-prescription-item"
      )
    );


  /* ========================================================
     PRESCRIPTION ACCORDION
     Only one prescription open at a time
     ======================================================== */

  prescriptions.forEach(function (prescription) {

    const header =
      prescription.querySelector(
        ".hr-prescription-header"
      );

    if (!header) {
      return;
    }


    header.addEventListener("click", function () {

      const wasOpen =
        prescription.classList.contains("open");


      prescriptions.forEach(function (item) {

        item.classList.remove("open");

        const itemHeader =
          item.querySelector(
            ".hr-prescription-header"
          );

        if (itemHeader) {
          itemHeader.setAttribute(
            "aria-expanded",
            "false"
          );
        }

      });


      if (!wasOpen) {

        prescription.classList.add("open");

        header.setAttribute(
          "aria-expanded",
          "true"
        );

      }


      updatePrescriptionState();

    });

  });


  function updatePrescriptionState() {

    const hasOpen =
      prescriptions.some(function (item) {

        return item.classList.contains("open");

      });


    prescriptionList.classList.toggle(
      "has-open",
      hasOpen
    );

  }


  /* ========================================================
     INNER SECTION ACCORDION
     Only one section open inside a prescription
     ======================================================== */

  prescriptions.forEach(function (prescription) {

    const sections =
      Array.from(
        prescription.querySelectorAll(
          ".hr-prescription-section"
        )
      );


    sections.forEach(function (section) {

      const heading =
        section.querySelector(
          ".hr-prescription-section-heading"
        );

      if (!heading) {
        return;
      }


      heading.addEventListener(
        "click",
        function () {

          const wasOpen =
            section.classList.contains("open");


          sections.forEach(function (item) {

            item.classList.remove("open");

          });


          if (!wasOpen) {

            section.classList.add("open");

          }

        }
      );

    });

  });


  updatePrescriptionState();

});


/* =========================================================
   SEARCH + FILTERS (client-side only)
   Hides/shows .hr-prescription-item rows using their
   data-search / data-status / data-date attributes.
   ========================================================= */
(function () {
  "use strict";

  function byId(id) { return document.getElementById(id); }

  function init() {
    var list = byId("prescriptionList");
    var searchInput = byId("rxSearch");

    if (!list || !searchInput) { return; }

    var statusSelect = byId("rxFilterStatus");
    var dateInput = byId("rxFilterDate");
    var resetBtn = byId("rxResetFilters");
    var countEl = byId("rxVisibleCount");
    var noMatch = byId("rxNoMatch");

    var items = Array.prototype.slice.call(
      list.querySelectorAll(".hr-prescription-item")
    );

    function applyFilters() {
      var query = searchInput.value.trim().toLowerCase();
      var status = statusSelect ? statusSelect.value : "";
      var date = dateInput ? dateInput.value : "";
      var visible = 0;

      items.forEach(function (item) {
        var ok = true;

        if (query && (item.getAttribute("data-search") || "").indexOf(query) === -1) {
          ok = false;
        }
        if (ok && status && item.getAttribute("data-status") !== status) {
          ok = false;
        }
        if (ok && date && item.getAttribute("data-date") !== date) {
          ok = false;
        }

        item.hidden = !ok;
        if (ok) { visible += 1; }
      });

      if (countEl) { countEl.textContent = visible; }
      if (noMatch) { noMatch.hidden = visible !== 0; }
    }

    searchInput.addEventListener("input", applyFilters);
    if (statusSelect) { statusSelect.addEventListener("change", applyFilters); }
    if (dateInput) {
      dateInput.addEventListener("change", applyFilters);
      dateInput.addEventListener("input", applyFilters);
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        searchInput.value = "";
        if (statusSelect) { statusSelect.value = ""; }
        if (dateInput) { dateInput.value = ""; }
        applyFilters();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();