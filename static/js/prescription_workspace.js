/* =========================================================
   HEALTH RING — Doctor Prescription Add Workspace
   Vanilla JavaScript. No jQuery.

   Scope: only the #hrRxWorkspace form on
   doctor_prescription_add.html.
   ========================================================= */

(function () {
  "use strict";

  var root = document.getElementById("hrRxWorkspace");
  if (!root) return;

function getExistingPrescriptionReports() {

    var dataElement =
        document.getElementById(
            "existingPrescriptionReportsData"
        );

    if (!dataElement) {
        return [];
    }

    try {

        var data =
            JSON.parse(
                dataElement.textContent || "[]"
            );

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.error(
            "Unable to load existing prescription reports:",
            error
        );

        return [];
    }
}
  /* ---------------------------------------------------------
     ACCORDION
  --------------------------------------------------------- */
  function initAccordion() {
    var sections = root.querySelectorAll(".hr-rxw-section");

    sections.forEach(function (section) {
      var header = section.querySelector(
        ".hr-rxw-section-header"
      );

      if (!header) return;

      header.addEventListener("click", function () {
        section.classList.toggle("is-open");
      });
    });
  }


  function openSection(sectionKey) {
    var section = root.querySelector(
      '.hr-rxw-section[data-section="' +
        sectionKey +
        '"]'
    );

    if (section) {
      section.classList.add("is-open");
    }
  }


  /* ---------------------------------------------------------
     FORMAT HELPER
  --------------------------------------------------------- */
  function fmt(value, suffix) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "Not available";
    }

    return suffix ? value + suffix : value;
  }


  /* ---------------------------------------------------------
     PATIENT SELECTION
     -> DEMOGRAPHICS + CLINICAL PARAMETERS
  --------------------------------------------------------- */
  function initPatientSync() {
    var patientSelect =
      document.getElementById("patient_id");

    if (!patientSelect) return;


    function applySelectedPatient() {

      var option =
        patientSelect.options[
          patientSelect.selectedIndex
        ];


      /* -----------------------------------------------
         DEMOGRAPHIC DETAILS
      ------------------------------------------------ */
      var demoFields = {
        name:
          option
            ? option.getAttribute("data-name")
            : "",

        code:
          option
            ? option.getAttribute("data-code")
            : "",

        age:
          option
            ? option.getAttribute("data-age")
            : "",

        gender:
          option
            ? option.getAttribute("data-gender")
            : "",

        "blood-group":
          option
            ? option.getAttribute("data-blood-group")
            : "",

        height:
          option
            ? option.getAttribute("data-height")
            : "",

        weight:
          option
            ? option.getAttribute("data-weight")
            : "",

        emergency:
          option
            ? option.getAttribute("data-emergency")
            : "",

        "medical-history":
          option
            ? option.getAttribute(
                "data-medical-history"
              )
            : "",

        allergies:
          option
            ? option.getAttribute("data-allergies")
            : ""
      };


      Object.keys(demoFields).forEach(
        function (key) {

          var target =
            root.querySelector(
              '[data-demo="' +
                key +
                '"]'
            );

          if (!target) return;


          var raw =
            demoFields[key];


          if (key === "height" && raw) {
            raw = raw + " cm";
          }


          if (key === "weight" && raw) {
            raw = raw + " kg";
          }


          target.textContent =
            fmt(raw);
        }
      );


      /* -----------------------------------------------
         CURRENT CLINICAL PARAMETERS
      ------------------------------------------------ */
      var clinicalFields = {

        temp:
          option
            ? option.getAttribute(
                "data-hr-temp"
              )
            : "",

        "heart-rate":
          option
            ? option.getAttribute(
                "data-hr-heart-rate"
              )
            : "",

        spo2:
          option
            ? option.getAttribute(
                "data-hr-spo2"
              )
            : "",

        bp:
          option
            ? option.getAttribute(
                "data-hr-bp"
              )
            : "",

        resp:
          option
            ? option.getAttribute(
                "data-hr-resp"
              )
            : "",

        stress:
          option
            ? option.getAttribute(
                "data-hr-stress"
              )
            : "",

        sleep:
          option
            ? option.getAttribute(
                "data-hr-sleep"
              )
            : "",

        steps:
          option
            ? option.getAttribute(
                "data-hr-steps"
              )
            : ""
      };


      Object.keys(clinicalFields).forEach(
        function (key) {

          var target =
            root.querySelector(
              '[data-clinical="' +
                key +
                '"]'
            );

          if (!target) return;


          var raw =
            clinicalFields[key];


          if (key === "temp" && raw) {
            raw = raw + " °C";
          }


          if (
            key === "heart-rate" &&
            raw
          ) {
            raw = raw + " bpm";
          }


          if (key === "spo2" && raw) {
            raw = raw + " %";
          }


          if (key === "resp" && raw) {
            raw = raw + " br/min";
          }


          if (key === "sleep" && raw) {
            raw = raw + " hrs";
          }


          target.textContent =
            fmt(raw);
        }
      );
    }


    patientSelect.addEventListener(
      "change",
      applySelectedPatient
    );


    /* -----------------------------------------------
       Preselected patient
       (?patient_id=...)
    ------------------------------------------------ */
    if (patientSelect.value) {
      applySelectedPatient();
    }
  }


  /* ---------------------------------------------------------
     MEDICINES
     Add / remove rows
  --------------------------------------------------------- */
/* =========================================================
   MEDICINES — TABLE WORKSPACE
   ========================================================= */

function renumberMedicines(container) {

    var rows = container.querySelectorAll(".medicine-row");

    rows.forEach(function (row, index) {

        var number = row.querySelector(".medicine-number");

        if (number) {
            number.textContent = index + 1;
        }

        /*
         * Update IDs so every dynamically created row
         * remains uniquely identifiable.
         */
        var rowNumber = index + 1;

        var name = row.querySelector('[name="medicine_name[]"]');
        var type = row.querySelector('[name="medicine_type[]"]');
        var dosage = row.querySelector('[name="medicine_dosage[]"]');
        var quantity = row.querySelector('[name="medicine_quantity[]"]');
        var frequency = row.querySelector('[name="medicine_frequency[]"]');
        var takingTime = row.querySelector('[name="medicine_taking_time[]"]');
        var duration = row.querySelector('[name="medicine_duration[]"]');
        var instructions = row.querySelector('[name="medicine_instructions[]"]');

        if (name) {
            name.id = "medicine_name_" + rowNumber;
        }

        if (type) {
            type.id = "medicine_type_" + rowNumber;
        }

        if (dosage) {
            dosage.id = "medicine_dosage_" + rowNumber;
        }

        if (quantity) {
            quantity.id = "medicine_quantity_" + rowNumber;
        }

        if (frequency) {
            frequency.id = "medicine_frequency_" + rowNumber;
        }

        if (takingTime) {
            takingTime.id = "medicine_taking_time_" + rowNumber;
        }

        if (duration) {
            duration.id = "medicine_duration_" + rowNumber;
        }

        if (instructions) {
            instructions.id = "medicine_instructions_" + rowNumber;
        }
    });
}


function initMedicines() {

    var container = document.getElementById("medicineContainer");
    var addBtn = document.getElementById("addMedicineBtn");

    if (!container || !addBtn) {
        return;
    }


    /* =====================================================
       ADD MEDICINE
       ===================================================== */

    addBtn.addEventListener("click", function () {

        var rows = container.querySelectorAll(".medicine-row");

        if (!rows.length) {
            return;
        }

        var template = rows[0];

        var clone = template.cloneNode(true);


        /*
         * Clear all text fields
         */
        clone.querySelectorAll("input, textarea").forEach(function (field) {

            field.value = "";

            field.classList.remove("hr-rxw-invalid");

        });


        /*
         * Reset select
         */
        clone.querySelectorAll("select").forEach(function (field) {

            field.selectedIndex = 0;

            field.classList.remove("hr-rxw-invalid");

        });


        /*
         * Add new row
         */
        container.appendChild(clone);


        /*
         * Re-number all rows
         */
        renumberMedicines(container);


        /*
         * Automatically focus Medicine Name
         */
        var newRows = container.querySelectorAll(".medicine-row");
        var newRow = newRows[newRows.length - 1];

        if (newRow) {

            var medicineName = newRow.querySelector(
                '[name="medicine_name[]"]'
            );

            if (medicineName) {
                medicineName.focus();
            }
        }

    });


    /* =====================================================
       REMOVE MEDICINE
       ===================================================== */

    container.addEventListener("click", function (event) {

        var removeBtn = event.target.closest(
            ".remove-medicine-btn"
        );

        if (!removeBtn) {
            return;
        }


        var rows = container.querySelectorAll(".medicine-row");


        /*
         * Keep minimum one medicine row.
         */
        if (rows.length <= 1) {

            var onlyRow = rows[0];

            if (!onlyRow) {
                return;

            }


            onlyRow.querySelectorAll(
                "input, textarea"
            ).forEach(function (field) {

                field.value = "";
                field.classList.remove("hr-rxw-invalid");

            });


            onlyRow.querySelectorAll(
                "select"
            ).forEach(function (field) {

                field.selectedIndex = 0;
                field.classList.remove("hr-rxw-invalid");

            });


            return;
        }


        /*
         * Remove selected row
         */
        var row = removeBtn.closest(".medicine-row");

        if (row) {
            row.remove();
        }


        /*
         * Re-number remaining rows
         */
        renumberMedicines(container);

    });

}


/* =========================================================
   FILE UPLOADS
   Blood Tests + Scans
   ---------------------------------------------------------
   Source of truth:
   reportState

   Backend field names:
   blood_test_files
   blood_test_start_time[]
   blood_test_end_time[]
   blood_test_remarks[]

   scan_files
   scan_start_time[]
   scan_end_time[]
   scan_remarks[]
========================================================= */


/* ---------------------------------------------------------
   REPORT STATE
--------------------------------------------------------- */

var reportState = {

    blood_test_files: [],
    blood_test_start_time: [],
    blood_test_end_time: [],
    blood_test_remarks: [],

    scan_files: [],
    scan_start_time: [],
    scan_end_time: [],
    scan_remarks: []

};


/* ---------------------------------------------------------
   FILE SIZE
--------------------------------------------------------- */

function formatUploadFileSize(bytes) {

    var size = Number(bytes);

    if (!Number.isFinite(size) || size < 0) {
        return "0 B";
    }

    if (size < 1024) {
        return size + " B";
    }

    if (size < 1024 * 1024) {
        return (size / 1024).toFixed(1) + " KB";
    }

    return (size / (1024 * 1024)).toFixed(1) + " MB";
}


/* ---------------------------------------------------------
   REPORT FORMAT
--------------------------------------------------------- */

