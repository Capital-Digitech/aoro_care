/* =========================================================
   HEALTH RING — Prescription Management (Admin)
   Vanilla JavaScript. No jQuery.

   Runs safely on:
   - prescription_list.html
   - prescription_add.html
   - prescription_edit.html

   IMPORTANT:
   Add/Edit workspace functionality such as:
   - patient search
   - patient sync
   - medicine rows
   - lab uploads
   - clinical history
   - workspace validation

   is handled by prescription_workspace.js.

   This file handles only:
   - Admin sidebar
   - Admin global search
   - Theme
   - Toast
   - Prescription list filters
   - View prescription modal
   - Delete confirmation
========================================================= */

(function () {
  "use strict";


  /* =========================================================
     SIDEBAR TOGGLE + RESPONSIVE OVERLAY
  ========================================================= */

  function initSidebar() {
    var sidebar = document.getElementById("hrSidebar");
    var overlay = document.getElementById("hrOverlay");
    var toggleBtn = document.getElementById("hrSidebarToggle");

    if (!sidebar || !toggleBtn) {
      return;
    }

    function openSidebar() {
      sidebar.classList.add("show");

      if (overlay) {
        overlay.classList.add("show");
      }
    }

    function closeSidebar() {
      sidebar.classList.remove("show");

      if (overlay) {
        overlay.classList.remove("show");
      }
    }

    toggleBtn.addEventListener("click", function () {
      if (sidebar.classList.contains("show")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    if (overlay) {
      overlay.addEventListener("click", closeSidebar);
    }
  }


  /* =========================================================
     THEME TOGGLE
  ========================================================= */

  function initTheme() {
    var themeBtn = document.getElementById("hrThemeToggle");

    if (!themeBtn) {
      return;
    }

    var html = document.documentElement;

    var stored = null;

    try {
      stored = sessionStorage.getItem("hrTheme");
    } catch (e) {
      stored = null;
    }

    if (stored === "dark") {
      html.setAttribute("data-theme", "dark");
      themeBtn.innerHTML =
        '<i class="fa-solid fa-sun"></i>';
    } else {
      html.setAttribute("data-theme", "light");
      themeBtn.innerHTML =
        '<i class="fa-solid fa-moon"></i>';
    }


    themeBtn.addEventListener("click", function () {

      var isDark =
        html.getAttribute("data-theme") === "dark";

      if (isDark) {

        html.setAttribute("data-theme", "light");

        themeBtn.innerHTML =
          '<i class="fa-solid fa-moon"></i>';

        try {
          sessionStorage.setItem(
            "hrTheme",
            "light"
          );
        } catch (e) {}

      } else {

        html.setAttribute("data-theme", "dark");

        themeBtn.innerHTML =
          '<i class="fa-solid fa-sun"></i>';

        try {
          sessionStorage.setItem(
            "hrTheme",
            "dark"
          );
        } catch (e) {}
      }

    });
  }


  /* =========================================================
     GLOBAL ADMIN SEARCH
     Searches sidebar navigation pages only.

     IMPORTANT:
     This is separate from:
     #hrRxSearch

     #hrRxSearch handles Prescription table filtering.
  ========================================================= */

  function initGlobalSearch() {

    var wrap =
      document.getElementById("hrGlobalSearch");

    var input =
      document.getElementById("hrGlobalSearchInput");

    var results =
      document.getElementById("hrGlobalSearchResults");

    if (!wrap || !input || !results) {
      return;
    }


    /* ---------------------------------------------------------
       Collect sidebar navigation items
    --------------------------------------------------------- */

    var navItems =
      Array.prototype.slice.call(
        document.querySelectorAll(
          ".hr-sidebar .hr-nav-item"
        )
      )
        .map(function (link) {

          return {
            label:
              link.textContent
                .replace(/\s+/g, " ")
                .trim(),

            href:
              link.getAttribute("href"),

            icon:
              link.querySelector("i")?.className ||
              "fa-solid fa-arrow-right"
          };

        })
        .filter(function (item) {

          return (
            item.href &&
            item.href !== "#"
          );

        });


    /* ---------------------------------------------------------
       Render search results
    --------------------------------------------------------- */

    function render(matches) {

      if (!matches.length) {

        results.innerHTML =
          '<div class="hr-global-search-empty">' +
            "No matching pages found" +
          "</div>";

      } else {

        results.innerHTML =
          matches
            .map(function (item) {

              return (
                '<a class="hr-global-search-item" ' +
                   'href="' +
                   item.href +
                '">' +

                  '<i class="' +
                    item.icon +
                  '"></i>' +

                  "<span>" +
                    item.label +
                  "</span>" +

                "</a>"
              );

            })
            .join("");
      }

      results.classList.add("show");
    }


    /* ---------------------------------------------------------
       Close search results
    --------------------------------------------------------- */

    function close() {

      results.classList.remove("show");
      results.innerHTML = "";
    }


    /* ---------------------------------------------------------
       Search input
    --------------------------------------------------------- */

    input.addEventListener(
      "input",
      function () {

        var term =
          input.value
            .trim()
            .toLowerCase();


        if (!term) {
          close();
          return;
        }


        var matches =
          navItems.filter(
            function (item) {

              return item.label
                .toLowerCase()
                .indexOf(term) !== -1;

            }
          );


        render(matches);
      }
    );


    /* ---------------------------------------------------------
       Re-open results when input receives focus
    --------------------------------------------------------- */

    input.addEventListener(
      "focus",
      function () {

        if (input.value.trim()) {

          input.dispatchEvent(
            new Event("input")
          );

        }
      }
    );


    /* ---------------------------------------------------------
       Escape key closes search
    --------------------------------------------------------- */

    input.addEventListener(
      "keydown",
      function (e) {

        if (e.key === "Escape") {

          close();

          input.blur();
        }
      }
    );


    /* ---------------------------------------------------------
       Click outside closes search
    --------------------------------------------------------- */

    document.addEventListener(
      "click",
      function (e) {

        if (!wrap.contains(e.target)) {
          close();
        }

      }
    );
  }


  /* =========================================================
     TOAST
  ========================================================= */

  function showToast(text) {

    var toast =
      document.getElementById("hrToast");

    var toastText =
      document.getElementById("hrToastText");

    if (!toast) {
      return;
    }

    if (toastText && text) {
      toastText.textContent = text;
    }

    toast.classList.add("show");

    window.clearTimeout(showToast._timer);

    showToast._timer =
      window.setTimeout(function () {
        toast.classList.remove("show");
      }, 3200);
  }


  function initFlashToast() {

    var alertEl =
      document.querySelector(
        ".hr-content .alert"
      );

    if (!alertEl) {
      return;
    }

    var message =
      alertEl.textContent.trim();

    if (message) {
      showToast(message);
    }
  }


  /* =========================================================
     SEARCH + FILTERS + PAGINATION
     PRESCRIPTION LIST ONLY
  ========================================================= */

  function initTableFilters() {

    var table =
      document.getElementById("hrRxTable");

    if (!table) {
      return;
    }

    var tbody =
      table.querySelector("tbody");

    if (!tbody) {
      return;
    }

    var rows =
      Array.prototype.slice.call(
        tbody.querySelectorAll(
          "tr[data-rx-id]"
        )
      );

    if (!rows.length) {
      return;
    }


    var searchInput =
      document.getElementById(
        "hrRxSearch"
      );

    var doctorSelect =
      document.getElementById(
        "hrRxFilterDoctor"
      );

    var statusSelect =
      document.getElementById(
        "hrRxFilterStatus"
      );

    var resetBtn =
      document.getElementById(
        "hrRxResetFilters"
      );

    var infoEl =
      document.getElementById(
        "hrRxPaginationInfo"
      );

    var pagerEl =
      document.getElementById(
        "hrRxPagination"
      );


    var PAGE_SIZE = 10;

    var currentPage = 1;


    /* ---------------------------------------------------------
       Match Prescription Filters
    --------------------------------------------------------- */

    function matchesFilters(row) {

      var term =
        searchInput
          ? searchInput.value
              .trim()
              .toLowerCase()
          : "";

      var doctorVal =
        doctorSelect
          ? doctorSelect.value
              .toLowerCase()
          : "";

      var statusVal =
        statusSelect
          ? statusSelect.value
              .toLowerCase()
          : "";


      var patient =
        (
          row.getAttribute(
            "data-patient-name"
          ) || ""
        ).toLowerCase();


      var code =
        (
          row.getAttribute(
            "data-patient-code"
          ) || ""
        ).toLowerCase();


      var diagnosis =
        (
          row.getAttribute(
            "data-diagnosis"
          ) || ""
        ).toLowerCase();


      var doctorName =
        (
          row.getAttribute(
            "data-doctor-name"
          ) || ""
        ).toLowerCase();


      var status =
        (
          row.getAttribute(
            "data-status"
          ) || ""
        ).toLowerCase();


      var matchesTerm =
        !term ||
        patient.indexOf(term) !== -1 ||
        code.indexOf(term) !== -1 ||
        diagnosis.indexOf(term) !== -1;


      var matchesDoctor =
        !doctorVal ||
        doctorName.indexOf(doctorVal) !== -1;


      var matchesStatus =
        !statusVal ||
        status === statusVal;


      return (
        matchesTerm &&
        matchesDoctor &&
        matchesStatus
      );
    }


    /* ---------------------------------------------------------
       Pagination
    --------------------------------------------------------- */

    function renderPager(totalPages) {

      if (!pagerEl) {
        return;
      }

      pagerEl.innerHTML = "";

      if (totalPages <= 1) {
        return;
      }


      function makeBtn(
        label,
        page,
        disabled,
        active
      ) {

        var li =
          document.createElement("li");

        li.style.listStyle = "none";


        var btn =
          document.createElement("button");

        btn.type = "button";

        btn.className =
          "hr-page-btn" +
          (active ? " active" : "");

        btn.textContent = label;

        btn.disabled = !!disabled;


        btn.addEventListener(
          "click",
          function () {

            currentPage = page;

            renderTable();
          }
        );


        li.appendChild(btn);

        return li;
      }


      /* Previous */

      pagerEl.appendChild(
        makeBtn(
          "‹",
          Math.max(
            1,
            currentPage - 1
          ),
          currentPage === 1,
          false
        )
      );


      /* Page numbers */

      for (
        var i = 1;
        i <= totalPages;
        i++
      ) {

        pagerEl.appendChild(
          makeBtn(
            String(i),
            i,
            false,
            i === currentPage
          )
        );
      }


      /* Next */

      pagerEl.appendChild(
        makeBtn(
          "›",
          Math.min(
            totalPages,
            currentPage + 1
          ),
          currentPage === totalPages,
          false
        )
      );
    }


    /* ---------------------------------------------------------
       Render Table
    --------------------------------------------------------- */

    function renderTable() {

      var visibleRows =
        rows.filter(
          matchesFilters
        );


      var totalPages =
        Math.max(
          1,
          Math.ceil(
            visibleRows.length /
            PAGE_SIZE
          )
        );


      if (
        currentPage >
        totalPages
      ) {

        currentPage =
          totalPages;
      }


      var start =
        (currentPage - 1) *
        PAGE_SIZE;

      var end =
        start + PAGE_SIZE;


      /* Hide all rows first */

      rows.forEach(
        function (row) {

          row.style.display =
            "none";
        }
      );


      /* Show current page */

      visibleRows
        .slice(start, end)
        .forEach(
          function (row) {

            row.style.display =
              "";
          }
        );


      /* Pagination information */

      if (infoEl) {

        if (
          visibleRows.length ===
          0
        ) {

          infoEl.textContent =
            "0 of " +
            rows.length +
            " prescription(s) shown";

        } else {

          infoEl.textContent =
            "Showing " +
            (start + 1) +
            "–" +
            Math.min(
              end,
              visibleRows.length
            ) +
            " of " +
            visibleRows.length +
            " prescription(s)";
        }
      }


      renderPager(
        totalPages
      );
    }


    /* ---------------------------------------------------------
       Search listener
    --------------------------------------------------------- */

    if (searchInput) {

      searchInput.addEventListener(
        "input",
        function () {

          currentPage = 1;

          renderTable();
        }
      );
    }


    /* ---------------------------------------------------------
       Doctor filter
    --------------------------------------------------------- */

    if (doctorSelect) {

      doctorSelect.addEventListener(
        "change",
        function () {

          currentPage = 1;

          renderTable();
        }
      );
    }


    /* ---------------------------------------------------------
       Status filter
    --------------------------------------------------------- */

    if (statusSelect) {

      statusSelect.addEventListener(
        "change",
        function () {

          currentPage = 1;

          renderTable();
        }
      );
    }


    /* ---------------------------------------------------------
       Reset filters
    --------------------------------------------------------- */

    if (resetBtn) {

      resetBtn.addEventListener(
        "click",
        function () {

          if (searchInput) {
            searchInput.value = "";
          }

          if (doctorSelect) {
            doctorSelect.value = "";
          }

          if (statusSelect) {
            statusSelect.value = "";
          }

          currentPage = 1;

          renderTable();
        }
      );
    }


    renderTable();
  }


  /* =========================================================
     HTML ESCAPE
  ========================================================= */

  function escapeHtml(str) {

    var div =
      document.createElement("div");

    div.textContent =
      str || "";

    return div.innerHTML;
  }


  /* =========================================================
     DETAIL ROW
  ========================================================= */

  function buildDetailRow(
    label,
    value
  ) {

    return (
      '<div class="hr-rx-detail-row">' +

        '<span class="hr-rx-detail-label">' +
          escapeHtml(label) +
        "</span>" +

        '<span class="hr-rx-detail-value">' +
          (value || "—") +
        "</span>" +

      "</div>"
    );
  }


  /* =========================================================
     PARSE DETAILED MEDICINES
  ========================================================= */

  function parseMedicinesDetailed(row) {

    var raw =
      row.getAttribute(
        "data-medicines-detailed"
      );

    if (!raw) {
      return [];
    }

    try {

      var parsed =
        JSON.parse(raw);

      return Array.isArray(parsed)
        ? parsed
        : [];

    } catch (e) {

      return [];
    }
  }


  /* =========================================================
     BUILD MEDICINE CARDS
  ========================================================= */

  function buildMedicineCards(
    medicines
  ) {

    if (!medicines.length) {
      return "";
    }


    return (
      '<div class="hr-rx-med-detail-list">' +

      medicines
        .map(
          function (m) {

            var fields = [
              ["Dosage", m.dosage],
              ["Quantity", m.quantity],
              ["Frequency", m.frequency],
              ["Taking Time", m.taking_time],
              ["Duration", m.duration]
            ]
              .filter(
                function (pair) {

                  return pair[1];
                }
              )
              .map(
                function (pair) {

                  return (
                    '<div class="hr-rx-med-detail-item">' +

                      "<strong>" +
                        escapeHtml(pair[0]) +
                      ":</strong> " +

                      escapeHtml(pair[1]) +

                    "</div>"
                  );
                }
              )
              .join("");


            return (
              '<div class="hr-rx-med-detail-card">' +

                '<div class="hr-rx-med-detail-name">' +

                  "<span>" +
                    escapeHtml(
                      m.medicine_name || ""
                    ) +
                  "</span>" +

                  (
                    m.medicine_type
                      ? (
                          '<span class="hr-rx-med-detail-type">' +

                            escapeHtml(
                              m.medicine_type
                            ) +

                          "</span>"
                        )
                      : ""
                  ) +

                "</div>" +


                (
                  fields
                    ? (
                        '<div class="hr-rx-med-detail-grid">' +
                          fields +
                        "</div>"
                      )
                    : ""
                ) +


                (
                  m.instructions
                    ? (
                        '<div class="hr-rx-med-detail-instructions">' +

                          escapeHtml(
                            m.instructions
                          ) +

                        "</div>"
                      )
                    : ""
                ) +

              "</div>"
            );
          }
        )
        .join("") +

      "</div>"
    );
  }


  /* =========================================================
     VIEW PRESCRIPTION MODAL
     LIST PAGE ONLY
  ========================================================= */

  function initViewModal() {

    var modalEl =
      document.getElementById(
        "hrRxViewModal"
      );

    if (
      !modalEl ||
      typeof bootstrap ===
        "undefined"
    ) {
      return;
    }


    var modal =
      bootstrap.Modal.getOrCreateInstance(
        modalEl
      );


    var headerEl =
      document.getElementById(
        "hrRxViewHeader"
      );

    var bodyEl =
      document.getElementById(
        "hrRxViewBody"
      );


    if (!headerEl || !bodyEl) {
      return;
    }


    document
      .querySelectorAll(
        '[data-action="view"]'
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              var row =
                btn.closest("tr");

              if (!row) {
                return;
              }


              var patientName =
                row.getAttribute(
                  "data-patient-name"
                ) || "-";


              var patientCode =
                row.getAttribute(
                  "data-patient-code"
                ) || "";


              var doctorName =
                row.getAttribute(
                  "data-doctor-name"
                ) || "-";


              var diagnosis =
                row.getAttribute(
                  "data-diagnosis"
                ) || "";


              var currentAnalysis =
                row.getAttribute(
                  "data-current-analysis"
                ) || "";


              var date =
                row.getAttribute(
                  "data-date"
                ) || "";


              var status =
                row.getAttribute(
                  "data-status-label"
                ) || "";


              var followUpDate =
                row.getAttribute(
                  "data-follow-up-date"
                ) || "";


              var followUpTime =
                row.getAttribute(
                  "data-follow-up-time"
                ) || "";


              var followUpNotes =
                row.getAttribute(
                  "data-follow-up-notes"
                ) || "";


              var medicinesDetailed =
                parseMedicinesDetailed(
                  row
                );


              var legacyMedicines =
                row.getAttribute(
                  "data-medicines"
                ) || "";


              /* Patient initials */

              var initials =
                patientName
                  .split(" ")
                  .map(
                    function (p) {
                      return p.charAt(0);
                    }
                  )
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();


              /* Modal header */

              headerEl.innerHTML =
                '<div class="hr-person-avatar">' +

                  escapeHtml(initials) +

                "</div>" +

                "<div>" +

                  '<div class="hr-rx-header-title">' +

                    escapeHtml(
                      patientName
                    ) +

                  "</div>" +

                  '<div class="hr-rx-header-sub">' +

                    (
                      patientCode
                        ? (
                            "Code: " +
                            escapeHtml(
                              patientCode
                            )
                          )
                        : ""
                    ) +

                  "</div>" +

                "</div>";


              /* Medicines */

              var medicinesHtml;


              if (
                medicinesDetailed.length
              ) {

                medicinesHtml =
                  buildMedicineCards(
                    medicinesDetailed
                  );

              } else {

                var medPills =
                  legacyMedicines
                    .split(",")
                    .map(
                      function (m) {
                        return m.trim();
                      }
                    )
                    .filter(Boolean)
                    .map(
                      function (m) {

                        return (
                          '<span class="hr-rx-med-pill">' +

                            escapeHtml(m) +

                          "</span>"
                        );
                      }
                    )
                    .join("");


                medicinesHtml =
                  '<div class="hr-rx-med-pills">' +

                    (
                      medPills ||
                      "—"
                    ) +

                  "</div>";
              }


              /* Follow-up */

              var followUpHtml = "";


              if (
                followUpDate ||
                followUpTime ||
                followUpNotes
              ) {

                followUpHtml =

                  '<div class="hr-rx-section-title">' +
                    "Follow-up" +
                  "</div>" +

                  buildDetailRow(
                    "Date",
                    followUpDate
                  ) +

                  buildDetailRow(
                    "Time",
                    followUpTime
                  ) +

                  (
                    followUpNotes
                      ? (
                          '<div class="hr-rx-detail-row" style="align-items:flex-start;">' +

                            '<span class="hr-rx-detail-label">' +
                              "Notes" +
                            "</span>" +

                            '<span class="hr-rx-detail-value">' +

                              escapeHtml(
                                followUpNotes
                              ) +

                            "</span>" +

                          "</div>"
                        )
                      : ""
                  );
              }


              /* Modal body */

              bodyEl.innerHTML =

                buildDetailRow(
                  "Doctor",
                  doctorName
                ) +

                buildDetailRow(
                  "Diagnosis",
                  diagnosis
                ) +

                (
                  currentAnalysis
                    ? (
                        '<div class="hr-rx-detail-row" style="align-items:flex-start;">' +

                          '<span class="hr-rx-detail-label">' +
                            "Clinical Analysis" +
                          "</span>" +

                          '<span class="hr-rx-detail-value">' +

                            escapeHtml(
                              currentAnalysis
                            ) +

                          "</span>" +

                        "</div>"
                      )
                    : ""
                ) +

                buildDetailRow(
                  "Date",
                  date
                ) +

                buildDetailRow(
                  "Status",
                  status
                ) +

                '<div class="hr-rx-section-title">' +
                  "Medicines" +
                "</div>" +

                medicinesHtml +

                followUpHtml;


              modal.show();
            }
          );
        }
      );
  }


  /* =========================================================
     DELETE CONFIRMATION
     LIST PAGE ONLY
  ========================================================= */

  function initDelete() {

    var deleteForm =
      document.getElementById(
        "hrRxDeleteForm"
      );

    if (!deleteForm) {
      return;
    }


    document
      .querySelectorAll(
        '[data-action="delete"]'
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              var row =
                btn.closest("tr");

              if (!row) {
                return;
              }


              var url =
                row.getAttribute(
                  "data-delete-url"
                );


              var patientName =
                row.getAttribute(
                  "data-patient-name"
                ) ||
                "this patient";


              if (!url) {
                return;
              }


              var confirmed =
                window.confirm(
                  "Delete the prescription for " +
                  patientName +
                  "? This cannot be undone."
                );


              if (!confirmed) {
                return;
              }


              deleteForm.setAttribute(
                "action",
                url
              );


              deleteForm.submit();
            }
          );
        }
      );
  }


  /* =========================================================
     ADMIN INITIALIZATION
  ========================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    function () {

      initSidebar();

      initTheme();

      /*
       * Common Admin Global Search
       *
       * Searches sidebar navigation only.
       * Does NOT interfere with #hrRxSearch.
       */
      initGlobalSearch();

      initFlashToast();

      initTableFilters();

      initViewModal();

      initDelete();

      /*
       * IMPORTANT:
       *
       * DO NOT initialize:
       *
       * initMedicineRows();
       * initPrescriptionFormValidation();
       *
       * here.
       *
       * Those are already handled by
       * prescription_workspace.js.
       */
    }
  );

})();