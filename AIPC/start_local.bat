@echo off
echo Starting AIPC System locally...

echo Starting FastAPI Backend...
start cmd /k "cd backend && .\venv\Scripts\activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload --access-log"

echo Starting Celery Worker...
start cmd /k "cd backend && .\venv\Scripts\activate && celery -A app.engine.tasks.celery_app worker -P solo -l info"

echo Starting Vite Frontend...
start cmd /k "cd frontend && npm run dev"

echo All services are starting in separate windows.
echo Frontend will be available at http://localhost:5173
echo Backend API doc at http://localhost:3000/docs
