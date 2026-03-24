param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $directory = Split-Path -Parent $Path
  if ($directory) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$root = (Resolve-Path $ProjectRoot).Path

Write-Utf8NoBom (Join-Path $root "pyproject.toml") @'
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "brandformat"
version = "0.1.0"
description = "Brand-formatted PDF generation service with FastAPI, HTMX, MCP, and PostgreSQL."
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.116,<1.0",
  "uvicorn[standard]>=0.35,<1.0",
  "jinja2>=3.1,<4.0",
  "python-multipart>=0.0.20,<1.0",
  "sqlalchemy>=2.0,<3.0",
  "psycopg[binary]>=3.2,<4.0",
  "alembic>=1.16,<2.0",
  "pydantic-settings>=2.10,<3.0",
  "playwright>=1.54,<2.0",
  "markdown>=3.8,<4.0"
]

[project.optional-dependencies]
dev = [
  "pytest>=8.4,<9.0",
  "httpx>=0.28,<1.0"
]

[tool.setuptools]
package-dir = {"" = "src"}

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
testpaths = ["tests"]
'@

Write-Utf8NoBom (Join-Path $root "README.md") @'
# brandFormat

FastAPI service for branded PDF generation with:

- PostgreSQL as the primary database
- Alembic for schema migrations
- Jinja2 + HTMX for the thin operator UI
- Playwright for HTML to PDF rendering
- MCP-ready integration boundaries for editor tooling

## Quick Start

```bash
uv sync
uv run alembic upgrade head
uv run fastapi dev src/brandformat/interfaces/http/app.py
```

Open `http://127.0.0.1:8000/` for the HTML UI.

## Environment

Copy `.env.example` to your local env file and set at least:

- `DATABASE_URL`
- `PLAYWRIGHT_BROWSER=chromium`
- `PDF_OUTPUT_DIR`

## Main Flows

- `GET /` HTML UI with HTMX preview form
- `POST /preview` render preview fragment from markdown
- `POST /api/v1/documents` persist document metadata
- `POST /api/v1/documents/{document_id}/render` generate a PDF file
- `GET /api/v1/documents/{document_id}` inspect persisted metadata
- MCP integration boundary in `src/brandformat/interfaces/mcp/`

## Migrations

```bash
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "describe change"
```
'@

Write-Utf8NoBom (Join-Path $root ".env.example") @'
# Copy this file to your local environment file and fill real secrets outside version control.

APP_ENV=development
APP_NAME=brandFormat
APP_HOST=0.0.0.0
APP_PORT=8000
DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/brandformat
PLAYWRIGHT_BROWSER=chromium
PDF_OUTPUT_DIR=./data/pdfs
DEFAULT_TEMPLATE_ID=default
'@

Write-Utf8NoBom (Join-Path $root "Dockerfile") @'
FROM mcr.microsoft.com/playwright/python:v1.54.0-jammy

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md /app/
COPY src /app/src
COPY templates /app/templates
COPY migrations /app/migrations
COPY alembic.ini /app/alembic.ini
COPY docs /app/docs

RUN python -m pip install --upgrade pip \
    && python -m pip install -e .

EXPOSE 8000

CMD ["uvicorn", "brandformat.interfaces.http.app:app", "--host", "0.0.0.0", "--port", "8000"]
'@

Write-Utf8NoBom (Join-Path $root "alembic.ini") @'
[alembic]
script_location = migrations
prepend_sys_path = .

sqlalchemy.url = postgresql+psycopg://app:app@localhost:5432/brandformat

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers = console
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\__init__.py") @'
"""brandFormat package."""
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\main.py") @'
from brandformat.interfaces.http.app import app

