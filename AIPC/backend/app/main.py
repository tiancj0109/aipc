"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
from app.utils.logging_handler import setup_redis_logging

settings = get_settings()

# Initialize Redis logging capture
setup_redis_logging(settings.REDIS_URL, source="backend")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="大模型自动化评测系统 - AI Performance Center",
    docs_url="/aipc-api/docs",
    redoc_url=None,  # Disable default to use custom route
    openapi_url="/aipc-api/openapi.json",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Debug Middleware to catch 500 errors
import traceback
from fastapi import Request
from fastapi.responses import JSONResponse

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "error": str(e), "traceback": traceback.format_exc()}
        )

# Register API routers
from app.api.models import router as models_router
from app.api.test_suites import router as test_suites_router
from app.api.prompt_templates import router as prompt_templates_router
from app.api.jobs import router as jobs_router
from app.api.results import router as results_router
from app.api.leaderboard import router as leaderboard_router
from app.api.offline_jobs import router as offline_jobs_router
from app.api.chat import router as chat_router
from app.api.ws import router as ws_router

# Use centralized prefix for all v1 APIs
api_prefix = "/aipc-api/v1"
app.include_router(models_router, prefix=api_prefix)
app.include_router(test_suites_router, prefix=api_prefix)
app.include_router(prompt_templates_router, prefix=api_prefix)
app.include_router(jobs_router, prefix=api_prefix)
app.include_router(results_router, prefix=api_prefix)
app.include_router(leaderboard_router, prefix=api_prefix)
app.include_router(offline_jobs_router, prefix=api_prefix)
app.include_router(chat_router, prefix=api_prefix)
app.include_router(ws_router, prefix=api_prefix)


@app.on_event("startup")
def on_startup():
    """Startup logic."""
    # init_db() # Disabled per user request to avoid auto-creating tables
    pass


@app.get("/aipc-api")
def root():
    return {
        "name": settings.APP_NAME,
        "version": app.version,
        "docs": "/aipc-api/docs",
    }


from fastapi.responses import HTMLResponse

@app.get("/aipc-api/redoc", include_in_schema=False)
async def redoc_html():
    return HTMLResponse(content=f"""
    <!DOCTYPE html>
    <html>
    <head>
    <title>{app.title} - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>body {{ margin: 0; padding: 0; }}</style>
    </head>
    <body>
    <redoc spec-url='{app.openapi_url}'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"> </script>
    </body>
    </html>
    """)

@app.get("/aipc-api/health")
def health():
    return {"status": "ok"}
