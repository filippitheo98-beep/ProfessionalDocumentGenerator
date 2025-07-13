@echo off
chcp 65001 > nul
echo Demarrage DUERP Generator...
echo.
if not exist "node_modules" (
    echo Installation des dependances...
    npm install
)
echo Ouverture sur: http://localhost:5000
npm run dev