function getUploadReportFormat(file) {

    if (!file || !file.name) {
        return "FILE";
    }

    var name =
        file.name.toLowerCase();

    if (name.endsWith(".pdf")) {
        return "PDF";
    }

    if (name.endsWith(".jpg")) {
        return "JPG";
    }

    if (name.endsWith(".jpeg")) {
        return "JPEG";
    }

    if (name.endsWith(".png")) {
        return "PNG";
    }

    return "FILE";
}


/* ---------------------------------------------------------
   REPORT ICON
   Separate name so it does NOT conflict with
   Clinical History getReportIcon(report).
--------------------------------------------------------- */

function getUploadReportIcon(file) {

    var format =
        getUploadReportFormat(file);

    if (format === "PDF") {
        return "fa-solid fa-file-pdf";
    }

    if (
        format === "JPG" ||
        format === "JPEG" ||
        format === "PNG"
    ) {
        return "fa-solid fa-file-image";
    }

    return "fa-solid fa-file-medical";
}


/* ---------------------------------------------------------
   TODAY
--------------------------------------------------------- */

function getReportToday() {

    return new Date().toLocaleDateString(
        "en-GB"
    );
}


/* ---------------------------------------------------------
   GET STATE KEY
--------------------------------------------------------- */

function getReportStatePrefix(inputId) {

    if (inputId === "blood_test_files") {
        return "blood_test";
    }

    return "scan";
}


/* ---------------------------------------------------------
   SYNC STATE -> REAL FILE INPUT
   This makes sure the actual multipart form contains
   the files selected through the workspace.
--------------------------------------------------------- */

function syncReportFileInput(inputId) {

    var input =
        document.getElementById(inputId);

    if (!input) {
        return;
    }

    var prefix =
        getReportStatePrefix(inputId);

    var files =
        reportState[prefix + "_files"] || [];

    try {

        var dataTransfer =
            new DataTransfer();

        files.forEach(function (file) {

            dataTransfer.items.add(file);

        });

        input.files =
            dataTransfer.files;

    } catch (error) {

        console.warn(
            "Unable to sync files for " +
            inputId,
            error
        );
    }
}


/* ---------------------------------------------------------
   RENDER SELECTED FILE LIST
--------------------------------------------------------- */

function renderFileList(inputId) {

    var listId =
        inputId === "blood_test_files"
            ? "bloodTestFileList"
            : "scanFileList";

    var list =
        document.getElementById(listId);

    if (!list) {
        return;
    }

    var prefix =
        getReportStatePrefix(inputId);

    var files =
        reportState[prefix + "_files"] || [];

    list.innerHTML = "";


    files.forEach(function (file, index) {

        var li =
            document.createElement("li");

        li.className =
            "hr-rxw-file-item";


        /* FILE INFO */

        var fileInfo =
            document.createElement("div");

        fileInfo.className =
            "hr-rxw-file-info";


        var icon =
            document.createElement("i");

        icon.className =
            getUploadReportIcon(file);


        var details =
            document.createElement("div");

        details.className =
            "hr-rxw-file-details";


        var fileName =
            document.createElement("span");

        fileName.className =
            "hr-rxw-file-name";

        fileName.textContent =
            file.name;


        var fileSize =
            document.createElement("small");

        fileSize.className =
            "hr-rxw-file-size";

        fileSize.textContent =
            formatUploadFileSize(
                file.size
            );


        details.appendChild(
            fileName
        );

        details.appendChild(
            fileSize
        );

        fileInfo.appendChild(
            icon
        );

        fileInfo.appendChild(
            details
        );


        /* REMOVE */

        var removeButton =
            document.createElement("button");

        removeButton.type =
            "button";

        removeButton.className =
            "hr-rxw-file-remove";

        removeButton.innerHTML =
            "&times;";

        removeButton.title =
            "Remove file";

        removeButton.setAttribute(
            "aria-label",
            "Remove " + file.name
        );

        removeButton.dataset.index =
            index;


        li.appendChild(
            fileInfo
        );

        li.appendChild(
            removeButton
        );

        list.appendChild(
            li
        );

    });
}


/* ---------------------------------------------------------
   ADD SELECTED FILES
--------------------------------------------------------- */

function addSelectedFiles(
    inputId,
    selectedFiles
) {

    var prefix =
        getReportStatePrefix(inputId);

    var filesKey =
        prefix + "_files";

    if (!reportState[filesKey]) {
        reportState[filesKey] = [];
    }


    var existingFiles =
        reportState[filesKey];


    Array.prototype.forEach.call(
        selectedFiles,
        function (file) {

            /*
             * Only PDF/JPG/JPEG/PNG
             */
            var format =
                getUploadReportFormat(file);

            if (
                format !== "PDF" &&
                format !== "JPG" &&
                format !== "JPEG" &&
                format !== "PNG"
            ) {

                alert(
                    file.name +
                    " is not a supported report format."
                );

                return;
            }


            /*
             * Maximum 10 MB
             */
            if (
                file.size >
                10 * 1024 * 1024
            ) {

                alert(
                    file.name +
                    " exceeds the maximum 10 MB file size."
                );

                return;
            }


            /*
             * Prevent exact duplicate selection
             */
            var duplicate =
                existingFiles.some(
                    function (existingFile) {

                        return (
                            existingFile.name ===
                                file.name &&

                            existingFile.size ===
                                file.size &&

                            existingFile.lastModified ===
                                file.lastModified
                        );

                    }
                );


            if (duplicate) {

                return;
            }


            existingFiles.push(
                file
            );


            /*
             * Keep metadata arrays aligned
             */
            reportState[
                prefix + "_start_time"
            ].push("");

            reportState[
                prefix + "_end_time"
            ].push("");

            reportState[
                prefix + "_remarks"
            ].push("");

        }
    );


    syncReportFileInput(
        inputId
    );

    renderFileList(
        inputId
    );

    renderReportsTable();
}
/* ---------------------------------------------------------
   NORMALIZE SAVED REPORT TIME
   Converts database time values into HH:MM
--------------------------------------------------------- */

function normalizeReportTime(value) {

    if (!value) {
        return "";
    }

    var time = String(value).trim();

    /* Already HH:MM */
    if (/^\d{2}:\d{2}$/.test(time)) {
        return time;
    }

    /* HH:MM:SS */
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
        return time.substring(0, 5);
    }

    /* ISO / datetime value */
    if (time.includes("T")) {

        var isoTime =
            time.split("T")[1];

        if (
            isoTime &&
            /^\d{2}:\d{2}/.test(isoTime)
        ) {
            return isoTime.substring(0, 5);
        }
    }

    /* 12-hour format: 10:30 AM */
    var match =
        time.match(
            /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
        );

    if (match) {

        var hour =
            Number(match[1]);

        var minute =
            match[2];

        var period =
            match[3].toUpperCase();

        if (period === "PM" && hour !== 12) {
            hour += 12;
        }

        if (period === "AM" && hour === 12) {
            hour = 0;
        }

        return String(hour).padStart(2, "0")
            + ":"
            + minute;
    }

    return "";
}

/* ---------------------------------------------------------
   REPORT TABLE
--------------------------------------------------------- */

