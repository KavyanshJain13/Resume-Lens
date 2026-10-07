# ResumeLens

AI-powered resume screening and candidate matching application built with FastAPI, Groq, Pydantic, and a lightweight professional frontend.

## Live Demo

[Try ResumeLens](https://resume-lens-labh.onrender.com/)

## Overview

ResumeLens helps recruiters and hiring teams quickly screen multiple resumes against a job description.

The application extracts structured information from PDF and DOCX resumes, evaluates each candidate against the provided job description, and ranks candidates based on their overall match.

Instead of manually reviewing every resume from scratch, ResumeLens provides a structured first-pass analysis highlighting candidate strengths, missing skills, experience alignment, and an overall match score.

## Features

- **Multi-Format Upload:** Upload multiple PDF or DOCX resumes with drag-and-drop support.
- **Automated Text Extraction:** Parses text directly from uploaded binary documents.
- **Structured Parsing:** AI extracts candidate names, contact details, skills, work history, and education.
- **Contextual Matching:** Evaluates candidates against specific job descriptions.
- **Granular Scoring:** Computes candidate match scores (0–100) alongside matched and missing critical skills.
- **Experience Verification:** Evaluates experience alignment against role requirements.
- **Fault-Tolerant Processing:** Handles individual resume parsing failures without interrupting the rest of the batch.
- **Rate-Limit Resilience:** Automatic retry mechanisms for temporary LLM API limits.
- **Unified Delivery:** Lightweight, responsive frontend served directly via FastAPI.

## How It Works

```text
Resume Files (PDF / DOCX)
          │
          ▼
Text Extraction Pipeline
          │
          ▼
   AI Resume Parser
          │
          ▼
Structured Candidate Profile
          │
          ▼
  Job Description Matcher
          │
          ▼
 AI Scoring & Gap Analysis
          │
          ▼
 Ranked Candidate Results
```

## Architecture

ResumeLens is divided into two primary subsystems:

### Backend
- Processes file uploads (PDF & DOCX extraction).
- Parses structured candidate data using Groq LLM integration.
- Scores candidates against job descriptions and validates outputs with Pydantic.
- Exposes REST endpoints and serves static frontend assets.
- **Stack:** Python, FastAPI, Uvicorn, Pydantic, Groq API, PyPDF, python-docx.

### Frontend
- Drag-and-drop resume upload zone.
- Job description input and batch evaluation controls.
- Dynamic ranking tables, candidate summaries, and error notices.
- **Stack:** Semantic HTML5, CSS3, Vanilla JavaScript.

## Tech Stack

| Category | Technology |
| :--- | :--- |
| **Backend Framework** | FastAPI |
| **ASGI Server** | Uvicorn |
| **Language** | Python |
| **LLM Provider** | Groq |
| **Inference Model** | `openai/gpt-oss-20b` |
| **Data Validation** | Pydantic |
| **PDF Extraction** | PyPDF |
| **DOCX Extraction** | python-docx |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) |
| **Deployment** | Render |
| **Version Control** | Git / GitHub |

## Project Structure

```text
Resume_Screener/
├── backend/
│   ├── __init__.py
│   ├── main.py
│   ├── llm.py
│   ├── file_readers.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .gitignore
└── README.md
```

## Backend API

### Analyze Resumes

```http
POST /api/analyze
```

#### Request Payload
- `job_description`: Plain text string.
- `files`: One or more `multipart/form-data` binary files (`.pdf`, `.docx`).

#### Response Schema

```json
{
  "candidates": [
    {
      "filename": "candidate.pdf",
      "score": 88.0,
      "details": {
        "candidate_name": "Candidate Name",
        "matching_skills": [
          "Python",
          "SQL",
          "Machine Learning"
        ],
        "missing_important_skills": [
          "AWS"
        ],
        "experience_requirement_met": true,
        "final_verdict": "Strong match"
      }
    }
  ],
  "errors": []
}
```

## Local Setup

### 1. Clone the Repository

```bash
git clone [https://github.com/YOUR_USERNAME/resume-lens.git](https://github.com/YOUR_USERNAME/resume-lens.git)
cd resume-lens
```

### 2. Create and Activate a Virtual Environment

**Windows PowerShell:**
```powershell
python -m venv backend/venv
backend\venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```env
GROQ_API_KEY=your_groq_api_key_here
```

> **Note:** Never commit the `.env` file to version control.

### 5. Start the Application

Run the server from the project root:

```bash
uvicorn backend.main:app --reload
```

Access the application in your browser at `http://127.0.0.1:8000`.

## AI Processing Pipeline

ResumeLens utilizes an LLM for two targeted tasks:

1. **Structured Resume Parsing:** Converts raw document text into standardized schemas, extracting identity, contact details, total experience, technical/soft skills, employment history, education, projects, and certifications.
2. **Contextual Evaluation:** Evaluates candidate profiles against the target job requirements to produce:
   - A normalized match score (0–100).
   - Confirmed matching competencies.
   - High-priority missing skills.
   - Verification of tenure/experience constraints.
   - A synthesized candidate verdict.

## Error Handling & Resilience

ResumeLens isolates document evaluation tasks:
- **Partial Failure Handling:** If a batch contains unparseable or corrupted files, successful resumes are processed and ranked normally, while failed items are isolated in the `errors` array.
- **Rate-Limit Retries:** The backend incorporates backoff and retry handling for transient Groq API throughput limits.

## Deployment

ResumeLens can run as a unified service where FastAPI serves both API endpoints and frontend assets.

To start the service in production:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

Ensure `GROQ_API_KEY` is configured in your hosting platform's environment settings.

## Security

Ensure sensitive environment files and artifacts are excluded from Git by including the following in `.gitignore`:

```gitignore
.env
*.env
venv/
.venv/
__pycache__/
*.pyc
```

## Limitations

- Screening results are generated by an LLM and can produce inaccuracies.
- Parsing fidelity depends on input document formatting and layout clarity.
- Batched concurrent processing is subject to upstream LLM rate limits.
- Designed strictly as an initial screening and recommendation tool, not an autonomous hiring decision engine.

## Future Improvements

- User authentication and multi-tenant recruiter workspaces.
- Persistent database storage for candidate history and requisitions.
- Side-by-side candidate comparison views.
- Export options for evaluation reports (CSV, PDF).
- Asynchronous background task workers (Celery/Redis) for high-volume batches.
- Support for additional document types (`.txt`, `.rtf`, scanned OCR).

## Disclaimer

ResumeLens is an AI-assisted screening tool[cite: 1]. Outputs should be treated as decision-support insights rather than definitive candidate evaluations[cite: 1]. Final recruitment decisions should always involve human review and comprehensive portfolio assessments[cite: 1].

## Author

**Kavyansh Jain**  
B.Tech Computer Science and Engineering  
BIT Mesra

- LinkedIn: www.linkedin.com/in/hello-kavyansh-jain