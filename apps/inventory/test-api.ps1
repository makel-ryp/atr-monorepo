$base = "http://localhost:3002"

# ── Login ────────────────────────────────────────────────────────────────────
# Use Invoke-WebRequest so we can pull the Set-Cookie header directly.
# -SessionVariable inside a try block can silently fail to update the outer
# scope on some PowerShell versions, so we capture the cookie string manually.
$cookieHeader = $null
try {
  $loginResp = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST `
    -ContentType "application/json" -Body '{"password":"rypstick2026"}' `
    -SessionVariable webSession
  $loginJson = $loginResp.Content | ConvertFrom-Json
  Write-Host "LOGIN: OK -> $($loginResp.Content)"
  # Grab the raw Set-Cookie value so we can also pass it as a header fallback
  $cookieHeader = $loginResp.Headers["Set-Cookie"]
} catch {
  Write-Host "LOGIN: ERROR -> $($_.Exception.Message)"
  Write-Host "(routes below will return 401 if login failed)"
}

# Helper: call a route using both -WebSession (cookie jar) and an explicit
# Cookie header — belt-and-suspenders for PowerShell 5.x quirks.
function Invoke-Auth {
  param([string]$Uri, [string]$Method = "GET", [string]$Body = $null)
  $params = @{
    Uri        = $Uri
    Method     = $Method
    WebSession = $webSession
    ErrorAction = "Stop"
  }
  if ($cookieHeader) { $params.Headers = @{ Cookie = ($cookieHeader -split ";")[0] } }
  if ($Body)         { $params.Body = $Body; $params.ContentType = "application/json" }
  Invoke-RestMethod @params
}

# ── Read routes ───────────────────────────────────────────────────────────────
foreach ($route in @("inventory","rolling-windows","run-log","daily-briefs","po-history","edi-orders","sku-params","stock-pipeline")) {
  try {
    $r = Invoke-Auth -Uri "$base/api/$route"
    $count = if ($r -is [System.Array]) { $r.Count } else { 1 }
    Write-Host "GET /api/$route -> OK ($count rows)"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "GET /api/$route -> $code ERROR: $($_.Exception.Message)"
  }
}

# Forecast
try {
  $r = Invoke-Auth -Uri "$base/api/forecast?sku=2"
  $count = if ($r -is [System.Array]) { $r.Count } else { 1 }
  Write-Host "GET /api/forecast?sku=2 -> OK ($count rows)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "GET /api/forecast?sku=2 -> $code ERROR: $($_.Exception.Message)"
}

# Pipeline status
try {
  $r = Invoke-Auth -Uri "$base/api/pipeline/status"
  Write-Host "GET /api/pipeline/status -> OK: $($r | ConvertTo-Json -Compress)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "GET /api/pipeline/status -> $code ERROR: $($_.Exception.Message)"
}

# AI stub
try {
  $body = '{"messages":[{"role":"user","content":"test"}]}'
  $r = Invoke-Auth -Uri "$base/api/ai/chat" -Method POST -Body $body
  Write-Host "POST /api/ai/chat -> OK: $($r | ConvertTo-Json -Compress)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "POST /api/ai/chat -> $code ERROR: $($_.Exception.Message)"
}

# Stock pipeline write round-trip
try {
  $body = '{"sku":"2","type":"production","qty_to_warehouse":300,"qty_to_fba":0,"expected_arrival_warehouse":"2026-09-01","po_number":"TEST-001"}'
  $r = Invoke-Auth -Uri "$base/api/stock-pipeline" -Method POST -Body $body
  Write-Host "POST /api/stock-pipeline -> OK: $($r | ConvertTo-Json -Compress)"
  $all = Invoke-Auth -Uri "$base/api/stock-pipeline"
  $count = if ($all -is [System.Array]) { $all.Count } else { 1 }
  Write-Host "GET /api/stock-pipeline after insert -> OK ($count rows)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "POST /api/stock-pipeline -> $code ERROR: $($_.Exception.Message)"
}

Write-Host "Done."
