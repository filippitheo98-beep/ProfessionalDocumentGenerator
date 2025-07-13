@echo off
chcp 65001 > nul
echo Demarrage DUERP Generator...
echo.
if not exist "node_modules" (
    echo Installation des dependances...
    npm install
)
echo.
echo ========================================
echo  APPLICATION DUERP GENERATOR
echo ========================================
echo.
echo Version complete : http://localhost:5000
echo Version simple   : http://localhost:5000/simple
echo.
echo Utilisez la version simple si la version
echo complete ne fonctionne pas.
echo.
npm run dev