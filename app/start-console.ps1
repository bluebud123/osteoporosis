# Starts PeriLoop Console on http://localhost:8080. The AI key is typed in or read from $env:DEEPSEEK_API_KEY; it is never saved to a file.
# Press Enter with the key empty to run on rules only (no AI).
Set-Location $PSScriptRoot
if ($env:DEEPSEEK_API_KEY) { $env:PROVIDER_KEY = $env:DEEPSEEK_API_KEY }
else {
  $k = Read-Host "Paste DeepSeek key (or press Enter for rules only)" -AsSecureString
  $plain = [System.Net.NetworkCredential]::new("", $k).Password
  if ($plain) { $env:PROVIDER_KEY = $plain }
}
if ($env:PROVIDER_KEY) { $env:PROVIDER_BASE_URL = "https://api.deepseek.com"; $env:PROVIDER_MODEL = "deepseek-chat" }
$env:PORT = "8080"
$p = Start-Process node -ArgumentList "server.js" -PassThru -NoNewWindow
Start-Sleep 2
Start-Process "http://localhost:8080/#live"
Read-Host "PeriLoop Console is running. Press Enter here to stop"
Stop-Process -Id $p.Id
Remove-Item Env:PROVIDER_KEY -ErrorAction SilentlyContinue
