import json
import os
import re
import time
from typing import Any
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq
from groq import RateLimitError
from pydantic import BaseModel, Field

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_PATH)

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY not found. Put it in backend/.env")

client = Groq(api_key=api_key)
model = "openai/gpt-oss-20b"


class MatchResult(BaseModel):
    score: float
    details: dict


class Experience(BaseModel):
    company: str | None = None
    role: str | None = None
    duration: str | None = None
    description: str | None = None
    skills_used: list[str] = Field(default_factory=list)


class Resume(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    total_experience_years: float | None = None

    skills: list[str] = Field(default_factory=list)

    experiences: list[Experience] = Field(default_factory=list)

    # Resumes may contain richer structured education/project information.
    education: list[str | dict[str, Any]] = Field(default_factory=list)

    projects: list[str | dict[str, Any]] = Field(default_factory=list)

    certifications: list[str | dict[str, Any]] = Field(default_factory=list)


# resume_schema = Resume.model_json_schema()


def _parse_json_response(raw: str) -> dict:
    """Accept clean JSON, fenced JSON, or JSON embedded in a short model response."""
    if not raw:
        raise ValueError("The model returned an empty response.")

    cleaned = raw.strip()

    # Remove ```json ... ``` if the model added markdown fences.
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try the first complete JSON object in the response.
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


def _json_completion(messages, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
                max_completion_tokens=2000,
            )

            content = response.choices[0].message.content

            if not content:
                raise ValueError("Model returned an empty response.")

            return _parse_json_response(content)

        except RateLimitError:
            if attempt == max_retries - 1:
                raise

            wait_time = 2 ** attempt
            print(
                f"Rate limit reached. "
                f"Waiting {wait_time}s before retry..."
            )
            time.sleep(wait_time)

        except json.JSONDecodeError:
            if attempt == max_retries - 1:
                raise

            print("Invalid JSON returned. Retrying...")
            time.sleep(1)


def parse_resume(resume_text: str) -> Resume:
    system_prompt = """
You are an expert resume parser.

Extract structured information from the resume based on its meaning,
not only exact section headings.

Return ONLY one valid JSON object.

The JSON must contain exactly these top-level keys:

{
    "name": null,
    "email": null,
    "phone": null,
    "total_experience_years": null,
    "skills": [],
    "experiences": [],
    "education": [],
    "projects": [],
    "certifications": []
}

Rules:

1. Do not invent information.
2. If a scalar value is unavailable, use null.
3. If a list has no information, use [].
4. Include internships inside experiences.
5. Extract relevant skills mentioned anywhere in the resume.
6. Education may contain structured information such as:
   institution, degree, field, duration, GPA/CGPA, percentage, or details.
7. Projects may contain structured information such as:
   name, description, technologies, role, results, or details.
8. Certifications may contain structured information when available.
9. Preserve useful information instead of converting structured information
   into vague strings.
10. Do not copy the resume verbatim.
11. Keep project descriptions to at most 1-2 concise sentences.
12. Keep experience descriptions concise.
13. Do not include unnecessary details.
14. Preserve important technologies, roles, dates, achievements, and metrics.
15. Keep lists concise and relevant.
16. Return ONLY JSON.
17. Do not use markdown.
18. Do not include explanations outside the JSON object.
19. Keep the final JSON compact.
"""

    data = _json_completion([
        {
            "role": "system",
            "content": system_prompt
        },
        {
            "role": "user",
            "content": f"Parse this resume:\n\n{resume_text}"
        }
    ])

    return Resume(**data)


def final_score(job_description: str, resume: Resume) -> MatchResult:

    prompt = f"""
You are an HR recruiter.

Compare the candidate's resume with the job description.

JOB DESCRIPTION:
{job_description}

CANDIDATE RESUME:
{resume.model_dump_json(indent=2)}

Return ONLY one valid JSON object with exactly these keys:

{{
  "score": number,
  "details": {{
    "candidate_name": string,
    "matching_skills": [],
    "missing_important_skills": [],
    "experience_requirement_met": true or false,
    "final_verdict": string
  }}
}}

Rules:
1. score must be between 0 and 100.
2. Do not invent information.
3. Keep final_verdict concise.
4. Return ONLY JSON.
5. Do not use markdown.
6. Do not include explanations outside the JSON object.
7. Return ONLY the required JSON.
8. Keep explanations concise.
9. Do not repeat resume content.
10. Do not reproduce project or experience descriptions.
"""

    data = _json_completion([
        {"role": "user", "content": prompt}
    ])

    return MatchResult(**data)
