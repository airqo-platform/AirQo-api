param(
    [string]$BaseUrl = "http://localhost:4001",
    [string]$OutputPath,
    [ValidateRange(1, 10000)]
    [int]$RowCount = 24
)

$ErrorActionPreference = "Stop"
# Generate repeatable hourly sensor readings without an input file.
$start = [DateTimeOffset]::Parse("2026-10-28T00:00:00Z")
$samples = @(for ($i = 0; $i -lt $RowCount; $i++) {
    $pm25 = 20 + ($i % 12)
    [pscustomobject]@{
        timestamp = $start.AddHours($i).ToString("yyyy-MM-ddTHH:mm:ssZ")
        pm25_sensor1 = $pm25
        pm25_sensor2 = $pm25 + 2
        pm10_sensor1 = $pm25 + 15
        pm10_sensor2 = $pm25 + 17
        temp = 22 + ($i % 7)
        rh = 55 + ($i % 20)
    }
})
$csv = ($samples | ConvertTo-Csv -NoTypeInformation) -join "`n"
$responsePath = [System.IO.Path]::GetTempFileName()

try {
    # curl reads the multipart upload from stdin; the API still receives CSV.
    $status = $csv | & curl.exe --silent --show-error --connect-timeout 10 --max-time 120 `
        --request POST "$($BaseUrl.TrimEnd('/'))/api/v2/calibrate/tool" `
        --form "file=@-;filename=generated.csv;type=text/csv" `
        --form "datetime=timestamp" `
        --form "pm2_5=pm25_sensor1" `
        --form "s2_pm2_5=pm25_sensor2" `
        --form "pm10=pm10_sensor1" `
        --form "s2_pm10=pm10_sensor2" `
        --form "temperature=temp" `
        --form "humidity=rh" `
        --output $responsePath --write-out "%{http_code}"
    if ($LASTEXITCODE -ne 0) {
        throw "Request failed. Start the calibration service on $BaseUrl first."
    }
    if ($status -ne "200") {
        $body = Get-Content -LiteralPath $responsePath -Raw
        throw "V2 returned HTTP ${status}: $body"
    }

    $rows = @(Import-Csv -LiteralPath $responsePath)
    $expected = "avg_pm2_5,avg_pm10,datetime,calibrated_pm2_5,calibrated_pm10"
    $header = Get-Content -LiteralPath $responsePath -First 1
    if ($header -ne $expected -or $rows.Count -ne $RowCount) {
        throw "Unexpected CSV response: expected five columns and $RowCount data rows."
    }
    $culture = [System.Globalization.CultureInfo]::InvariantCulture
    for ($i = 0; $i -lt $RowCount; $i++) {
        foreach ($column in @("avg_pm2_5", "avg_pm10", "calibrated_pm2_5", "calibrated_pm10")) {
            $number = [double]::Parse($rows[$i].$column, $culture)
            if ([double]::IsNaN($number) -or [double]::IsInfinity($number)) {
                throw "Nonfinite $column in response row $i."
            }
        }
        if ([double]::Parse($rows[$i].avg_pm2_5, $culture) -ne ($samples[$i].pm25_sensor1 + 1) -or
            [double]::Parse($rows[$i].avg_pm10, $culture) -ne ($samples[$i].pm10_sensor1 + 1)) {
            throw "Unexpected sensor averages in response row $i."
        }
    }
    if ($OutputPath) {
        Copy-Item -LiteralPath $responsePath -Destination $OutputPath
        Write-Host "Saved to $OutputPath"
    }
    Write-Host "V2 passed: HTTP 200, $RowCount rows, correct averages and finite predictions."
    $rows | Select-Object -First 5 | Format-Table -AutoSize
}
finally {
    Remove-Item -LiteralPath $responsePath -ErrorAction SilentlyContinue
}