__all__ = ["app"]
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\config.py") @'
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "brandFormat"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    database_url: str = "postgresql+psycopg://app:app@localhost:5432/brandformat"
    playwright_browser: str = "chromium"
    pdf_output_dir: Path = Path("./data/pdfs")
    default_template_id: str = "default"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.pdf_output_dir.mkdir(parents=True, exist_ok=True)
    return settings
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\application\schemas.py") @'
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    markdown: str = Field(min_length=1)
    template_id: str = Field(default="default", min_length=1)
    branding_config: dict[str, str] = Field(default_factory=dict)


class DocumentRead(BaseModel):
    id: UUID
    template_id: str
    markdown: str
    branding_config: dict[str, str]
    status: str
    pdf_path: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RenderRequest(BaseModel):
    markdown: str = Field(min_length=1)
    template_id: str = Field(default="default", min_length=1)
    branding_config: dict[str, str] = Field(default_factory=dict)


class RenderResult(BaseModel):
    template_id: str
    preview_html: str
    output_path: str | None = None
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\application\templates.py") @'
from markdown import markdown


def markdown_to_html(markdown_text: str) -> str:
    return markdown(markdown_text, extensions=["extra", "sane_lists"])
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\application\services\pdf_service.py") @'
from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from jinja2 import Environment, FileSystemLoader, select_autoescape

from brandformat.application.templates import markdown_to_html
from brandformat.config import Settings


class PdfService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._templates = Environment(
            loader=FileSystemLoader("templates"),
            autoescape=select_autoescape(["html", "xml"])
        )

    def render_preview_html(
        self,
        *,
        markdown_text: str,
        template_id: str,
        branding_config: dict[str, str]
    ) -> str:
        template = self._templates.get_template("pdf/base.html")
        return template.render(
            template_id=template_id,
            content_html=markdown_to_html(markdown_text),
            branding=branding_config
        )

    async def render_pdf(
        self,
        *,
        markdown_text: str,
        template_id: str,
        branding_config: dict[str, str]
    ) -> Path:
        from playwright.async_api import async_playwright

        html = self.render_preview_html(
            markdown_text=markdown_text,
            template_id=template_id,
            branding_config=branding_config
        )
        output_path = self._settings.pdf_output_dir / f"{uuid4()}.pdf"

        async with async_playwright() as playwright:
            browser_launcher = getattr(playwright, self._settings.playwright_browser)
            browser = await browser_launcher.launch()
            try:
                page = await browser.new_page()
                await page.set_content(html, wait_until="networkidle")
                await page.pdf(path=str(output_path), format="A4", print_background=True)
            finally:
                await browser.close()

        return output_path
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\infrastructure\db\base.py") @'
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\infrastructure\db\models.py") @'
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from brandformat.infrastructure.db.base import Base


class DocumentRecord(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[str] = mapped_column(String(120), nullable=False)
    markdown: Mapped[str] = mapped_column(Text(), nullable=False)
    branding_config: Mapped[dict[str, str]] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="draft")
    pdf_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\infrastructure\db\session.py") @'
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from brandformat.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\infrastructure\db\__init__.py") @'
from brandformat.infrastructure.db.models import DocumentRecord
from brandformat.infrastructure.db.session import SessionLocal, engine, get_db_session

__all__ = ["DocumentRecord", "SessionLocal", "engine", "get_db_session"]
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\interfaces\http\app.py") @'
from fastapi import FastAPI

from brandformat.config import get_settings
from brandformat.interfaces.http.routes import api, ui

settings = get_settings()
app = FastAPI(title=settings.app_name)
app.include_router(ui.router)
app.include_router(api.router, prefix="/api/v1", tags=["documents"])


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\interfaces\http\routes\ui.py") @'
from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from brandformat.application.services.pdf_service import PdfService
from brandformat.config import get_settings

router = APIRouter()
templates = Jinja2Templates(directory="templates")
pdf_service = PdfService(get_settings())


@router.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "template_id": get_settings().default_template_id,
            "preview_html": ""
        }
    )


