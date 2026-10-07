const API_URL = "/api/analyze";

// --------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------

const jobDescription = document.getElementById("jobDescription");
const charCount = document.getElementById("charCount");

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("resumeFiles");
const browseBtn = document.getElementById("browseBtn");
const fileList = document.getElementById("fileList");

const analyzeBtn = document.getElementById("analyzeBtn");
const errorBox = document.getElementById("errorBox");

const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const resultsState = document.getElementById("resultsState");

const candidateList = document.getElementById("candidateList");
const summary = document.getElementById("summary");

const newScreenBtn = document.getElementById("newScreenBtn");


// --------------------------------------------------
// APPLICATION STATE
// --------------------------------------------------

let files = [];

const appState = {
    status: "idle"
};


// --------------------------------------------------
// INITIAL UI STATE
// --------------------------------------------------

// When the page first loads:
//
// IDLE
// ├── emptyState      → visible
// ├── loadingState    → hidden
// └── resultsState    → hidden

showElement(emptyState);
hideElement(loadingState);
hideElement(resultsState);

hideError();


// --------------------------------------------------
// HELPER FUNCTIONS FOR SHOWING / HIDING ELEMENTS
// --------------------------------------------------

function showElement(element) {
    element.style.display = "";
}


function hideElement(element) {
    element.style.display = "none";
}


// --------------------------------------------------
// JOB DESCRIPTION
// --------------------------------------------------

jobDescription.addEventListener("input", () => {

    const length = jobDescription.value.length;

    charCount.textContent =
        `${length.toLocaleString()} characters`;

    updateButton();
});


// --------------------------------------------------
// FILE BROWSER
// --------------------------------------------------

browseBtn.addEventListener("click", () => {
    fileInput.click();
});


fileInput.addEventListener("change", () => {

    const selectedFiles = [...fileInput.files];

    addFiles(selectedFiles);

});


// --------------------------------------------------
// DRAG AND DROP
// --------------------------------------------------

["dragenter", "dragover"].forEach(eventName => {

    dropzone.addEventListener(eventName, event => {

        event.preventDefault();

        dropzone.classList.add("dragover");

    });

});


["dragleave", "drop"].forEach(eventName => {

    dropzone.addEventListener(eventName, event => {

        event.preventDefault();

        dropzone.classList.remove("dragover");

    });

});


dropzone.addEventListener("drop", event => {

    const droppedFiles = [...event.dataTransfer.files];

    addFiles(droppedFiles);

});


// --------------------------------------------------
// ADD FILES
// --------------------------------------------------

function addFiles(newFiles) {

    // Only PDF and DOCX files are allowed.

    const validFiles = newFiles.filter(file => {

        const name = file.name.toLowerCase();

        return (
            name.endsWith(".pdf") ||
            name.endsWith(".docx")
        );

    });


    // Prevent duplicate files.

    const existingFiles = new Set(
        files.map(file => `${file.name}-${file.size}`)
    );


    validFiles.forEach(file => {

        const key = `${file.name}-${file.size}`;

        if (!existingFiles.has(key)) {

            files.push(file);

        }

    });


    renderFiles();

    updateButton();

}


// --------------------------------------------------
// RENDER FILE LIST
// --------------------------------------------------

function renderFiles() {

    fileList.innerHTML = files.map((file, index) => {

        const isPDF =
            file.name.toLowerCase().endsWith(".pdf");

        const type = isPDF ? "PDF" : "DOCX";


        return `
            <div class="file-row">

                <div class="file-info">

                    <div class="file-badge">
                        ${type}
                    </div>

                    <div style="min-width:0">

                        <div class="file-name">
                            ${escapeHtml(file.name)}
                        </div>

                        <div class="file-size">
                            ${formatBytes(file.size)}
                        </div>

                    </div>

                </div>

                <button
                    class="remove-file"
                    type="button"
                    aria-label="Remove file"
                    onclick="removeFile(${index})"
                >
                    ×
                </button>

            </div>
        `;

    }).join("");

}


// --------------------------------------------------
// REMOVE FILE
// --------------------------------------------------

window.removeFile = function(index) {

    files.splice(index, 1);

    renderFiles();

    updateButton();

};


// --------------------------------------------------
// ENABLE / DISABLE SCREEN BUTTON
// --------------------------------------------------

