import time
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
    # Startup: Connect to DB with retries, create tables and seed default data
    max_retries = 15
    for attempt in range(1, max_retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            try:
                seed_database(db)
            finally:
                db.close()
            print("[Database] Successfully connected, tables verified, and seed completed.")
            break
        except Exception as e:
            if attempt == max_retries:
                print(f"[Warning] Database initialization failed after {max_retries} attempts: {e}")
            else:
                print(f"[Database] Waiting for database connection (attempt {attempt}/{max_retries}): {e}")
                time.sleep(2)
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

