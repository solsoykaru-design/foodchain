param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

if ($Message -eq "") {
  $Message = "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

Write-Host "→ git add -A" -ForegroundColor Cyan
git add -A

Write-Host "→ git commit -m `"$Message`"" -ForegroundColor Cyan
git commit -m "$Message"

Write-Host "→ git push" -ForegroundColor Cyan
git push

Write-Host "→ Trigger Render deploy..." -ForegroundColor Cyan
$headers = @{
  Authorization = "Bearer rnd_Zk1t17ZdR6OEZ6WNQHWhzu1VDojv"
  "Content-Type" = "application/json"
}
$body = '{}'
$result = Invoke-RestMethod -Uri "https://api.render.com/v1/services/srv-d8t29nvlk1mc73aj55dg/deploys" -Method Post -Headers $headers -Body $body

Write-Host "✓ Deploy triggered: $($result.id)" -ForegroundColor Green
Write-Host "  Status: $($result.status)" -ForegroundColor Green