function renderReportsTable() {

    var tableBody =
        document.getElementById(
            "prescriptionReportsTableBody"
        );

    var emptyState =
        document.getElementById(
            "prescriptionReportsEmpty"
        );

    if (
        !tableBody ||
        !emptyState
    ) {
        return;
    }


    /* -----------------------------------------------------
       CLEAR TABLE
    ----------------------------------------------------- */

    tableBody.innerHTML = "";


    var reports = [];


    /* -----------------------------------------------------
       EXISTING DATABASE REPORTS
    ----------------------------------------------------- */

    var existingReports =
        getExistingPrescriptionReports();


    existingReports.forEach(
        function (report) {

            reports.push({

                id: report.id,

                file: null,

                type:
                    report.report_type || "Report",

                fileName:
                    report.original_filename || "Report",

                format:
                    report.file_type || "",

                size:
                    report.file_size || 0,

                startTime:
                    normalizeReportTime(
                    report.report_start_time
              ),

                endTime:
                    normalizeReportTime(
                    report.report_end_time
            ),

                remarks:
                    report.remarks || "",

                uploadedOn:
                    report.uploaded_at || "",

                fileUrl:
                    report.file_url || "",

                isExisting: true

            });

        }
    );


    /* -----------------------------------------------------
       NEW BLOOD TEST REPORTS
    ----------------------------------------------------- */

    reportState.blood_test_files.forEach(
        function (file, index) {

            reports.push({

                file: file,

                type: "Blood Test",

                inputId: "blood_test_files",

                fileIndex: index,

                prefix: "blood_test",

                fileName: file.name,

                format:
                    getUploadReportFormat(file),

                size:
                    file.size,

                startTime:
                    reportState.blood_test_start_time[
                        index
                    ] || "",

                endTime:
                    reportState.blood_test_end_time[
                        index
                    ] || "",

                remarks:
                    reportState.blood_test_remarks[
                        index
                    ] || "",

                uploadedOn:
                    getReportToday(),

                isExisting: false

            });

        }
    );


    /* -----------------------------------------------------
       NEW SCAN REPORTS
    ----------------------------------------------------- */

    reportState.scan_files.forEach(
        function (file, index) {

            reports.push({

                file: file,

                type: "Scan",

                inputId: "scan_files",

                fileIndex: index,

                prefix: "scan",

                fileName: file.name,

                format:
                    getUploadReportFormat(file),

                size:
                    file.size,

                startTime:
                    reportState.scan_start_time[
                        index
                    ] || "",

                endTime:
                    reportState.scan_end_time[
                        index
                    ] || "",

                remarks:
                    reportState.scan_remarks[
                        index
                    ] || "",

                uploadedOn:
                    getReportToday(),

                isExisting: false

            });

        }
    );


    /* -----------------------------------------------------
       EMPTY STATE
    ----------------------------------------------------- */

    if (!reports.length) {

        emptyState.style.display = "flex";

        return;
    }


    emptyState.style.display = "none";


    /* -----------------------------------------------------
       CREATE TABLE ROWS
    ----------------------------------------------------- */

    reports.forEach(
        function (report, index) {

            var row =
                document.createElement("tr");

            row.className =
                "hr-rxw-report-row";


            /* =================================================
               EXISTING REPORT
            ================================================= */

            if (report.isExisting) {

                row.dataset.reportId =
                    report.id;

            }


            /* =================================================
               NEW REPORT
            ================================================= */

            else {

                row.dataset.inputId =
                    report.inputId;

                row.dataset.fileIndex =
                    String(
                        report.fileIndex
                    );

            }


            /* =================================================
               #
            ================================================= */

            var numberCell =
                document.createElement("td");

            numberCell.textContent =
                index + 1;


            /* =================================================
               REPORT TYPE
            ================================================= */

            var typeCell =
                document.createElement("td");

            var typeBadge =
                document.createElement("span");

            typeBadge.className =
                "hr-rxw-report-type " +
                (
                    report.type === "Blood Test"
                        ? "is-blood"
                        : "is-scan"
                );

            typeBadge.textContent =
                report.type;

            typeCell.appendChild(
                typeBadge
            );


            /* =================================================
               FILE NAME
            ================================================= */

            var nameCell =
                document.createElement("td");

            var nameWrapper =
                document.createElement("div");

            nameWrapper.className =
                "hr-rxw-report-file";


            var fileIcon =
                document.createElement("i");


            if (report.file) {

                fileIcon.className =
                    getUploadReportIcon(
                        report.file
                    );

            } else {

                var lowerName =
                    (
                        report.fileName || ""
                    ).toLowerCase();


                if (
                    lowerName.endsWith(".pdf")
                ) {

                    fileIcon.className =
                        "fa-solid fa-file-pdf";

                } else if (
                    lowerName.endsWith(".jpg") ||
                    lowerName.endsWith(".jpeg") ||
                    lowerName.endsWith(".png")
                ) {

                    fileIcon.className =
                        "fa-solid fa-file-image";

                } else {

                    fileIcon.className =
                        "fa-regular fa-file";

                }

            }


            var fileName =
                document.createElement("span");

            fileName.textContent =
                report.fileName;

            fileName.title =
                report.fileName;


            nameWrapper.appendChild(
                fileIcon
            );

            nameWrapper.appendChild(
                fileName
            );

            nameCell.appendChild(
                nameWrapper
            );


            /* =================================================
               FORMAT
            ================================================= */

            var formatCell =
                document.createElement("td");

            if (report.file) {

                formatCell.textContent =
                    getUploadReportFormat(
                        report.file
                    );

            } else {

                formatCell.textContent =
                    report.format || "-";

            }


            /* =================================================
               SIZE
            ================================================= */

            var sizeCell =
                document.createElement("td");


            if (report.file) {

                sizeCell.textContent =
                    formatUploadFileSize(
                        report.file.size
                    );

            } else {

                sizeCell.textContent =
                    formatUploadFileSize(
                        report.size
                    );

            }


            /* =================================================
               START TIME
            ================================================= */

            var startTimeCell =
                document.createElement("td");


            if (report.isExisting) {

                var existingStartTime =
                    document.createElement("input");

                existingStartTime.type = "time";

                existingStartTime.className =
                    "hr-rxw-report-time";

                existingStartTime.value =
                    normalizeReportTime(
                        report.startTime
                    );

                existingStartTime.dataset.reportId =
                    report.id;

                existingStartTime.dataset.existingReport =
                    "true";

                existingStartTime.dataset.metadata =
                    "existing_start_time";

                startTimeCell.appendChild(
                    existingStartTime
                );

            } else {

                var startTimeInput =
                    document.createElement("input");

                startTimeInput.type =
                    "time";

                startTimeInput.className =
                    "hr-rxw-report-time";

                startTimeInput.value =
                    reportState[
                        report.prefix +
                        "_start_time"
                    ][
                        report.fileIndex
                    ] || "";

                startTimeInput.dataset.prefix =
                    report.prefix;

                startTimeInput.dataset.fileIndex =
                    String(
                        report.fileIndex
                    );

                startTimeInput.dataset.metadata =
                    "start_time";

                startTimeCell.appendChild(
                    startTimeInput
                );

            }


            /* =================================================
               END TIME
            ================================================= */

            var endTimeCell =
                document.createElement("td");


            if (report.isExisting) {

    var existingEndTime =
        document.createElement("input");

    existingEndTime.type =
        "time";

    existingEndTime.className =
        "hr-rxw-report-time";

    existingEndTime.value =
        normalizeReportTime(
            report.endTime
        );

    existingEndTime.dataset.reportId =
        report.id;

    existingEndTime.dataset.existingReport =
        "true";

    existingEndTime.dataset.metadata =
        "existing_end_time";

    endTimeCell.appendChild(
        existingEndTime
    );

} else {

    var endTimeInput =
        document.createElement("input");

    endTimeInput.type =
        "time";

    endTimeInput.className =
        "hr-rxw-report-time";

    endTimeInput.value =
        reportState[
            report.prefix +
            "_end_time"
        ][
            report.fileIndex
        ] || "";

    endTimeInput.dataset.prefix =
        report.prefix;

    endTimeInput.dataset.fileIndex =
        String(
            report.fileIndex
        );

    endTimeInput.dataset.metadata =
        "end_time";

    endTimeCell.appendChild(
        endTimeInput
    );
}


            /* =================================================
               REMARKS
            ================================================= */

            var remarksCell =
                document.createElement("td");

            var remarksWrapper =
                document.createElement("div");

            remarksWrapper.className =
                "hr-rxw-report-remarks";


            var remarksInput =
                document.createElement("input");

            remarksInput.type =
                "text";

            remarksInput.className =
                "hr-rxw-report-remarks-input";

            remarksInput.placeholder =
                "Enter remarks";

            remarksInput.value =
                report.remarks || "";


            if (report.isExisting) {

    remarksInput.dataset.reportId =
        report.id;

    remarksInput.dataset.existingReport =
        "true";

    remarksInput.dataset.metadata =
        "existing_remarks";

} else {

    remarksInput.dataset.prefix =
        report.prefix;

    remarksInput.dataset.fileIndex =
        String(
            report.fileIndex
        );

    remarksInput.dataset.metadata =
        "remarks";

}

            var remarksView =
                document.createElement("button");

            remarksView.type =
                "button";

            remarksView.className =
                "hr-rxw-report-view-remarks";

            remarksView.innerHTML =
                '<i class="fa-solid fa-eye"></i> View';

            remarksView.title =
                "View remarks";


            if (report.isExisting) {

                remarksView.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();
                        event.stopPropagation();

                        showExistingReportRemarks(
                            report.fileName,
                            report.remarks
                        );

                    }
                );

            } else {

                remarksView.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();
                        event.stopPropagation();

                        reportState[
                            report.prefix +
                            "_remarks"
                        ][
                            report.fileIndex
                        ] =
                            remarksInput.value || "";


                        viewRemarks(
                            report.prefix,
                            report.fileIndex
                        );

                    }
                );

            }


            remarksWrapper.appendChild(
                remarksInput
            );

            remarksWrapper.appendChild(
                remarksView
            );

            remarksCell.appendChild(
                remarksWrapper
            );


            /* =================================================
               UPLOADED ON
            ================================================= */

            var dateCell =
                document.createElement("td");


            if (report.isExisting) {

                if (report.uploadedOn) {

                    var uploadedDate =
                        new Date(
                            report.uploadedOn
                        );

                    if (
                        !isNaN(
                            uploadedDate.getTime()
                        )
                    ) {

                        dateCell.textContent =
                            uploadedDate.toLocaleDateString(
                                "en-GB"
                            );

                    } else {

                        dateCell.textContent =
                            report.uploadedOn;

                    }

                } else {

                    dateCell.textContent =
                        "-";

                }

            } else {

                dateCell.textContent =
                    getReportToday();

            }


            /* =================================================
               VIEW REPORT
            ================================================= */

            var viewCell =
                document.createElement("td");

            var viewButton =
                document.createElement("button");

            viewButton.type =
                "button";

            viewButton.className =
                "hr-rxw-report-view";

            viewButton.innerHTML =
                '<i class="fa-solid fa-eye"></i> View';

            viewButton.title =
                "View report";

            viewButton.setAttribute(
                "aria-label",
                "View " + report.fileName
            );


            if (report.isExisting) {

                viewButton.dataset.reportId =
                    report.id;

                viewButton.dataset.fileUrl =
                    report.fileUrl || "";


                viewButton.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();
                        event.stopPropagation();

                        if (
                            report.fileUrl
                        ) {

                            window.open(
                                report.fileUrl,
                                "_blank"
                            );

                        } else {

                            alert(
                                "Report file is not available."
                            );

                        }

                    }
                );

            } else {

                viewButton.dataset.inputId =
                    report.inputId;

                viewButton.dataset.fileIndex =
                    String(
                        report.fileIndex
                    );


                viewButton.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();
                        event.stopPropagation();

                        viewReport(
                            report.inputId,
                            report.fileIndex
                        );

                    }
                );

            }


            viewCell.appendChild(
                viewButton
            );


            /* =================================================
               ACTION
            ================================================= */

            var actionCell =
                document.createElement("td");


            if (report.isExisting) {

                var savedIcon =
                    document.createElement("i");

                savedIcon.className =
                    "fa-solid fa-circle-check";

                savedIcon.title =
                    "Already uploaded";

                savedIcon.setAttribute(
                    "aria-label",
                    "Already uploaded"
                );

                actionCell.appendChild(
                    savedIcon
                );

            } else {

                var removeButton =
                    document.createElement("button");

                removeButton.type =
                    "button";

                removeButton.className =
                    "hr-rxw-report-remove";

                removeButton.innerHTML =
                    '<i class="fa-solid fa-trash"></i>';

                removeButton.title =
                    "Remove report";

                removeButton.setAttribute(
                    "aria-label",
                    "Remove " + report.fileName
                );

                removeButton.dataset.inputId =
                    report.inputId;

                removeButton.dataset.fileIndex =
                    String(
                        report.fileIndex
                    );


                removeButton.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();
                        event.stopPropagation();

                        removeReportFile(
                            report.inputId,
                            report.fileIndex
                        );

                    }
                );


                actionCell.appendChild(
                    removeButton
                );

            }


            /* =================================================
               FINAL ROW
            ================================================= */

            row.appendChild(
                numberCell
            );

            row.appendChild(
                typeCell
            );

            row.appendChild(
                nameCell
            );

            row.appendChild(
                formatCell
            );

            row.appendChild(
                sizeCell
            );

            row.appendChild(
                startTimeCell
            );

            row.appendChild(
                endTimeCell
            );

            row.appendChild(
                remarksCell
            );

            row.appendChild(
                dateCell
            );

            row.appendChild(
                viewCell
            );

            row.appendChild(
                actionCell
            );


            /* -------------------------------------------------
               ADD ROW TO TABLE
            ------------------------------------------------- */

            tableBody.appendChild(
                row
            );

        }
    );


   

    /* ---------------------------------------------------------
       BIND METADATA INPUTS
    --------------------------------------------------------- */

    bindReportInputs();

}

/* ---------------------------------------------------------
   BIND REPORT INPUTS
--------------------------------------------------------- */

function bindReportInputs() {

    var tableBody =
        document.getElementById(
            "prescriptionReportsTableBody"
        );

    if (!tableBody) {
        return;
    }


    tableBody
        .querySelectorAll(
            "[data-metadata]"
        )
        .forEach(
            function (input) {

                input.addEventListener(
                    "input",
                    function () {

                        updateReportMetadata(
                            input
                        );

                    }
                );


                input.addEventListener(
                    "change",
                    function () {

                        updateReportMetadata(
                            input
                        );

                    }
                );

            }
        );
}


