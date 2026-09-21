# Skillence Academy Local Static Web Server + Leads API
$port = 8080
$baseDir = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$prefixes = @("http://localhost:$port/", "http://127.0.0.1:$port/")

foreach ($p in $prefixes) {
    try {
        $listener.Prefixes.Add($p)
    } catch {
        # ignore if already registered
    }
}

try {
    $listener.Start()
} catch {
    # If 8080 is busy, try port 8081
    $port = 8081
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Skillence Academy Local Server is ACTIVE & RUNNING!   " -ForegroundColor Green
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host " URL: http://localhost:$port/" -ForegroundColor Yellow
Write-Host " Alt: http://127.0.0.1:$port/" -ForegroundColor Yellow
Write-Host " API: http://localhost:$port/api/leads" -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Press Ctrl+C to stop the server.`n"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            $response = $context.Response

            # Global CORS Headers
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Accept")

            # Handle CORS preflight
            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 204
                continue
            }

            $rawPath = $request.Url.AbsolutePath
            if ($rawPath -eq "/" -or $rawPath -eq "") {
                $rawPath = "/index.html"
            }

            # ==========================================
            # BACKEND ENDPOINT: POST /api/leads
            # ==========================================
            if ($rawPath -eq "/api/leads") {
                $response.ContentType = "application/json; charset=utf-8"

                if ($request.HttpMethod -ne "POST") {
                    $response.StatusCode = 405
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"Method not allowed. Use POST."}')
                    $response.ContentLength64 = $errBytes.Length
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    continue
                }

                $bodyText = ""
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $bodyText = $reader.ReadToEnd()
                    $reader.Close()
                } catch {
                    $bodyText = ""
                }

                $lead = $null
                try {
                    $lead = $bodyText | ConvertFrom-Json
                } catch {
                    $response.StatusCode = 400
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"Invalid JSON data."}')
                    $response.ContentLength64 = $errBytes.Length
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    continue
                }

                # Server-side validation
                $errors = @()
                if (-not $lead.fullName -or $lead.fullName.ToString().Trim().Length -lt 2) {
                    $errors += "Please enter your full name."
                }
                $phoneStr = if ($lead.phone) { [string]$lead.phone } else { "" }
                if (-not ($phoneStr -match '^\d{10}$')) {
                    $errors += "Please enter a valid 10-digit phone number."
                }
                $emailStr = if ($lead.email) { [string]$lead.email } else { "" }
                if (-not ($emailStr -match '^[^@\s]+@[^@\s]+\.[^@\s]+$')) {
                    $errors += "Please enter a valid email address."
                }
                if (-not $lead.course -or $lead.course -eq "" -or $lead.course -eq "Select a course") {
                    $errors += "Please select a course."
                }
                if (-not $lead.location -or $lead.location.ToString().Trim().Length -lt 1) {
                    $errors += "Please enter your city/location."
                }

                if ($errors.Count -gt 0) {
                    $response.StatusCode = 400
                    $errObj = @{
                        success = $false
                        error = ($errors -join " ")
                        validationErrors = $errors
                    }
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes(($errObj | ConvertTo-Json -Compress))
                    $response.ContentLength64 = $errBytes.Length
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    continue
                }

                # Construct record to store
                $leadId = "LEAD-" + (Get-Date -Format "yyyyMMdd-HHmmss-") + ([System.Random]::new().Next(1000, 9999))
                $leadRecord = [ordered]@{
                    id          = $leadId
                    fullName    = $lead.fullName.ToString().Trim()
                    phone       = $phoneStr.Trim()
                    email       = $emailStr.Trim()
                    course      = $lead.course.ToString().Trim()
                    location    = $lead.location.ToString().Trim()
                    message     = if ($lead.message) { $lead.message.ToString().Trim() } else { "" }
                    submittedAt = if ($lead.submittedAt) { $lead.submittedAt.ToString() } else { (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz") }
                    source      = if ($lead.source) { $lead.source.ToString() } else { "Website Contact Form" }
                }

                # Atomic append to leads.json
                $leadsFile = [System.IO.Path]::Combine($baseDir, "leads.json")
                $leadsList = [System.Collections.ArrayList]@()
                if ([System.IO.File]::Exists($leadsFile)) {
                    try {
                        $existingText = [System.IO.File]::ReadAllText($leadsFile, [System.Text.Encoding]::UTF8)
                        if ($existingText -and $existingText.Trim() -ne "") {
                            $existingItems = $existingText | ConvertFrom-Json
                            if ($existingItems -is [System.Array]) {
                                foreach ($it in $existingItems) { [void]$leadsList.Add($it) }
                            } elseif ($existingItems) {
                                [void]$leadsList.Add($existingItems)
                            }
                        }
                    } catch {
                        # fallback if file read failed
                    }
                }
                [void]$leadsList.Add($leadRecord)

                $jsonText = if ($leadsList.Count -eq 1) {
                    "[`n" + ($leadsList[0] | ConvertTo-Json -Depth 5) + "`n]"
                } else {
                    $leadsList | ConvertTo-Json -Depth 5
                }
                [System.IO.File]::WriteAllText($leadsFile, $jsonText, [System.Text.Encoding]::UTF8)

                Write-Host "[NEW LEAD RECEIVED] $($leadRecord.fullName) | $($leadRecord.phone) | $($leadRecord.course)" -ForegroundColor Green

                # Respond with 200 OK
                $response.StatusCode = 200
                $resObj = @{
                    success = $true
                    message = "Lead received and saved successfully"
                    leadId = $leadId
                    submittedAt = $leadRecord.submittedAt
                }
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json -Compress))
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                continue
            }

            # ==========================================
            # STATIC FILE SERVING
            # ==========================================
            $decodedPath = [System.Uri]::UnescapeDataString($rawPath.TrimStart('/'))
            $filePath = [System.IO.Path]::Combine($baseDir, $decodedPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))

            if ([System.IO.File]::Exists($filePath)) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = switch ($ext) {
                    ".html"  { "text/html; charset=utf-8" }
                    ".htm"   { "text/html; charset=utf-8" }
                    ".css"   { "text/css; charset=utf-8" }
                    ".js"    { "application/javascript; charset=utf-8" }
                    ".mjs"   { "application/javascript; charset=utf-8" }
                    ".json"  { "application/json; charset=utf-8" }
                    ".png"   { "image/png" }
                    ".jpg"   { "image/jpeg" }
                    ".jpeg"  { "image/jpeg" }
                    ".webp"  { "image/webp" }
                    ".gif"   { "image/gif" }
                    ".svg"   { "image/svg+xml" }
                    ".ico"   { "image/x-icon" }
                    ".mp4"   { "video/mp4" }
                    ".webm"  { "video/webm" }
                    ".woff2" { "font/woff2" }
                    ".woff"  { "font/woff" }
                    ".ttf"   { "font/ttf" }
                    default  { "application/octet-stream" }
                }

                $response.ContentType = $mime
                $response.AddHeader("Cache-Control", "no-cache")

                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length
                $response.StatusCode = 200

                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
            } else {
                $response.StatusCode = 404
                $response.ContentType = "text/plain; charset=utf-8"
                $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rawPath")
                $response.ContentLength64 = $err.Length
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($err, 0, $err.Length)
                }
            }
        } catch {
            # Catch individual request / socket exceptions safely
        } finally {
            try {
                $context.Response.OutputStream.Flush()
                $context.Response.Close()
            } catch {}
        }
    }
} finally {
    try { $listener.Stop() } catch {}
}