@router.post("/preview", response_class=HTMLResponse)
async def preview(
    request: Request,
    markdown: str = Form(...),
    template_id: str = Form("default"),
    brand_name: str = Form("brandFormat")
) -> HTMLResponse:
    preview_html = pdf_service.render_preview_html(
        markdown_text=markdown,
        template_id=template_id,
        branding_config={"brand_name": brand_name}
    )
    return templates.TemplateResponse(
        request,
        "partials/preview.html",
        {"preview_html": preview_html}
    )
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\interfaces\http\routes\api.py") @'
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from brandformat.application.schemas import DocumentCreate, DocumentRead
from brandformat.application.services.pdf_service import PdfService
from brandformat.config import get_settings
from brandformat.infrastructure.db.models import DocumentRecord
from brandformat.infrastructure.db.session import get_db_session

router = APIRouter()
pdf_service = PdfService(get_settings())


@router.post("/documents", response_model=DocumentRead, status_code=201)
async def create_document(payload: DocumentCreate, session: Session = Depends(get_db_session)) -> DocumentRecord:
    record = DocumentRecord(
        template_id=payload.template_id,
        markdown=payload.markdown,
        branding_config=payload.branding_config,
        status="draft"
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.get("/documents/{document_id}", response_model=DocumentRead)
async def get_document(document_id: UUID, session: Session = Depends(get_db_session)) -> DocumentRecord:
    record = session.get(DocumentRecord, document_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return record


@router.post("/documents/{document_id}/render", response_model=DocumentRead)
async def render_document(document_id: UUID, session: Session = Depends(get_db_session)) -> DocumentRecord:
    record = session.get(DocumentRecord, document_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found")

    pdf_path = await pdf_service.render_pdf(
        markdown_text=record.markdown,
        template_id=record.template_id,
        branding_config=record.branding_config
    )
    record.pdf_path = str(pdf_path)
    record.status = "rendered"
    session.add(record)
    session.commit()
    session.refresh(record)
    return record
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\interfaces\http\routes\__init__.py") @'
__all__ = ["api", "ui"]
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\interfaces\mcp\__init__.py") @'
from brandformat.interfaces.mcp.server import GeneratePdfInput, get_tool_manifest, invoke_generate_pdf

__all__ = ["GeneratePdfInput", "get_tool_manifest", "invoke_generate_pdf"]
'@

Write-Utf8NoBom (Join-Path $root "src\brandformat\interfaces\mcp\server.py") @'
from pathlib import Path

from pydantic import BaseModel, Field

from brandformat.application.services.pdf_service import PdfService
from brandformat.config import get_settings


class GeneratePdfInput(BaseModel):
    markdown: str = Field(min_length=1)
    template_id: str = Field(default="default")
    branding_config: dict[str, str] = Field(default_factory=dict)


async def invoke_generate_pdf(payload: GeneratePdfInput) -> dict[str, str]:
    service = PdfService(get_settings())
    output_path = await service.render_pdf(
        markdown_text=payload.markdown,
        template_id=payload.template_id,
        branding_config=payload.branding_config
    )
    return {
        "pdf_path": str(output_path),
        "file_name": Path(output_path).name
    }


def get_tool_manifest() -> dict[str, object]:
    return {
        "name": "generate_pdf",
        "description": "Generate a branded PDF from markdown and template input.",
        "input_schema": GeneratePdfInput.model_json_schema()
    }
'@

Write-Utf8NoBom (Join-Path $root "templates\index.html") @'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>brandFormat</title>
    <script src="https://unpkg.com/htmx.org@2.0.4"></script>
    <style>
      :root {
        --bg: #f6f0e6;
        --panel: #fffaf3;
        --ink: #1e1d1b;
        --accent: #b24c2b;
        --line: #dccfbd;
      }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background: radial-gradient(circle at top, #fff7eb 0%, var(--bg) 60%);
      }
      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
      }
      section, form {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 1.25rem;
        box-shadow: 0 12px 40px rgba(55, 39, 18, 0.08);
      }
      textarea, input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 0.75rem;
        margin-top: 0.35rem;
        margin-bottom: 1rem;
        font: inherit;
        background: white;
      }
      textarea { min-height: 340px; }
      button {
        border: none;
        background: var(--accent);
        color: white;
        padding: 0.8rem 1.2rem;
        border-radius: 999px;
        font: inherit;
        cursor: pointer;
      }
      .preview {
        min-height: 600px;
        overflow: auto;
      }
      @media (max-width: 900px) {
        main { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <form hx-post="/preview" hx-target="#preview" hx-swap="innerHTML">
        <h1>brandFormat</h1>
        <p>Draft markdown, preview branded output, then wire render requests into the API or MCP tool.</p>

        <label for="brand_name">Brand name</label>
        <input id="brand_name" name="brand_name" type="text" value="brandFormat" />

        <label for="template_id">Template id</label>
        <input id="template_id" name="template_id" type="text" value="{{ template_id }}" />

        <label for="markdown">Markdown</label>
        <textarea id="markdown" name="markdown"># Proposal

This is a branded PDF draft.

- Clear structure
- HTML to PDF pipeline
- Postgres-backed metadata</textarea>

        <button type="submit">Preview</button>
      </form>

      <section id="preview" class="preview">
        {% include "partials/preview.html" %}
      </section>
    </main>
  </body>
</html>
'@

Write-Utf8NoBom (Join-Path $root "templates\partials\preview.html") @'
{% if preview_html %}
  {{ preview_html|safe }}
{% else %}
  <p>No preview rendered yet.</p>
{% endif %}
'@

Write-Utf8NoBom (Join-Path $root "templates\pdf\base.html") @'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: Georgia, "Times New Roman", serif;
        color: #201d19;
        margin: 0;
        padding: 0;
      }
      .page {
        padding: 48px 56px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 11px;
        color: #9b4b2f;
        margin-bottom: 24px;
      }
      .content {
        line-height: 1.55;
      }
      h1, h2, h3 {
        page-break-after: avoid;
      }
      footer {
        margin-top: 48px;
        font-size: 12px;
        color: #64594d;
      }
    </style>
  </head>
  <body>
    <section class="page">
      <div class="eyebrow">{{ branding.get("brand_name", "brandFormat") }} / {{ template_id }}</div>
      <div class="content">{{ content_html|safe }}</div>
      <footer>Generated by brandFormat</footer>
    </section>
  </body>
</html>
'@

Write-Utf8NoBom (Join-Path $root "migrations\README.md") @'
# Migrations

Alembic is the source of truth for schema changes.

- Run `uv run alembic upgrade head` before local development against a fresh database.
- Add a revision for every schema change and review generated SQL before shipping.
'@

Write-Utf8NoBom (Join-Path $root "migrations\env.py") @'
from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from brandformat.config import get_settings
from brandformat.infrastructure.db.base import Base
from brandformat.infrastructure.db import models  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
'@

Write-Utf8NoBom (Join-Path $root "migrations\script.py.mako") @'
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
'@

Write-Utf8NoBom (Join-Path $root "migrations\versions\20260324_0001_initial_documents.py") @'
"""initial documents table

Revision ID: 20260324_0001
Revises:
Create Date: 2026-03-24 16:30:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260324_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", sa.String(length=120), nullable=False),
        sa.Column("markdown", sa.Text(), nullable=False),
        sa.Column("branding_config", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("pdf_path", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id")
    )


def downgrade() -> None:
    op.drop_table("documents")
'@

Write-Utf8NoBom (Join-Path $root "tests\test_health.py") @'
from fastapi.testclient import TestClient

from brandformat.interfaces.http.app import app


client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
'@

Write-Utf8NoBom (Join-Path $root "tests\test_mcp_manifest.py") @'
from brandformat.interfaces.mcp import get_tool_manifest


def test_mcp_tool_manifest_name() -> None:
    manifest = get_tool_manifest()

    assert manifest["name"] == "generate_pdf"
    assert "input_schema" in manifest
'@
