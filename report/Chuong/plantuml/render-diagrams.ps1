param(
    [string]$InputFile = "",
    [string]$OutputDir = "report/Chuong/images/generated"
)

$ErrorActionPreference = "Stop"

$javaExe = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\java.exe"
$plantUmlJar = "C:\tmp\plantuml.jar"

if (-not (Test-Path -LiteralPath $javaExe)) {
    throw "Khong tim thay java.exe tai: $javaExe"
}

if (-not (Test-Path -LiteralPath $plantUmlJar)) {
    throw "Khong tim thay plantuml.jar tai: $plantUmlJar"
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

if ($InputFile) {
    $resolvedInput = Resolve-Path -LiteralPath $InputFile
    & $javaExe -jar $plantUmlJar -charset UTF-8 -tpng -output "$((Resolve-Path -LiteralPath $OutputDir).Path)" $resolvedInput.Path
}
else {
    $sourceDir = Resolve-Path -LiteralPath "report/Chuong/plantuml"
    $pumlFiles = Get-ChildItem -LiteralPath $sourceDir.Path -Filter *.puml | Select-Object -ExpandProperty FullName
    & $javaExe -jar $plantUmlJar -charset UTF-8 -tpng -output "$((Resolve-Path -LiteralPath $OutputDir).Path)" $pumlFiles
}