/* ---------------------------------------------------------
   UPDATE REPORT METADATA
--------------------------------------------------------- */

/* ---------------------------------------------------------
   UPDATE REPORT METADATA
--------------------------------------------------------- */

function updateReportMetadata(input) {

    var metadata =
        input.dataset.metadata;


    /* =====================================================
       EXISTING DATABASE REPORT
    ===================================================== */

    if (
        input.dataset.existingReport === "true"
    ) {

        var reportId =
            input.dataset.reportId;

        if (!reportId) {
            return;
        }


        /*
         * Store edited values on the table row.
         * These can then be collected when the
         * Edit Prescription form is submitted.
         */

        var row =
            input.closest(
                ".hr-rxw-report-row"
            );

        if (!row) {
            return;
        }


        if (!row.dataset.reportMetadata) {

            row.dataset.reportMetadata =
                JSON.stringify({});

        }


        var metadataObject;

        try {

            metadataObject =
                JSON.parse(
                    row.dataset.reportMetadata
                );

        } catch (error) {

            metadataObject = {};

        }


        if (
            metadata === "existing_start_time"
        ) {

            metadataObject.start_time =
                input.value || "";

        }


        else if (
            metadata === "existing_end_time"
        ) {

            metadataObject.end_time =
                input.value || "";

        }


        else if (
            metadata === "existing_remarks"
        ) {

            metadataObject.remarks =
                input.value || "";

        }


        row.dataset.reportMetadata =
            JSON.stringify(
                metadataObject
            );

        return;
    }


    /* =====================================================
       NEW UPLOADED REPORT
    ===================================================== */

    var prefix =
        input.dataset.prefix;

    var fileIndex =
        Number(
            input.dataset.fileIndex
        );


    if (
        !prefix ||
        !Number.isInteger(fileIndex)
    ) {
        return;
    }


    if (
        metadata === "start_time"
    ) {

        reportState[
            prefix + "_start_time"
        ][fileIndex] =
            input.value || "";

        return;
    }


    if (
        metadata === "end_time"
    ) {

        reportState[
            prefix + "_end_time"
        ][fileIndex] =
            input.value || "";

        return;
    }


    if (
        metadata === "remarks"
    ) {

        reportState[
            prefix + "_remarks"
        ][fileIndex] =
            input.value || "";

    }
}
/* ---------------------------------------------------------
   VIEW ACTUAL REPORT
   PDF / IMAGE
--------------------------------------------------------- */

function viewReport(inputId, fileIndex) {

    console.log(
        "viewReport() called:",
        inputId,
        fileIndex
    );


    /* -------------------------------------------------------
       Validate input
    ------------------------------------------------------- */

    if (!inputId) {

        alert(
            "Report input was not identified."
        );

        return;
    }


    if (
        fileIndex === undefined ||
        fileIndex === null ||
        Number.isNaN(Number(fileIndex))
    ) {

        alert(
            "Report file index is invalid."
        );

        return;
    }


    fileIndex =
        Number(fileIndex);


    /* -------------------------------------------------------
       Find correct report prefix
    ------------------------------------------------------- */

    var prefix =
        getReportStatePrefix(inputId);


    console.log(
        "Report prefix:",
        prefix
    );


    if (!prefix) {

        alert(
            "Unable to identify report type."
        );

        return;
    }


    /* -------------------------------------------------------
       Get files
    ------------------------------------------------------- */

    var files =
        reportState[
            prefix + "_files"
        ];


    console.log(
        "Report files:",
        files
    );


    if (
        !files ||
        !files[fileIndex]
    ) {

        alert(
            "Report file is not available."
        );

        return;
    }


    var file =
        files[fileIndex];


    /* -------------------------------------------------------
       Make sure this is a real File / Blob
    ------------------------------------------------------- */

    if (
        !(file instanceof Blob)
    ) {

        alert(
            "The selected report cannot be previewed."
        );

        return;
    }


    /* -------------------------------------------------------
       Create temporary browser URL
    ------------------------------------------------------- */

    var fileUrl =
        URL.createObjectURL(file);


    console.log(
        "Preview URL created:",
        fileUrl
    );


    /* -------------------------------------------------------
       Open report
    ------------------------------------------------------- */

    var previewWindow =
        window.open(
            fileUrl,
            "_blank"
        );


    /* -------------------------------------------------------
       Popup blocked
    ------------------------------------------------------- */

    if (!previewWindow) {

        URL.revokeObjectURL(
            fileUrl
        );

        alert(
            "Please allow pop-ups in your browser to preview the report."
        );

        return;
    }


    /* -------------------------------------------------------
       Focus preview
    ------------------------------------------------------- */

    try {

        previewWindow.focus();

    } catch (error) {

        console.warn(
            "Unable to focus preview window:",
            error
        );
    }


    /* -------------------------------------------------------
       Release object URL later
    ------------------------------------------------------- */

    setTimeout(
        function () {

            URL.revokeObjectURL(
                fileUrl
            );

        },
        60000
    );
}
/* ---------------------------------------------------------
   VIEW REMARKS
--------------------------------------------------------- */

function viewRemarks(
    prefix,
    fileIndex
) {

    if (
        !reportState[
            prefix + "_files"
        ] ||
        !reportState[
            prefix + "_files"
        ][fileIndex]
    ) {
        return;
    }


    var file =
        reportState[
            prefix + "_files"
        ][fileIndex];


    var remarks =
        reportState[
            prefix + "_remarks"
        ][fileIndex] || "";


    showRemarksModal(
        prefix,
        fileIndex,
        file.name,
        remarks
    );
}


/* ---------------------------------------------------------
   REMARKS MODAL
--------------------------------------------------------- */

function showRemarksModal(
    prefix,
    fileIndex,
    fileName,
    remarks
) {

    var existing =
        document.getElementById(
            "prescriptionReportRemarksModal"
        );

    if (existing) {
        existing.remove();
    }


    /* -----------------------------------------------------
       OVERLAY
    ----------------------------------------------------- */

    var overlay =
        document.createElement("div");

    overlay.id =
        "prescriptionReportRemarksModal";

    overlay.className =
        "hr-rxw-report-modal";


    /* -----------------------------------------------------
       DIALOG
    ----------------------------------------------------- */

    var dialog =
        document.createElement("div");

    dialog.className =
        "hr-rxw-report-modal-dialog";


    /* -----------------------------------------------------
       HEADER
    ----------------------------------------------------- */

    var header =
        document.createElement("div");

    header.className =
        "hr-rxw-report-modal-header";


    var title =
        document.createElement("div");

    title.className =
        "hr-rxw-report-modal-title";


    var titleIcon =
        document.createElement("i");

    titleIcon.className =
        "fa-solid fa-note-sticky";


    var titleText =
        document.createElement("span");

    titleText.textContent =
        "Report Remarks";


    title.appendChild(
        titleIcon
    );

    title.appendChild(
        titleText
    );


    /* -----------------------------------------------------
       HEADER CLOSE BUTTON
    ----------------------------------------------------- */

    var closeButton =
        document.createElement("button");

    closeButton.type =
        "button";

    closeButton.className =
        "hr-rxw-report-modal-close";

    closeButton.innerHTML =
        "&times;";

    closeButton.setAttribute(
        "aria-label",
        "Close remarks"
    );


    header.appendChild(
        title
    );

    header.appendChild(
        closeButton
    );


    /* -----------------------------------------------------
       BODY
    ----------------------------------------------------- */

    var body =
        document.createElement("div");

    body.className =
        "hr-rxw-report-modal-body";


    /* -----------------------------------------------------
       FILE NAME
    ----------------------------------------------------- */

    var fileLabel =
        document.createElement("div");

    fileLabel.className =
        "hr-rxw-report-modal-file";


    var fileIcon =
        document.createElement("i");

    fileIcon.className =
        "fa-solid fa-file-medical";


    var fileText =
        document.createElement("span");

    fileText.textContent =
        fileName;


    fileLabel.appendChild(
        fileIcon
    );

    fileLabel.appendChild(
        fileText
    );


    /* -----------------------------------------------------
       REMARKS LABEL
    ----------------------------------------------------- */

    var remarksLabel =
        document.createElement("div");

    remarksLabel.className =
        "hr-rxw-report-modal-label";

    remarksLabel.textContent =
        "Doctor's Remarks";


    /* -----------------------------------------------------
       REMARKS TEXTAREA
    ----------------------------------------------------- */

    var remarksContent =
        document.createElement("textarea");

    remarksContent.className =
        "hr-rxw-report-modal-content";

    remarksContent.value =
        remarks || "";

    remarksContent.placeholder =
        "Enter doctor's remarks...";

    remarksContent.rows =
        4;


    body.appendChild(
        fileLabel
    );

    body.appendChild(
        remarksLabel
    );

    body.appendChild(
        remarksContent
    );


    /* -----------------------------------------------------
       FOOTER
    ----------------------------------------------------- */

    var footer =
        document.createElement("div");

    footer.className =
        "hr-rxw-report-modal-footer";


    var saveButton =
        document.createElement("button");

    saveButton.type =
        "button";

    saveButton.className =
        "hr-rxw-report-modal-footer-save";

    saveButton.textContent =
        "Save";


    footer.appendChild(
        saveButton
    );


    /* -----------------------------------------------------
       BUILD MODAL
    ----------------------------------------------------- */

    dialog.appendChild(
        header
    );

    dialog.appendChild(
        body
    );

    dialog.appendChild(
        footer
    );


    overlay.appendChild(
        dialog
    );


    document.body.appendChild(
        overlay
    );


    /* -----------------------------------------------------
       CLOSE MODAL
    ----------------------------------------------------- */

    function closeModal() {

        overlay.remove();

        document.removeEventListener(
            "keydown",
            escapeHandler
        );
    }


    function escapeHandler(event) {

        if (
            event.key ===
            "Escape"
        ) {
            closeModal();
        }
    }


    closeButton.addEventListener(
        "click",
        closeModal
    );


    /* -----------------------------------------------------
       SAVE REMARKS
    ----------------------------------------------------- */

    saveButton.addEventListener(
        "click",
        function () {

            var newRemarks =
                remarksContent.value.trim();


            if (
                !reportState[
                    prefix + "_remarks"
                ]
            ) {
                reportState[
                    prefix + "_remarks"
                ] = [];
            }


            reportState[
                prefix + "_remarks"
            ][fileIndex] =
                newRemarks;


            /*
             * Re-render report table so the
             * updated remarks are reflected.
             */

            renderReportsTable();


            /*
             * Close popup after saving.
             */

            closeModal();
        }
    );


    /* -----------------------------------------------------
       CLICK OUTSIDE TO CLOSE
    ----------------------------------------------------- */

    overlay.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                overlay
            ) {
                closeModal();
            }

        }
    );


    /* -----------------------------------------------------
       ESCAPE KEY
    ----------------------------------------------------- */

    document.addEventListener(
        "keydown",
        escapeHandler
    );
}


