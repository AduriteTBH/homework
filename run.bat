@echo off
setlocal
cd /d "%~dp0"
title H^&H Launcher :8080

start http://localhost:8080/

where node >nul 2>nul
if %errorlevel% equ 0 (
    node server.js
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8080/'); $listener.Start(); Write-Host 'Server running on http://localhost:8080/ (Press Ctrl+C to stop)'; $m = @{ '.html'='text/html'; '.htm'='text/html'; '.js'='application/javascript'; '.css'='text/css'; '.json'='application/json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.wasm'='application/wasm'; '.mp3'='audio/mpeg'; '.wav'='audio/wav' }; while ($listener.IsListening) { $ctx = $listener.GetContext(); $req = $ctx.Request; $res = $ctx.Response; $p = $req.Url.LocalPath.TrimStart('/'); if ([string]::IsNullOrEmpty($p)) { $p = 'index.html' }; $target = [System.IO.Path]::Combine((Get-Location).Path, [System.Uri]::UnescapeDataString($p)); if (Test-Path -Path $target -PathType Container) { $sub = [System.IO.Path]::Combine($target, 'index.html'); if (Test-Path -Path $sub -PathType Leaf) { $target = $sub } }; if (Test-Path -Path $target -PathType Leaf) { $ext = [System.IO.Path]::GetExtension($target).ToLower(); $res.ContentType = if ($m.ContainsKey($ext)) { $m[$ext] } else { 'application/octet-stream' }; $res.AddHeader('Access-Control-Allow-Origin', '*'); $bytes = [System.IO.File]::ReadAllBytes($target); $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length); } else { $res.StatusCode = 404 }; $res.Close(); }"
