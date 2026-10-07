from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.llm import parse_resume, final_score
from backend.file_readers import read_resume

app = FastAPI(title="ResumeLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Local development only.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(
    job_description: str = Form(...),
    resumes: list[UploadFile] = File(...),
):
    if not job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    if not resumes:
        raise HTTPException(status_code=400, detail="Upload at least one resume.")

    candidates = []
    errors = []

    with TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        for upload in resumes:
            filename = upload.filename or "resume"
            suffix = Path(filename).suffix.lower()

            if suffix not in {".pdf", ".docx"}:
                errors.append({"file": filename, "error": "Only PDF and DOCX files are supported."})
                continue

            try:
                destination = tmp_path / filename
                destination.write_bytes(await upload.read())

                resume_text = read_resume(destination)
                if not resume_text or not resume_text.strip():
                    raise ValueError("No readable text could be extracted from this file.")

                parsed_resume = parse_resume(resume_text)
                result = final_score(job_description, parsed_resume)

                candidates.append({
                    "name": parsed_resume.name or Path(filename).stem,
                    "score": result.score,
                    "details": result.details,
                    "file_name": filename,
                })

            except Exception as exc:
                print(f"\nERROR PROCESSING {filename}")
                print(type(exc).__name__)
                print(exc)

                errors.append({
                    "file": filename,
                    "error": f"{type(exc).__name__}: {exc}",
                })

    if not candidates:
        detail = "No resumes could be analyzed."
        if errors:
            detail += " " + errors[0]["error"]
        raise HTTPException(status_code=422, detail=detail)

    candidates.sort(key=lambda candidate: candidate["score"], reverse=True)
    return {"candidates": candidates, "errors": errors}


@app.get("/")
def serve_frontend():
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