/* ---------------------------------------------------------
   ADD HIDDEN FORM INPUT
--------------------------------------------------------- */

function addReportHiddenInput(
    form,
    name,
    value
) {

    var input =
        document.createElement("input");

    input.type =
        "hidden";

    input.name =
        name;

    input.value =
        value || "";

    input.dataset.reportMetadata =
        "true";

    form.appendChild(
        input
    );
}


/* ---------------------------------------------------------
   SYNC REPORT METADATA TO FORM
   Backend receives:
   blood_test_start_time[]
   blood_test_end_time[]
   blood_test_remarks[]

   scan_start_time[]
   scan_end_time[]
   scan_remarks[]
--------------------------------------------------------- */

function syncMetadataToForm() {

    var form =
        document.getElementById(
            "prescriptionForm"
        );

    if (!form) {
        return;
    }


    /*
     * Remove previously generated hidden inputs.
     * Prevents duplicates if submit handler runs again.
     */
    form.querySelectorAll(
        'input[data-report-metadata="true"]'
    ).forEach(
        function (input) {

            input.remove();

        }
    );


    /* -----------------------------------------------
       BLOOD TEST — NEW FILES
    ------------------------------------------------ */

    reportState.blood_test_files.forEach(
        function (file, index) {

            addReportHiddenInput(
                form,
                "blood_test_start_time[]",
                reportState.blood_test_start_time[index] || ""
            );

            addReportHiddenInput(
                form,
                "blood_test_end_time[]",
                reportState.blood_test_end_time[index] || ""
            );

            addReportHiddenInput(
                form,
                "blood_test_remarks[]",
                reportState.blood_test_remarks[index] || ""
            );

        }
    );


    /* -----------------------------------------------
       SCANS — NEW FILES
    ------------------------------------------------ */

    reportState.scan_files.forEach(
        function (file, index) {

            addReportHiddenInput(
                form,
                "scan_start_time[]",
                reportState.scan_start_time[index] || ""
            );

            addReportHiddenInput(
                form,
                "scan_end_time[]",
                reportState.scan_end_time[index] || ""
            );

            addReportHiddenInput(
                form,
                "scan_remarks[]",
                reportState.scan_remarks[index] || ""
            );

        }
    );


    /* -----------------------------------------------
       EXISTING SAVED REPORTS
       Doctor Edit
    ------------------------------------------------ */

    var existingReportRows =
        document.querySelectorAll(
            "#prescriptionReportsTableBody .hr-rxw-report-row"
        );


    existingReportRows.forEach(
        function (row) {

            var startTimeInput =
                row.querySelector(
                    '[data-existing-report="true"][data-metadata="existing_start_time"]'
                );

            if (!startTimeInput) {
                return;
            }


            var reportId =
                startTimeInput.dataset.reportId || "";


            if (!reportId) {
                return;
            }


            var endTimeInput =
                row.querySelector(
                    '[data-existing-report="true"][data-metadata="existing_end_time"]'
                );


            var remarksInput =
                row.querySelector(
                    '[data-existing-report="true"][data-metadata="existing_remarks"]'
                );


            /* -------------------------------------------
               REPORT ID
            ------------------------------------------- */

            addReportHiddenInput(
                form,
                "existing_report_id[]",
                reportId
            );


            /* -------------------------------------------
               START TIME
            ------------------------------------------- */

            addReportHiddenInput(
                form,
                "existing_report_start_time[]",
                startTimeInput.value || ""
            );


            /* -------------------------------------------
               END TIME
            ------------------------------------------- */

            addReportHiddenInput(
                form,
                "existing_report_end_time[]",
                endTimeInput
                    ? endTimeInput.value || ""
                    : ""
            );


            /* -------------------------------------------
               DOCTOR REMARKS
            ------------------------------------------- */

            addReportHiddenInput(
                form,
                "existing_report_remarks[]",
                remarksInput
                    ? remarksInput.value || ""
                    : ""
            );

        }
    );
}
/* ---------------------------------------------------------
   FILE INPUT INITIALIZATION
--------------------------------------------------------- */

function initFileInput(
    inputId
) {

    var input =
        document.getElementById(
            inputId
        );

    if (!input) {
        return;
    }


    /*
     * File selection
     */
    input.addEventListener(
        "change",
        function () {

            /*
             * IMPORTANT:
             * Append selected files instead of replacing
             * existing workspace files.
             */
            addSelectedFiles(
                inputId,
                input.files
            );

        }
    );


    var listId =
        inputId === "blood_test_files"
            ? "bloodTestFileList"
            : "scanFileList";


    var list =
        document.getElementById(
            listId
        );


    if (!list) {
        return;
    }


    /*
     * Remove from selected file list
     */
    list.addEventListener(
        "click",
        function (event) {

            var removeButton =
                event.target.closest(
                    ".hr-rxw-file-remove"
                );


            if (!removeButton) {
                return;
            }


            var removeIndex =
                Number(
                    removeButton.dataset.index
                );


            removeReportFile(
                inputId,
                removeIndex
            );

        }
    );


    /*
     * Initial rendering
     */
    renderFileList(
        inputId
    );
}


/* ---------------------------------------------------------
   REPORT TABLE ACTIONS
--------------------------------------------------------- */

/* ---------------------------------------------------------
   REPORT TABLE ACTIONS
--------------------------------------------------------- */

function initReportTableActions() {

    var tableBody =
        document.getElementById(
            "prescriptionReportsTableBody"
        );

    if (!tableBody) {
        return;
    }


    tableBody.addEventListener(
        "click",
        function (event) {

            /* =================================================
               FIND ACTUAL CLICKED BUTTON
            ================================================= */

            var button =
                event.target.closest("button");

            if (!button) {
                return;
            }


            /* =================================================
               REMOVE REPORT
            ================================================= */

            if (
                button.classList.contains(
                    "hr-rxw-report-remove"
                )
            ) {

                event.preventDefault();
                event.stopPropagation();


                var removeInputId =
                    button.getAttribute(
                        "data-input-id"
                    );

                var removeFileIndex =
                    Number(
                        button.getAttribute(
                            "data-file-index"
                        )
                    );


                if (
                    !removeInputId ||
                    !Number.isInteger(
                        removeFileIndex
                    )
                ) {
                    return;
                }


                removeReportFile(
                    removeInputId,
                    removeFileIndex
                );

                return;
            }


            /* =================================================
               VIEW ACTUAL REPORT
               PDF / JPG / JPEG / PNG
            ================================================= */

            if (
                button.classList.contains(
                    "hr-rxw-report-view"
                )
            ) {

                event.preventDefault();
                event.stopPropagation();


                var viewInputId =
                    button.getAttribute(
                        "data-input-id"
                    );

                var viewFileIndex =
                    Number(
                        button.getAttribute(
                            "data-file-index"
                        )
                    );


                console.log(
                    "REPORT VIEW CLICK:",
                    {
                        inputId: viewInputId,
                        fileIndex: viewFileIndex
                    }
                );


                if (
                    !viewInputId ||
                    !Number.isInteger(
                        viewFileIndex
                    )
                ) {

                    alert(
                        "Unable to identify the selected report."
                    );

                    return;
                }


                viewReport(
                    viewInputId,
                    viewFileIndex
                );

                return;
            }


            /* =================================================
               VIEW REMARKS
            ================================================= */

            if (
                button.classList.contains(
                    "hr-rxw-report-view-remarks"
                )
            ) {

                event.preventDefault();
                event.stopPropagation();


                var remarksPrefix =
                    button.getAttribute(
                        "data-prefix"
                    );

                var remarksFileIndex =
                    Number(
                        button.getAttribute(
                            "data-file-index"
                        )
                    );


                console.log(
                    "REMARKS VIEW CLICK:",
                    {
                        prefix: remarksPrefix,
                        fileIndex: remarksFileIndex
                    }
                );


                if (
                    !remarksPrefix ||
                    !Number.isInteger(
                        remarksFileIndex
                    )
                ) {

                    alert(
                        "Unable to identify the report remarks."
                    );

                    return;
                }


                /* ---------------------------------------------
                   Get current row
                --------------------------------------------- */

                var row =
                    button.closest(
                        ".hr-rxw-report-row"
                    );


                /* ---------------------------------------------
                   Save latest typed remark
                --------------------------------------------- */

                if (row) {

                    var remarksInput =
                        row.querySelector(
                            ".hr-rxw-report-remarks-input"
                        );


                    if (remarksInput) {

                        if (
                            !reportState[
                                remarksPrefix +
                                "_remarks"
                            ]
                        ) {

                            reportState[
                                remarksPrefix +
                                "_remarks"
                            ] = [];
                        }


                        reportState[
                            remarksPrefix +
                            "_remarks"
                        ][remarksFileIndex] =
                            remarksInput.value || "";
                    }
                }


                /* ---------------------------------------------
                   OPEN REMARKS MODAL
                --------------------------------------------- */

                viewRemarks(
                    remarksPrefix,
                    remarksFileIndex
                );

                return;
            }

        }
    );
}

/* ---------------------------------------------------------
   FORM SUBMIT
   Sync metadata immediately before POST.
--------------------------------------------------------- */

function initReportFormSubmit() {

    var form =
        document.getElementById(
            "prescriptionForm"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        function () {

            document
                .querySelectorAll(
                    "#prescriptionReportsTableBody [data-metadata]"
                )
                .forEach(
                    function (input) {

                        updateReportMetadata(
                            input
                        );

                    }
                );

            syncReportFileInput(
                "blood_test_files"
            );

            syncReportFileInput(
                "scan_files"
            );

            syncMetadataToForm();

        }
    );
}

/* ---------------------------------------------------------
   INIT UPLOADS
--------------------------------------------------------- */

function initUploads() {

    initFileInput(
        "blood_test_files"
    );


    initFileInput(
        "scan_files"
    );


    initReportTableActions();


    initReportFormSubmit();


    /*
     * Initial table state
     */
    renderReportsTable();
}


  /* =========================================================
   HEALTH RING — CLINICAL HISTORY
   Professional Clinical History Renderer
========================================================= */

