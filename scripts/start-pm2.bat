@echo off
REM Start PM2 with saved processes
cd /d C:\data\JubileeEnterprise.com
call npm exec pm2 resurrect