function updateButton() {

    const hasJobDescription =
        jobDescription.value.trim().length > 0;

    const hasFiles =
        files.length > 0;

    analyzeBtn.disabled =
        !(hasJobDescription && hasFiles);

}


// --------------------------------------------------
// SCREEN CANDIDATES BUTTON
// --------------------------------------------------

analyzeBtn.addEventListener("click", analyze);


// --------------------------------------------------
// MAIN ANALYSIS FUNCTION
// --------------------------------------------------

async function analyze() {

    // ----------------------------------------------
    // STEP 1 — switch UI to LOADING
    // ----------------------------------------------

    appState.status = "loading";

    hideError();

    hideElement(emptyState);
    hideElement(resultsState);

    showElement(loadingState);

    analyzeBtn.disabled = true;


    // ----------------------------------------------
    // STEP 2 — prepare data for FastAPI
    // ----------------------------------------------

    const form = new FormData();

    form.append(
        "job_description",
        jobDescription.value.trim()
    );


    files.forEach(file => {

        form.append(
            "resumes",
            file
        );

    });


    // ----------------------------------------------
    // STEP 3 — call FastAPI
    // ----------------------------------------------

    try {

        const response = await fetch(
            API_URL,
            {
                method: "POST",
                body: form
            }
        );


        // ------------------------------------------
        // IMPORTANT:
        // Don't immediately use response.json().
        //
        // If FastAPI returns a 500 HTML/text error,
        // response.json() itself can throw:
        //
        // Unexpected token 'I'
        //
        // ------------------------------------------

        const rawResponse =
            await response.text();


        let data = {};


        try {

            data = rawResponse
                ? JSON.parse(rawResponse)
                : {};

        } catch (jsonError) {

            throw new Error(
                `The backend returned an unexpected response ` +
                `(${response.status}). ` +
                `Check the Uvicorn terminal for the actual error.`
            );

        }


        // ------------------------------------------
        // HTTP ERROR
        // ------------------------------------------

        if (!response.ok) {

            throw new Error(
                data.detail ||
                "The screening request failed."
            );

        }


        // ------------------------------------------
        // STEP 4 — render successful results
        // ------------------------------------------

        renderResults(data);


        appState.status = "results";


        hideElement(loadingState);

        showElement(resultsState);


    } catch (error) {

        // ------------------------------------------
        // ERROR STATE
        // ------------------------------------------

        console.error(
            "Resume screening error:",
            error
        );


        appState.status = "error";


        hideElement(loadingState);

        showElement(emptyState);


        showError(
            error.message ||
            "Could not connect to the backend."
        );


    } finally {

        // ------------------------------------------
        // Restore button according to input state
        // ------------------------------------------

        updateButton();

    }

}


// --------------------------------------------------
// RENDER RESULTS
// --------------------------------------------------

