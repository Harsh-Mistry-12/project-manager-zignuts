from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api.v1 import (
    auth, users, projects, punch_sessions, time_entries, stats, ai_assistant, audit_logs
)
from app.seed import seed_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables if not exist
    try:
        Base.metadata.create_all(bind=engine)
        # Seed default data
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
    except Exception as e:
        print(f"[Warning] Database initialization notice: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users & Access"])
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["Projects"])
app.include_router(punch_sessions.router, prefix=f"{settings.API_V1_STR}/punch-sessions", tags=["Punch Clock"])
app.include_router(time_entries.router, prefix=f"{settings.API_V1_STR}/time-entries", tags=["Time Tracking"])
app.include_router(stats.router, prefix=f"{settings.API_V1_STR}/stats", tags=["Heatmap & Analytics"])
app.include_router(ai_assistant.router, prefix=f"{settings.API_V1_STR}/ai", tags=["RAG AI Assistant"])
app.include_router(audit_logs.router, prefix=f"{settings.API_V1_STR}/audit-logs", tags=["Audit Logs"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "project-manager-backend"}

@app.get("/")
def root():
    return {
        "message": "Project Management & Time Tracking API is active.",
        "docs": "/docs",
        "health": "/health"
    }

