# Read-only LDPlayer accessibility diagnostic for MapleStory Idle RPG.
# It saves an uncompressed UIAutomator dump and a screenshot on the Desktop.
$ErrorActionPreference = "Continue"
$packageName = "com.nexon.ma"
$projectDir = Split-Path -Parent $PSScriptRoot

Write-Host "Chungju Guild War - accessibility data check"
Write-Host "=============================================="

$candidates = New-Object System.Collections.Generic.List[string]
if ($env:LDPLAYER_ADB) { $candidates.Add($env:LDPLAYER_ADB) }

$knownPaths = @(
  "${env:SystemDrive}\LDPlayer\LDPlayer14\adb.exe",
  "${env:SystemDrive}\LDPlayer\LDPlayer9\adb.exe",
  "${env:SystemDrive}\LDPlayer\dnplayer2\adb.exe",
  "${env:SystemDrive}\ChangZhi\LDPlayer\adb.exe"
)
foreach ($pathValue in $knownPaths) {
  if ($pathValue) { $candidates.Add($pathValue) }
}

foreach ($processName in @("dnplayer", "LDPlayer", "LdVBoxHeadless", "ldconsole")) {
  foreach ($process in @(Get-Process -Name $processName -ErrorAction SilentlyContinue)) {
    try {
      if ($process.Path) {
        $processRoot = Split-Path -Parent $process.Path
        $candidates.Insert(0, (Join-Path $processRoot "adb.exe"))
      }
    } catch {}
  }
}

$pathAdb = Get-Command adb.exe -ErrorAction SilentlyContinue
if ($pathAdb) { $candidates.Insert(0, $pathAdb.Source) }

$adb = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $adb) {
  Write-Host ""
  Write-Host "RESULT: ADB_NOT_FOUND"
  Write-Host "adb.exe could not be found."
  exit 1
}

Write-Host "ADB: $adb"
& $adb start-server 2>$null | Out-Null

function Get-OnlineDevices {
  $deviceLines = & $adb devices 2>&1
  return @($deviceLines | ForEach-Object {
    if ([string]$_ -match '^(\S+)\s+device$') { $Matches[1] }
  })
}

$devices = @(Get-OnlineDevices)
if ($devices.Count -eq 0) {
  foreach ($port in @(5555, 5557, 5565, 62001, 7555)) {
    & $adb connect "127.0.0.1:$port" 2>&1 | Out-Null
  }
  $devices = @(Get-OnlineDevices)
}

if ($devices.Count -eq 0) {
  Write-Host ""
  Write-Host "RESULT: LDPLAYER_NOT_CONNECTED"
  Write-Host "Start LDPlayer and enable ADB debugging with Local connection."
  exit 1
}

$preferred = @($devices | Where-Object { $_ -match '^(127\.0\.0\.1:|emulator-)' })
if ($preferred.Count -gt 0) { $serial = $preferred[0] } else { $serial = $devices[0] }
Write-Host "Device: $serial"

$sizeOutput = & $adb -s $serial shell wm size 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host (($sizeOutput | Out-String).Trim()) }

$packagePath = & $adb -s $serial shell pm path $packageName 2>&1
if (($packagePath | Out-String) -notmatch [regex]::Escape($packageName)) {
  Write-Host "WARNING: MapleStory Idle RPG was not found on this instance."
}

Write-Host ""
Write-Host "Open Guild > Guild War > individual score list."
Write-Host "Keep at least two member rows and their scores visible."
Read-Host "When the list is fully loaded, press Enter"

$desktopPath = [Environment]::GetFolderPath("Desktop")
if (-not $desktopPath) { $desktopPath = $env:USERPROFILE }
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $desktopPath ("Chungju-Accessibility-Check-" + $timestamp)
New-Item -ItemType Directory -Path $outputDir -Force -ErrorAction Stop | Out-Null

$remoteXml = "/sdcard/chungju_accessibility.xml"
$remotePng = "/sdcard/chungju_guild_war_screen.png"
$localXml = Join-Path $outputDir "accessibility.xml"
$localPng = Join-Path $outputDir "guild-war-screen.png"
$localValues = Join-Path $outputDir "accessibility-values.txt"