function renderResults(data) {

    const candidates =
        data.candidates ||
        data.results ||
        [];


    // ----------------------------------------------
    // Sort highest score → lowest score
    // ----------------------------------------------

    const ranked = [...candidates].sort(
        (a, b) =>
            Number(b.score || 0) -
            Number(a.score || 0)
    );


    // ----------------------------------------------
    // Calculate average
    // ----------------------------------------------

    const averageScore =
        ranked.length > 0
            ? ranked.reduce(
                (total, candidate) =>
                    total + Number(candidate.score || 0),
                0
            ) / ranked.length
            : 0;


    // ----------------------------------------------
    // Summary cards
    // ----------------------------------------------

    summary.innerHTML = `

        <div class="summary-card">

            <div class="label">
                Candidates
            </div>

            <div class="value">
                ${ranked.length}
            </div>

        </div>


        <div class="summary-card">

            <div class="label">
                Average match
            </div>

            <div class="value">
                ${Math.round(averageScore)}%
            </div>

        </div>


        <div class="summary-card">

            <div class="label">
                Top match
            </div>

            <div class="value">

                ${
                    ranked.length
                        ? Math.round(
                            Number(
                                ranked[0].score || 0
                            )
                        ) + "%"
                        : "—"
                }

            </div>

        </div>

    `;


    // ----------------------------------------------
    // Show individual processing errors
    // ----------------------------------------------

    if (
        Array.isArray(data.errors) &&
        data.errors.length > 0
    ) {

        const failedFiles =
            data.errors
                .map(item =>
                    `${item.file}: ${item.error}`
                )
                .join("\n");


        showError(
            `Some resumes could not be analyzed:\n${failedFiles}`
        );

    }


    // ----------------------------------------------
    // Render candidates
    // ----------------------------------------------

    candidateList.innerHTML =
        ranked.map((candidate, index) => {

            const details =
                candidate.details || {};


            // Matching skills

            const matchingSkills =
                details.matching_skills ||
                details.matched_skills ||
                [];


            // Missing skills

            const missingSkills =
                details.missing_important_skills ||
                details.missing_skills ||
                [];


            // Experience requirement

            const experienceMet =
                details.experience_requirement_met ??
                details.experience_met;


            // Verdict

            const verdict =
                details.final_verdict ||
                details.verdict ||
                details.summary ||
                "No verdict returned.";


            const score =
                Number(candidate.score || 0);


            return `

                <article class="candidate">


                    <!-- Candidate header -->

                    <div class="candidate-top">

                        <div class="rank-name">

                            <span class="rank">
                                #${String(index + 1).padStart(2, "0")}
                            </span>

                            <h3>
                                ${escapeHtml(
                                    candidate.name ||
                                    "Unnamed candidate"
                                )}
                            </h3>

                        </div>


                        <div class="score">

                            ${Math.round(score)}

                            <span>
                                % match
                            </span>

                        </div>

                    </div>


                    <!-- Score bar -->

                    <div class="score-bar">

                        <div
                            class="score-fill"
                            style="width:${Math.max(
                                0,
                                Math.min(100, score)
                            )}%"
                        ></div>

                    </div>


                    <!-- Candidate details -->

                    <div class="candidate-details">


                        <!-- Matching skills -->

                        <div>

                            <div class="detail-label">
                                Matching skills
                            </div>

                            <div class="pill-list">

                                ${
                                    Array.isArray(
                                        matchingSkills
                                    )

                                    ?

                                    matchingSkills
                                        .slice(0, 8)
                                        .map(skill => `
                                            <span class="pill">
                                                ${escapeHtml(
                                                    String(skill)
                                                )}
                                            </span>
                                        `)
                                        .join("")

                                    :

                                    '<span class="detail-text">None returned</span>'
                                }

                            </div>

                        </div>


                        <!-- Experience -->

                        <div>

                            <div class="detail-label">
                                Experience requirement
                            </div>

                            <div class="detail-text">

                                ${
                                    experienceMet === true

                                    ?

                                    "Requirement appears to be met."

                                    :

                                    experienceMet === false

                                    ?

                                    "Requirement does not appear to be met."

                                    :

                                    "Not specified."
                                }

                            </div>

                        </div>


                        <!-- Missing skills -->

                        <div>

                            <div class="detail-label">
                                Missing important skills
                            </div>

                            <div class="detail-text">

                                ${
                                    Array.isArray(
                                        missingSkills
                                    )

                                    ?

                                    escapeHtml(
                                        missingSkills.join(", ")
                                    )

                                    :

                                    escapeHtml(
                                        String(
                                            missingSkills ||
                                            "None returned"
                                        )
                                    )
                                }

                            </div>

                        </div>


                        <!-- Verdict -->

                        <div>

                            <div class="detail-label">
                                Verdict
                            </div>

                            <div class="detail-text">

                                ${escapeHtml(
                                    String(verdict)
                                )}

                            </div>

                        </div>


                    </div>

                </article>

            `;

        }).join("");

}


// --------------------------------------------------
// NEW SCREENING
// --------------------------------------------------

newScreenBtn.addEventListener(
    "click",
    () => {

        appState.status = "idle";


        hideElement(resultsState);

        hideElement(loadingState);

        showElement(emptyState);


        // Clear previous errors

        hideError();


        // Scroll back to the top

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }
);


// --------------------------------------------------
// ERROR DISPLAY
// --------------------------------------------------

function showError(message) {

    errorBox.textContent = message;

    errorBox.hidden = false;

}


function hideError() {

    errorBox.hidden = true;

}


// --------------------------------------------------
// FILE SIZE FORMATTER
// --------------------------------------------------

function formatBytes(bytes) {

    if (!bytes) {
        return "0 B";
    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];


    const unitIndex =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return `${(
        bytes /
        Math.pow(1024, unitIndex)
    ).toFixed(unitIndex ? 1 : 0)} ${
        units[unitIndex]
    }`;

}


// --------------------------------------------------
// HTML ESCAPING
// --------------------------------------------------

function escapeHtml(value) {

    return String(value).replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]
    );

}