function initClinicalHistory() {

    var historyBtn =
        document.getElementById("viewClinicalHistoryBtn");

    if (!historyBtn) {
        return;
    }


    historyBtn.addEventListener("click", async function () {

        var patientSelect =
            document.getElementById("patient_id");


        if (!patientSelect || !patientSelect.value) {

            alert("Please select a patient first.");

            return;
        }


        var patientId =
            patientSelect.value;


        var selectedOption =
            patientSelect.options[
                patientSelect.selectedIndex
            ];


        var patientName =
            selectedOption
                ? selectedOption.getAttribute("data-name")
                : "";


        var patientCode =
            selectedOption
                ? selectedOption.getAttribute("data-code")
                : "";


        if (!patientName) {

            patientName =
                selectedOption
                    ? selectedOption.textContent.trim()
                    : "Patient";
        }


        var modalElement =
            document.getElementById(
                "clinicalHistoryModal"
            );


        var loadingElement =
            document.getElementById(
                "clinicalHistoryLoading"
            );


        var errorElement =
            document.getElementById(
                "clinicalHistoryError"
            );


        var emptyElement =
            document.getElementById(
                "clinicalHistoryEmpty"
            );


        var listElement =
            document.getElementById(
                "clinicalHistoryList"
            );


        var patientElement =
            document.getElementById(
                "clinicalHistoryPatient"
            );


        if (!modalElement) {

            console.error(
                "clinicalHistoryModal not found."
            );

            alert(
                "History window is not available."
            );

            return;
        }


        /* -----------------------------------------------------
           PATIENT HEADER
        ----------------------------------------------------- */

        if (patientElement) {

            patientElement.textContent =
                patientName +
                (
                    patientCode
                        ? " • " + patientCode
                        : ""
                );
        }


        /* -----------------------------------------------------
           RESET UI
        ----------------------------------------------------- */

        if (loadingElement) {

            loadingElement.classList.remove(
                "d-none"
            );
        }


        if (errorElement) {

            errorElement.classList.add(
                "d-none"
            );

            errorElement.textContent = "";
        }


        if (emptyElement) {

            emptyElement.classList.add(
                "d-none"
            );
        }


        if (listElement) {

            listElement.innerHTML = "";
        }


        /* -----------------------------------------------------
           BOOTSTRAP CHECK
        ----------------------------------------------------- */

        if (
            typeof bootstrap ===
            "undefined"
        ) {

            console.error(
                "Bootstrap JS is not loaded."
            );

            if (loadingElement) {

                loadingElement.classList.add(
                    "d-none"
                );
            }


            if (errorElement) {

                errorElement.textContent =
                    "Bootstrap JS is not loaded.";

                errorElement.classList.remove(
                    "d-none"
                );
            }

            return;
        }


        var historyModal =
            bootstrap.Modal.getOrCreateInstance(
                modalElement
            );


        historyModal.show();


        /* -----------------------------------------------------
           FETCH HISTORY
        ----------------------------------------------------- */

        try {

            var response =
                await fetch(
                    "/prescription/doctor/history/" +
                    encodeURIComponent(
                        patientId
                    ),
                    {
                        method: "GET",

                        headers: {
                            "Accept":
                                "application/json"
                        },

                        credentials:
                            "same-origin"
                    }
                );


            var data;


            try {

                data =
                    await response.json();

            } catch (jsonError) {

                throw new Error(
                    "Invalid response from server."
                );
            }


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to load previous history."
                );
            }


            if (loadingElement) {

                loadingElement.classList.add(
                    "d-none"
                );
            }


            var history =
                Array.isArray(data.history)
                    ? data.history
                    : [];


            /* -------------------------------------------------
               EMPTY HISTORY
            ------------------------------------------------- */

            if (!history.length) {

                if (emptyElement) {

                    emptyElement.classList.remove(
                        "d-none"
                    );
                }

                return;
            }


            /* -------------------------------------------------
               RENDER HISTORY
            ------------------------------------------------- */

            if (listElement) {

                history.forEach(
                    function (record) {

                        var card =
                            buildHistoryCard(
                                record
                            );

                        listElement.appendChild(
                            card
                        );
                    }
                );
            }


        } catch (error) {

            console.error(
                "Clinical history error:",
                error
            );


            if (loadingElement) {

                loadingElement.classList.add(
                    "d-none"
                );
            }


            if (errorElement) {

                errorElement.textContent =
                    error.message ||
                    "Unable to load previous history.";

                errorElement.classList.remove(
                    "d-none"
                );
            }
        }

    });

}



/* =========================================================
   HISTORY CARD
========================================================= */

function buildHistoryCard(record) {

    var card =
        document.createElement("article");

    card.className =
        "hr-history-card";


    /* -----------------------------------------------------
       CARD HEADER
    ----------------------------------------------------- */

    var header =
        document.createElement("div");

    header.className =
        "hr-history-card-header";


    var headerLeft =
        document.createElement("div");

    headerLeft.className =
        "hr-history-header-left";


    /* Prescription number */

    if (record.prescription_id) {

        var prescriptionNo =
            document.createElement("div");

        prescriptionNo.className =
            "hr-history-prescription-no";

        prescriptionNo.textContent =
            "PRESCRIPTION #" +
            record.prescription_id;

        headerLeft.appendChild(
            prescriptionNo
        );
    }


    /* Date */

    var date =
        document.createElement("div");

    date.className =
        "hr-history-date";


    var calendarIcon =
        document.createElement("i");

    calendarIcon.className =
        "fa-regular fa-calendar";


    date.appendChild(
        calendarIcon
    );


    date.appendChild(
        document.createTextNode(
            formatHistoryDate(
                record.prescribed_date
            )
        )
    );


    headerLeft.appendChild(
        date
    );


    /* Status */

    var status =
        document.createElement("span");

    status.className =
        "hr-history-status " +
        getHistoryStatusClass(
            record.status
        );


    status.textContent =
        record.status ||
        "Active";


    header.appendChild(
        headerLeft
    );


    header.appendChild(
        status
    );


    /* -----------------------------------------------------
       BODY
    ----------------------------------------------------- */

    var body =
        document.createElement("div");

    body.className =
        "hr-history-card-body";


    /* -----------------------------------------------------
       DIAGNOSIS
    ----------------------------------------------------- */

    if (record.diagnosis) {

        body.appendChild(
            createDiagnosisBlock(
                record.diagnosis
            )
        );
    }


    /* -----------------------------------------------------
       CLINICAL ANALYSIS
    ----------------------------------------------------- */

    if (record.current_analysis) {

        body.appendChild(
            createHistoryPanel(
                "Clinical Analysis",
                "fa-solid fa-stethoscope",
                record.current_analysis
            )
        );
    }


    /* -----------------------------------------------------
       CLINICAL PARAMETERS
    ----------------------------------------------------- */

    if (record.clinical_data) {

        var clinical =
            record.clinical_data;


        var clinicalPanel =
            createClinicalPanel(
                clinical
            );


        if (clinicalPanel) {

            body.appendChild(
                clinicalPanel
            );
        }
    }


    /* -----------------------------------------------------
       MEDICINES
    ----------------------------------------------------- */

    if (
        Array.isArray(
            record.medicines
        ) &&
        record.medicines.length
    ) {

        body.appendChild(
            createMedicinePanel(
                record.medicines
            )
        );
    }


    /* -----------------------------------------------------
       REPORTS
    ----------------------------------------------------- */

    if (
        Array.isArray(
            record.reports
        ) &&
        record.reports.length
    ) {

        body.appendChild(
            createReportPanel(
                record.reports
            )
        );
    }


    /* -----------------------------------------------------
       FOLLOW-UP
    ----------------------------------------------------- */

    if (record.follow_up) {

        var followUp =
            record.follow_up;


        if (
            followUp.date ||
            followUp.time ||
            followUp.notes
        ) {

            body.appendChild(
                createFollowUpPanel(
                    followUp
                )
            );
        }
    }


    /* -----------------------------------------------------
       APPOINTMENT
    ----------------------------------------------------- */

    if (record.appointment) {

        var appointment =
            record.appointment;


        if (
            appointment.date ||
            appointment.time ||
            appointment.status
        ) {

            body.appendChild(
                createAppointmentPanel(
                    appointment
                )
            );
        }
    }


    card.appendChild(
        header
    );


    card.appendChild(
        body
    );


    return card;
}



/* =========================================================
   DIAGNOSIS BLOCK
========================================================= */

function createDiagnosisBlock(
    diagnosis
) {

    var wrapper =
        document.createElement("div");

    wrapper.className =
        "hr-history-diagnosis";


    var heading =
        document.createElement("div");

    heading.className =
        "hr-history-diagnosis-heading";


    var icon =
        document.createElement("i");

    icon.className =
        "fa-solid fa-notes-medical";


    var title =
        document.createElement("span");

    title.textContent =
        "Diagnosis";


    heading.appendChild(
        icon
    );


    heading.appendChild(
        title
    );


    var value =
        document.createElement("div");

    value.className =
        "hr-history-diagnosis-value";

    value.textContent =
        diagnosis;


    wrapper.appendChild(
        heading
    );


    wrapper.appendChild(
        value
    );


    return wrapper;
}



/* =========================================================
   GENERIC HISTORY PANEL
========================================================= */

function createHistoryPanel(
    title,
    iconClass,
    value
) {

    var panel =
        document.createElement("section");

    panel.className =
        "hr-history-panel";


    var heading =
        createHistoryPanelHeading(
            title,
            iconClass
        );


    var content =
        document.createElement("div");

    content.className =
        "hr-history-analysis";


    content.textContent =
        value;


    panel.appendChild(
        heading
    );


    panel.appendChild(
        content
    );


    return panel;
}



/* =========================================================
   PANEL HEADING
========================================================= */

function createHistoryPanelHeading(
    title,
    iconClass
) {

    var heading =
        document.createElement("div");

    heading.className =
        "hr-history-panel-heading";


    var icon =
        document.createElement("i");

    icon.className =
        iconClass;


    var text =
        document.createElement("span");

    text.textContent =
        title;


    heading.appendChild(
        icon
    );


    heading.appendChild(
        text
    );


    return heading;
}



/* =========================================================
   CLINICAL PARAMETERS
========================================================= */

function createClinicalPanel(
    clinical
) {

    var items = [];


    addClinicalItem(
        items,
        "Temperature",
        clinical.temperature,
        "°C",
        "fa-temperature-half"
    );


    addClinicalItem(
        items,
        "Heart Rate",
        clinical.heart_rate,
        "bpm",
        "fa-heart-pulse"
    );


    addClinicalItem(
        items,
        "SpO₂",
        clinical.spo2,
        "%",
        "fa-lungs"
    );


    var bpValue = null;


    if (
        clinical.blood_pressure_systolic !==
            null &&
        clinical.blood_pressure_systolic !==
            undefined &&
        clinical.blood_pressure_systolic !== "" &&

        clinical.blood_pressure_diastolic !==
            null &&
        clinical.blood_pressure_diastolic !==
            undefined &&
        clinical.blood_pressure_diastolic !== ""
    ) {

        bpValue =
            clinical.blood_pressure_systolic +
            "/" +
            clinical.blood_pressure_diastolic;
    }


    addClinicalItem(
        items,
        "Blood Pressure",
        bpValue,
        "mmHg",
        "fa-heart"
    );


    addClinicalItem(
        items,
        "Respiratory Rate",
        clinical.respiratory_rate,
        "br/min",
        "fa-wind"
    );


    addClinicalItem(
        items,
        "Stress",
        clinical.stress,
        "",
        "fa-face-meh"
    );


    addClinicalItem(
        items,
        "Sleep",
        clinical.sleep_hours,
        "hrs",
        "fa-bed"
    );


    addClinicalItem(
        items,
        "Steps",
        clinical.steps,
        "",
        "fa-shoe-prints"
    );


    if (!items.length) {

        return null;
    }


    var panel =
        document.createElement("section");

    panel.className =
        "hr-history-panel";


    panel.appendChild(
        createHistoryPanelHeading(
            "Clinical Parameters",
            "fa-solid fa-chart-line"
        )
    );


    var grid =
        document.createElement("div");

    grid.className =
        "hr-history-vitals-grid";


    items.forEach(
        function (item) {

            grid.appendChild(
                item
            );
        }
    );


    panel.appendChild(
        grid
    );


    return panel;
}