try {
  $dumped = $false
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    # Do not use --compressed: the full tree is needed for this diagnostic.
    & $adb -s $serial shell uiautomator dump $remoteXml 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $dumped = $true
      break
    }
    Start-Sleep -Milliseconds 1200
  }
  if (-not $dumped) { throw "uiautomator dump failed" }

  & $adb -s $serial shell screencap -p $remotePng 2>&1 | Out-Null
  & $adb -s $serial pull $remoteXml $localXml 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $localXml)) {
    throw "adb pull failed for accessibility.xml"
  }
  & $adb -s $serial pull $remotePng $localPng 2>&1 | Out-Null

  [xml]$document = Get-Content -LiteralPath $localXml -Raw -Encoding UTF8 -ErrorAction Stop
  $nodes = @($document.SelectNodes("//node"))
  $records = New-Object System.Collections.Generic.List[object]

  foreach ($node in $nodes) {
    $textValue = $node.GetAttribute("text").Trim()
    $descriptionValue = $node.GetAttribute("content-desc").Trim()
    $resourceValue = $node.GetAttribute("resource-id").Trim()
    $packageValue = $node.GetAttribute("package").Trim()
    $classValue = $node.GetAttribute("class").Trim()
    $boundsValue = $node.GetAttribute("bounds").Trim()

    if ($textValue -or $descriptionValue -or $resourceValue) {
      $records.Add([pscustomobject]@{
        Package = $packageValue
        Class = $classValue
        ResourceId = $resourceValue
        Text = $textValue
        ContentDescription = $descriptionValue
        Bounds = $boundsValue
      })
    }
  }

  $candidateRecords = @($records | Where-Object {
    -not $_.Package -or $_.Package -eq $packageName
  })
  $allValues = @($records | ForEach-Object { @($_.Text, $_.ContentDescription) } | Where-Object { $_ } | Sort-Object -Unique)
  $gameValues = @($candidateRecords | ForEach-Object { @($_.Text, $_.ContentDescription) } | Where-Object { $_ } | Sort-Object -Unique)
  $numberValues = @($gameValues | Where-Object { $_ -match '[0-9]' })
  # Keep the script ASCII-safe for Windows PowerShell 5.1, which may read UTF-8
  # scripts without a BOM using the legacy system code page.
  $koreanValues = @($gameValues | Where-Object { $_ -match '[\uAC00-\uD7A3]' })

  $roster = @()
  $latestPath = Join-Path $projectDir "data\latest.json"
  if (Test-Path -LiteralPath $latestPath) {
    try {
      $latest = Get-Content -LiteralPath $latestPath -Raw -Encoding UTF8 | ConvertFrom-Json
      $roster = @($latest.members | ForEach-Object { [string]$_.nickname } | Where-Object { $_ })
    } catch {}
  }
  $joinedGameValues = $gameValues -join "`n"
  $matchedMembers = @($roster | Where-Object { $joinedGameValues.Contains($_) })

  $reportLines = New-Object System.Collections.Generic.List[string]
  $reportLines.Add("Chungju Guild War accessibility diagnostic")
  $reportLines.Add("Captured: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
  $reportLines.Add("Device: " + $serial)
  $reportLines.Add("Total nodes: " + $nodes.Count)
  $reportLines.Add("Records with text, description, or resource-id: " + $records.Count)
  $reportLines.Add("All text/description values: " + $allValues.Count)
  $reportLines.Add("Game candidate text/description values: " + $gameValues.Count)
  $reportLines.Add("Game values containing digits: " + $numberValues.Count)
  $reportLines.Add("Game values containing Korean: " + $koreanValues.Count)
  $reportLines.Add("Matched roster members: " + $matchedMembers.Count)
  $reportLines.Add("")
  $reportLines.Add("Values exposed by the game:")
  if ($gameValues.Count -eq 0) {
    $reportLines.Add("(none)")
  } else {
    foreach ($value in $gameValues) { $reportLines.Add([string]$value) }
  }
  $reportLines.Add("")
  $reportLines.Add("Node details:")
  foreach ($record in $records) {
    $line = "package={0}`tclass={1}`tresource-id={2}`ttext={3}`tcontent-desc={4}`tbounds={5}" -f `
      $record.Package, $record.Class, $record.ResourceId, $record.Text, $record.ContentDescription, $record.Bounds
    $reportLines.Add($line)
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($localValues, [string[]]$reportLines, $utf8NoBom)

  Write-Host ""
  Write-Host "=============================================="
  Write-Host "Total accessibility nodes: $($nodes.Count)"
  Write-Host "Game text/description values: $($gameValues.Count)"
  Write-Host "Values containing digits: $($numberValues.Count)"
  Write-Host "Values containing Korean: $($koreanValues.Count)"
  Write-Host "Matched guild members: $($matchedMembers.Count)"

  if ($matchedMembers.Count -ge 1 -and $numberValues.Count -ge 1) {
    Write-Host "RESULT: GUILD_DATA_ACCESSIBLE"
    Write-Host "The score collector may use accessibility data."
  } elseif ($gameValues.Count -eq 0) {
    Write-Host "RESULT: NO_GAME_TEXT"
    Write-Host "The Unity screen exposes no readable game text."
  } else {
    Write-Host "RESULT: GAME_TEXT_INCONCLUSIVE"
    Write-Host "Some game text exists, but member scores were not confirmed."
  }
  Write-Host "Saved folder: $outputDir"
  Write-Host "=============================================="
} catch {
  Write-Host ""
  Write-Host "=============================================="
  Write-Host "RESULT: DIAGNOSTIC_FAILED"
  Write-Host $_.Exception.Message
  Write-Host "Saved folder: $outputDir"
  Write-Host "=============================================="
  exit 1
} finally {
  & $adb -s $serial shell rm -f $remoteXml $remotePng 2>&1 | Out-Null
}
