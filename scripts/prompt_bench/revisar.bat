@echo off
rem Abre el dashboard de revision de llamadas con doble clic. El dashboard va en call-audit\revision\dashboard.html
cd /d "%~dp0..\.."
if not exist revision\dashboard.html (
  echo Falta revision\dashboard.html: copia ahi el dashboard que te enviaron.
  pause
  exit /b 1
)
set /p REVISOR=Tu nombre (ej. ana-perez): 
python scripts\prompt_bench\review_server.py --root revision --revisor "%REVISOR%" --open
pause