/* =========================================================
   CLINICAL ITEM
========================================================= */

function addClinicalItem(
    items,
    label,
    value,
    suffix,
    icon
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return;
    }


    var item =
        document.createElement("div");

    item.className =
        "hr-history-vital";


    var iconWrap =
        document.createElement("div");

    iconWrap.className =
        "hr-history-vital-icon";


    var iconElement =
        document.createElement("i");

    iconElement.className =
        "fa-solid " + icon;


    iconWrap.appendChild(
        iconElement
    );


    var content =
        document.createElement("div");

    content.className =
        "hr-history-vital-content";


    var labelElement =
        document.createElement("span");

    labelElement.className =
        "hr-history-vital-label";

    labelElement.textContent =
        label;


    var valueElement =
        document.createElement("strong");

    valueElement.className =
        "hr-history-vital-value";


    valueElement.textContent =
        value +
        (
            suffix
                ? " " + suffix
                : ""
        );


    content.appendChild(
        labelElement
    );


    content.appendChild(
        valueElement
    );


    item.appendChild(
        iconWrap
    );


    item.appendChild(
        content
    );


    items.push(
        item
    );
}



/* =========================================================
   MEDICINES
========================================================= */

function createMedicinePanel(
    medicines
) {

    var panel =
        document.createElement("section");

    panel.className =
        "hr-history-panel";


    panel.appendChild(
        createHistoryPanelHeading(
            "Medicines",
            "fa-solid fa-pills"
        )
    );


    var list =
        document.createElement("div");

    list.className =
        "hr-history-medicine-list";


    medicines.forEach(
        function (
            medicine,
            index
        ) {

            var row =
                document.createElement("div");

            row.className =
                "hr-history-medicine-row";


            /* Number */

            var number =
                document.createElement("div");

            number.className =
                "hr-history-medicine-number";

            number.textContent =
                String(index + 1);


            /* Main */

            var main =
                document.createElement("div");

            main.className =
                "hr-history-medicine-main";


            var top =
                document.createElement("div");

            top.className =
                "hr-history-medicine-top";


            var name =
                document.createElement("strong");

            name.className =
                "hr-history-medicine-name";

            name.textContent =
                medicine.medicine_name ||
                "Medicine";


            top.appendChild(
                name
            );


            if (medicine.medicine_type) {

                var type =
                    document.createElement("span");

                type.className =
                    "hr-history-medicine-type";

                type.textContent =
                    medicine.medicine_type;

                top.appendChild(
                    type
                );
            }


            main.appendChild(
                top
            );


            /* Details */

            var details =
                document.createElement("div");

            details.className =
                "hr-history-medicine-details";


            addMedicineDetail(
                details,
                "Dosage",
                medicine.dosage
            );


            addMedicineDetail(
                details,
                "Quantity",
                medicine.quantity
            );


            addMedicineDetail(
                details,
                "Frequency",
                medicine.frequency
            );


            addMedicineDetail(
                details,
                "Taking Time",
                medicine.taking_time
            );


            addMedicineDetail(
                details,
                "Duration",
                medicine.duration
            );


            if (details.children.length) {

                main.appendChild(
                    details
                );
            }


            /* Instructions */

            if (medicine.instructions) {

                var instructions =
                    document.createElement("div");

                instructions.className =
                    "hr-history-instructions";


                var instructionIcon =
                    document.createElement("i");

                instructionIcon.className =
                    "fa-solid fa-circle-info";


                var instructionText =
                    document.createElement("span");

                instructionText.textContent =
                    medicine.instructions;


                instructions.appendChild(
                    instructionIcon
                );


                instructions.appendChild(
                    instructionText
                );


                main.appendChild(
                    instructions
                );
            }


            row.appendChild(
                number
            );


            row.appendChild(
                main
            );


            list.appendChild(
                row
            );
        }
    );


    panel.appendChild(
        list
    );


    return panel;
}



/* =========================================================
   MEDICINE DETAIL
========================================================= */

function addMedicineDetail(
    container,
    label,
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return;
    }


    var item =
        document.createElement("div");

    item.className =
        "hr-history-medicine-detail";


    var labelElement =
        document.createElement("span");

    labelElement.textContent =
        label;


    var valueElement =
        document.createElement("strong");

    valueElement.textContent =
        value;


    item.appendChild(
        labelElement
    );


    item.appendChild(
        valueElement
    );


    container.appendChild(
        item
    );
}



/* =========================================================
   REPORTS
========================================================= */

function createReportPanel(
    reports
) {

    var panel =
        document.createElement("section");

    panel.className =
        "hr-history-panel";


    panel.appendChild(
        createHistoryPanelHeading(
            "Reports & Attachments",
            "fa-solid fa-file-medical"
        )
    );


    var list =
        document.createElement("div");

    list.className =
        "hr-history-report-list";


    reports.forEach(
        function (report) {

            var row =
                document.createElement("div");

            row.className =
                "hr-history-report-row";


            var iconWrap =
                document.createElement("div");

            iconWrap.className =
                "hr-history-report-icon";


            var icon =
                document.createElement("i");

            icon.className =
                getReportIcon(
                    report
                );


            iconWrap.appendChild(
                icon
            );


            var info =
                document.createElement("div");

            info.className =
                "hr-history-report-info";


            var name =
                document.createElement("strong");

            name.className =
                "hr-history-report-name";

            name.textContent =
                report.original_filename ||
                "Medical Report";


            info.appendChild(
                name
            );


            var metaParts = [];


            if (report.report_type) {

                metaParts.push(
                    report.report_type
                );
            }


            if (report.file_type) {

                metaParts.push(
                    report.file_type
                );
            }


            if (
                report.file_size !==
                null &&
                report.file_size !==
                undefined
            ) {

                metaParts.push(
                    formatFileSize(
                        report.file_size
                    )
                );
            }


            if (metaParts.length) {

                var meta =
                    document.createElement("span");

                meta.className =
                    "hr-history-report-meta";

                meta.textContent =
                    metaParts.join(" • ");

                info.appendChild(
                    meta
                );
            }


            row.appendChild(
                iconWrap
            );


            row.appendChild(
                info
            );


            if (report.file_url) {

                var link =
                    document.createElement("a");

                link.href =
                    report.file_url;

                link.target =
                    "_blank";

                link.rel =
                    "noopener noreferrer";

                link.className =
                    "hr-history-view-btn";


                var eye =
                    document.createElement("i");

                eye.className =
                    "fa-solid fa-arrow-up-right-from-square";


                link.appendChild(
                    eye
                );


                link.appendChild(
                    document.createTextNode(
                        " View"
                    )
                );


                row.appendChild(
                    link
                );
            }


            list.appendChild(
                row
            );
        }
    );


    panel.appendChild(
        list
    );


    return panel;
}



/* =========================================================
   REPORT ICON
========================================================= */

function getReportIcon(
    report
) {

    var filename =
        (
            report.original_filename ||
            ""
        ).toLowerCase();


    var fileType =
        (
            report.file_type ||
            ""
        ).toLowerCase();


    if (
        filename.endsWith(".pdf") ||
        fileType.includes("pdf")
    ) {

        return "fa-solid fa-file-pdf";
    }


    if (
        filename.endsWith(".jpg") ||
        filename.endsWith(".jpeg") ||
        filename.endsWith(".png") ||
        fileType.includes("image")
    ) {

        return "fa-solid fa-file-image";
    }


    return "fa-solid fa-file-medical";
}



/* =========================================================
   FILE SIZE
========================================================= */

function formatFileSize(
    bytes
) {

    var size =
        Number(bytes);


    if (
        !Number.isFinite(size) ||
        size <= 0
    ) {

        return "";
    }


    if (size < 1024) {

        return size + " B";
    }


    if (size < 1024 * 1024) {

        return (
            size / 1024
        ).toFixed(1) + " KB";
    }


    return (
        size /
        (1024 * 1024)
    ).toFixed(1) + " MB";
}



/* =========================================================
   FOLLOW-UP
========================================================= */

function createFollowUpPanel(
    followUp
) {

    var panel =
        document.createElement("section");

    panel.className =
        "hr-history-followup";


    panel.appendChild(
        createHistoryPanelHeading(
            "Follow-up",
            "fa-solid fa-calendar-check"
        )
    );


    var schedule =
        document.createElement("div");

    schedule.className =
        "hr-history-followup-schedule";


    if (followUp.date) {

        var dateChip =
            createScheduleChip(
                "fa-solid fa-calendar-day",
                formatShortDate(
                    followUp.date
                )
            );

        schedule.appendChild(
            dateChip
        );
    }


    if (followUp.time) {

        var timeChip =
            createScheduleChip(
                "fa-solid fa-clock",
                followUp.time
            );

        schedule.appendChild(
            timeChip
        );
    }


    panel.appendChild(
        schedule
    );


    if (followUp.notes) {

        var notes =
            document.createElement("div");

        notes.className =
            "hr-history-followup-notes";


        var icon =
            document.createElement("i");

        icon.className =
            "fa-solid fa-note-sticky";


        var text =
            document.createElement("span");

        text.textContent =
            followUp.notes;


        notes.appendChild(
            icon
        );


        notes.appendChild(
            text
        );


        panel.appendChild(
            notes
        );
    }


    return panel;
}



/* =========================================================
   SCHEDULE CHIP
========================================================= */

function createScheduleChip(
    iconClass,
    text
) {

    var chip =
        document.createElement("div");

    chip.className =
        "hr-history-schedule-chip";


    var icon =
        document.createElement("i");

    icon.className =
        iconClass;


    chip.appendChild(
        icon
    );


    chip.appendChild(
        document.createTextNode(
            text
        )
    );


    return chip;
}



/* =========================================================
   APPOINTMENT
========================================================= */

