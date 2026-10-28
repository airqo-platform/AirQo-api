param(
    [string]$BaseUrl = "http://localhost:4001",
    [string]$AirQoToken = $env:AIRQO_LOGIN_TOKEN,
    [ValidateRange(30, 50000)]
    [int]$RowCount = 72,
    [ValidateRange(5, 3600)]
    [int]$WaitSeconds = 300
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($AirQoToken)) {
    throw "Set AIRQO_LOGIN_TOKEN to your existing AirQo login JWT before running this test."
}

# Generate paired reference measurements without creating an input CSV file.
# These are synthetic smoke-test data, not a model-quality benchmark.
$start = [DateTimeOffset]::Parse("2026-10-01T00:00:00Z")
$samples = for ($i = 0; $i -lt $RowCount; $i++) {
    [pscustomobject]@{
        datetime = $start.AddHours($i).ToString("yyyy-MM-ddTHH:mm:ssZ")
        pm2_5 = 20 + ($i % 12)
        pm10 = 35 + ($i % 15)
        humidity = 55 + ($i % 20)
        temperature = 22 + ($i % 7)
        reference_pm2_5 = 17 + ($i % 12)
        reference_pm10 = 31 + ($i % 15)
    }
}
$csv = ($samples | ConvertTo-Csv -NoTypeInformation) -join "`n"
$responsePath = [System.IO.Path]::GetTempFileName()

try {
    $status = $csv | & curl.exe --silent --show-error --connect-timeout 10 --max-time 120 `
        --request POST "$($BaseUrl.TrimEnd('/'))/api/v2/calibrate/tool/train" `
        --header "Authorization: Bearer $AirQoToken" `
        --form "file=@-;filename=generated-reference.csv;type=text/csv" `
        --form "pollutant=both" `
        --output $responsePath --write-out "%{http_code}"
    if ($LASTEXITCODE -ne 0) { throw "Could not reach the training API." }
    $body = Get-Content -LiteralPath $responsePath -Raw
    if ($status -ne "202") { throw "Training submission returned HTTP ${status}: $body" }
    $job = $body | ConvertFrom-Json
    Write-Host "Queued job: $($job.job_id)"
    $headers = @{ Authorization = "Bearer $AirQoToken" }
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($WaitSeconds)
    do {
        $result = Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))$($job.status_url)" -Headers $headers
        Write-Host "Status: $($result.status)"
        if ($result.status -eq "completed") {
            Write-Host "Training rows: $($result.training_rows); validation rows: $($result.validation_rows)"
            $result.metrics | ConvertTo-Json -Depth 5
            Write-Host "Validation CSV: $($BaseUrl.TrimEnd('/'))$($result.result_url)"
            Write-Host "Model artifact: $($BaseUrl.TrimEnd('/'))$($result.model_url)"
            Write-Host "Use the same user's login token for either download."
            return
        }
        if ($result.status -eq "failed") { throw "Training failed: $($result.message)" }
        Start-Sleep -Seconds 5
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Job $($job.job_id) is still pending. Check that training_worker.py is running and poll $($job.status_url)."
}
finally {
    Remove-Item -LiteralPath $responsePath -ErrorAction SilentlyContinue
}
