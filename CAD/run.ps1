# запуск dev-сервера (Windows)
if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
  Write-Host "Виртуальное окружение не найдено: .venv" -ForegroundColor Yellow
}
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --workers 1