function createAppointmentPanel(
    appointment
) {

    var panel =
        document.createElement("section");

    panel.className =
        "hr-history-appointment";


    panel.appendChild(
        createHistoryPanelHeading(
            "Linked Appointment",
            "fa-solid fa-calendar"
        )
    );


    var details =
        document.createElement("div");

    details.className =
        "hr-history-appointment-details";


    if (appointment.date) {

        details.appendChild(
            createAppointmentDetail(
                "Date",
                formatShortDate(
                    appointment.date
                )
            )
        );
    }


    if (appointment.time) {

        details.appendChild(
            createAppointmentDetail(
                "Time",
                appointment.time
            )
        );
    }


    if (appointment.status) {

        details.appendChild(
            createAppointmentDetail(
                "Status",
                appointment.status
            )
        );
    }


    panel.appendChild(
        details
    );


    return panel;
}



/* =========================================================
   APPOINTMENT DETAIL
========================================================= */

function createAppointmentDetail(
    label,
    value
) {

    var item =
        document.createElement("div");

    item.className =
        "hr-history-appointment-detail";


    var labelElement =
        document.createElement("span");

    labelElement.textContent =
        label;


    var valueElement =
        document.createElement("strong");

    valueElement.textContent =
        value;


    item.appendChild(
        labelElement
    );


    item.appendChild(
        valueElement
    );


    return item;
}



/* =========================================================
   STATUS CLASS
========================================================= */

function getHistoryStatusClass(
    status
) {

    var normalized =
        String(
            status || "Active"
        )
        .trim()
        .toLowerCase();


    if (
        normalized ===
        "completed"
    ) {

        return "is-completed";
    }


    if (
        normalized ===
        "cancelled" ||
        normalized ===
        "canceled"
    ) {

        return "is-cancelled";
    }


    if (
        normalized ===
        "draft"
    ) {

        return "is-draft";
    }


    return "is-active";
}



/* =========================================================
   DATE FORMAT
========================================================= */

function formatHistoryDate(
    value
) {

    if (!value) {

        return "Date not available";
    }


    var date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;
    }


    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }
    );
}



/* =========================================================
   SHORT DATE
========================================================= */

function formatShortDate(
    value
) {

    if (!value) {

        return "";
    }


    var date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


  /* ---------------------------------------------------------
     CLIENT-SIDE VALIDATION
     Server validation still applies.
  --------------------------------------------------------- */
  function initValidation() {

    var form =
      document.getElementById(
        "prescriptionForm"
      );


    if (!form) return;


    form.addEventListener(
      "submit",
      function (event) {

        var isValid = true;


        /* -----------------------------------------------
           Clear old validation
        ------------------------------------------------ */
        root
          .querySelectorAll(
            ".hr-rxw-invalid"
          )
          .forEach(
            function (el) {

              el.classList.remove(
                "hr-rxw-invalid"
              );
            }
          );


        /* -----------------------------------------------
           Patient required
        ------------------------------------------------ */
        var patientSelect =
          document.getElementById(
            "patient_id"
          );


        if (
          patientSelect &&
          !patientSelect.value
        ) {

          patientSelect.classList.add(
            "hr-rxw-invalid"
          );


          isValid = false;
        }


        /* -----------------------------------------------
           Diagnosis required
        ------------------------------------------------ */
        var diagnosis =
          document.getElementById(
            "diagnosis"
          );


        if (
          diagnosis &&
          !diagnosis.value.trim()
        ) {

          diagnosis.classList.add(
            "hr-rxw-invalid"
          );


          openSection(
            "diagnosis"
          );


          isValid = false;
        }


        /* -----------------------------------------------
           At least one medicine
        ------------------------------------------------ */
        var medicineNames =
          form.querySelectorAll(
            'input[name="medicine_name[]"]'
          );


        var hasMedicine =
          Array.prototype.some.call(
            medicineNames,
            function (field) {

              return (
                field.value.trim()
                  .length > 0
              );
            }
          );


        if (!hasMedicine) {

          medicineNames.forEach(
            function (field) {

              field.classList.add(
                "hr-rxw-invalid"
              );
            }
          );


          openSection(
            "diagnosis"
          );


          isValid = false;
        }


        if (!isValid) {

          event.preventDefault();
        }
      }
    );
  }


  /* =========================================================
     INITIALIZE WORKSPACE
  ========================================================= */
  document.addEventListener(
    "DOMContentLoaded",
    function () {

      initAccordion();

      initPatientSync();

      initMedicines();

      initUploads();

      initClinicalHistory();

      initValidation();

    }
  );

})();

/* =========================================================
   PATIENT SEARCH
   Search by patient name / patient code
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    var patientSearch =
        document.getElementById("patientSearch");

    var patientSelect =
        document.getElementById("patient_id");

    var clearButton =
        document.getElementById("clearPatientSearch");

    var status =
        document.getElementById("patientSearchStatus");

    var results =
        document.getElementById("patientSearchResults");


    if (
        !patientSearch ||
        !patientSelect ||
        !results
    ) {
        return;
    }


    /* ---------------------------------------------------------
       ALL PATIENT OPTIONS
    --------------------------------------------------------- */

    var patientOptions =
        Array.from(
            patientSelect.querySelectorAll("option")
        ).filter(function (option) {

            return option.value !== "";

        });


    /* ---------------------------------------------------------
       GET NAME
    --------------------------------------------------------- */

    function getName(option) {

        return (
            option.getAttribute("data-name") ||
            ""
        ).trim();

    }


    /* ---------------------------------------------------------
       GET CODE
    --------------------------------------------------------- */

    function getCode(option) {

        return (
            option.getAttribute("data-code") ||
            ""
        ).trim();

    }


    /* ---------------------------------------------------------
       CLOSE RESULTS
    --------------------------------------------------------- */

    function closeResults() {

        results.innerHTML = "";

        results.style.display = "none";

    }


    /* ---------------------------------------------------------
       SHOW SELECTED PATIENT
    --------------------------------------------------------- */

    function showSelectedPatient() {

        var option =
            patientSelect.options[
                patientSelect.selectedIndex
            ];


        if (
            !option ||
            !option.value
        ) {
            return;
        }


        var name =
            getName(option);

        var code =
            getCode(option);


        patientSearch.value =
            code
                ? name + " (" + code + ")"
                : name;


        if (clearButton) {

            clearButton.style.display =
                "flex";

        }

    }


    /* ---------------------------------------------------------
       SELECT PATIENT
    --------------------------------------------------------- */

    function selectPatient(option) {

        if (!option) {
            return;
        }


        /*
         * Set the REAL patient ID.
         */
        patientSelect.value =
            option.value;


        /*
         * Show selected patient.
         */
        showSelectedPatient();


        /*
         * Close dropdown.
         */
        closeResults();


        /*
         * Update status.
         */
        if (status) {

            status.textContent =
                "Patient selected";

        }


        /*
         * IMPORTANT:
         *
         * This triggers your existing
         * initPatientSync() function.
         *
         * Do NOT remove this.
         */
        patientSelect.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );

    }


    /* ---------------------------------------------------------
       CREATE RESULT
    --------------------------------------------------------- */

    function createResult(option) {

        var button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "hr-patient-search-result";


        var name =
            getName(option);

        var code =
            getCode(option);


        button.innerHTML =

            '<span class="hr-patient-result-icon">' +
                '<i class="fa-solid fa-user"></i>' +
            '</span>' +

            '<span class="hr-patient-result-info">' +

                '<strong>' +
                    name +
                '</strong>' +

                (
                    code
                        ? '<small>' +
                            code +
                          '</small>'
                        : ""
                ) +

            '</span>' +

            '<i class="fa-solid fa-chevron-right hr-patient-result-arrow"></i>';


        button.addEventListener(
            "click",
            function () {

                selectPatient(option);

            }
        );


        return button;

    }


    /* ---------------------------------------------------------
       SEARCH
    --------------------------------------------------------- */

    function searchPatients() {

        var value =
            patientSearch.value
                .trim()
                .toLowerCase();


        closeResults();


        if (!value) {

            if (status) {
                status.textContent = "";
            }

            if (clearButton) {
                clearButton.style.display = "none";
            }

            return;
        }


        var matches =
            patientOptions.filter(
                function (option) {

                    var name =
                        getName(option)
                            .toLowerCase();

                    var code =
                        getCode(option)
                            .toLowerCase();


                    return (
                        name.includes(value) ||
                        code.includes(value)
                    );

                }
            );


        if (clearButton) {

            clearButton.style.display =
                "flex";

        }


        if (!matches.length) {

            var empty =
                document.createElement("div");

            empty.className =
                "hr-patient-search-empty";

            empty.innerHTML =
                '<i class="fa-solid fa-user-slash"></i>' +
                '<span>No patients found</span>';

            results.appendChild(empty);

            results.style.display =
                "block";


            if (status) {
                status.textContent =
                    "No patients found";
            }

            return;
        }


        matches.forEach(
            function (option) {

                results.appendChild(
                    createResult(option)
                );

            }
        );


        results.style.display =
            "block";


        if (status) {

            status.textContent =
                matches.length +
                (
                    matches.length === 1
                        ? " patient found"
                        : " patients found"
                );

        }

    }


    /* ---------------------------------------------------------
       INPUT
    --------------------------------------------------------- */

    patientSearch.addEventListener(
        "input",
        searchPatients
    );


    /* ---------------------------------------------------------
       FOCUS
    --------------------------------------------------------- */

    patientSearch.addEventListener(
        "focus",
        function () {

            if (
                patientSearch.value.trim()
            ) {

                searchPatients();

            }

        }
    );


    /* ---------------------------------------------------------
       CLEAR
    --------------------------------------------------------- */

    if (clearButton) {

        clearButton.addEventListener(
            "click",
            function () {

                patientSearch.value = "";

                patientSelect.value = "";


                closeResults();


                if (status) {
                    status.textContent = "";
                }


                clearButton.style.display =
                    "none";


                /*
                 * Clear demographic +
                 * clinical values.
                 */
                patientSelect.dispatchEvent(
                    new Event("change", {
                        bubbles: true
                    })
                );


                patientSearch.focus();

            }
        );

    }


    /* ---------------------------------------------------------
       CLICK OUTSIDE
    --------------------------------------------------------- */

    document.addEventListener(
        "click",
        function (event) {

            if (
                !patientSearch.contains(
                    event.target
                ) &&
                !results.contains(
                    event.target
                )
            ) {

                closeResults();

            }

        }
    );


    /* ---------------------------------------------------------
       PRESELECTED PATIENT
       ?patient_id=...
    --------------------------------------------------------- */

    if (patientSelect.value) {

        showSelectedPatient();

    }

});

function showExistingReportRemarks(
    fileName,
    remarks
) {

    var message =
        remarks && remarks.trim()
            ? remarks.trim()
            : "No doctor remarks added.";

    alert(
        fileName +
        "\n\nDoctor Remarks:\n" +
        message
    );
}