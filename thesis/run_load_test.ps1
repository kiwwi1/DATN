# =============================================================================
# run_load_test.ps1 -- Chay kiem thu tai k6 cho do an (PowerShell)
# =============================================================================

# -- 1. Cau hinh -- BAT BUOC PHAI THAY ----------------------------------------
$PRODUCT_ID = "69e48339f44c7f74ee3164ec"     # lay tu URL trang san pham trong admin
$TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MjllZTk4MGUzYTE3YWQ5MDgxNzM5MiIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3ODI3MzAzMTUsImV4cCI6MTc4MzMzNTExNX0.1Zw9WOv5B6OxN_bdtuhi5_DvbLE0g54SPvGNgo6MpbE"           # lay tu localStorage hoac cookie sau khi login
$VARIANT_KEY = ""                              # de trong neu san pham khong co bien the
$BASE_URL = "http://localhost:4000"

# -- 2. Kiem tra k6 da cai chua -----------------------------------------------
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    # Thu cap nhat lai PATH trong phien lam viec hien tai neu k6 vua moi duoc cai dat
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    Write-Host "[ERR] k6 chua duoc cai dat tren he thong." -ForegroundColor Red
    Write-Host "Vui long cai dat k6 bang cach chay lenh sau trong PowerShell Admin:" -ForegroundColor Yellow
    Write-Host "  winget install GrafanaLabs.k6" -ForegroundColor Cyan
    Write-Host "Hoac tai file cai dat tai: https://k6.io/docs/getting-started/installation/#windows" -ForegroundColor Yellow
    exit 1
}

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$K6_SCRIPT = Join-Path $SCRIPT_DIR "k6_concurrency.js"

# -- 3. Kiem tra bien bat buoc ------------------------------------------------
if ($PRODUCT_ID -eq "THAY_BANG_PRODUCT_ID_THAT" -or -not $PRODUCT_ID) {
    Write-Host "[ERR] Vui long dien PRODUCT_ID vao file run_load_test.ps1 truoc khi chay." -ForegroundColor Red
    exit 1
}

if ($TOKEN -eq "THAY_BANG_JWT_TOKEN_ADMIN" -or -not $TOKEN) {
    Write-Host "[ERR] Vui long dien TOKEN vao file run_load_test.ps1 truoc khi chay." -ForegroundColor Red
    exit 1
}

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  KIEM THU TAI -- Atomic Stock Reservation Concurrency" -ForegroundColor Cyan
Write-Host "  Product ID : $PRODUCT_ID" -ForegroundColor Cyan
Write-Host "  Backend    : $BASE_URL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$TempDir = Join-Path $env:TEMP "k6_logs"
if (-not (Test-Path $TempDir)) {
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
}

$Log1 = Join-Path $TempDir "k6_scenario1.txt"
$Log2 = Join-Path $TempDir "k6_scenario2.txt"

# -- 4. Scenario 1: Tai trung binh -- 100 yeu cau dong thoi, kho 20 -----------
Write-Host "`n>> SCENARIO 1: Tai trung binh (100 VUs, kho ban dau = 20)" -ForegroundColor Green
Write-Host "----------------------------------------------------------------" -ForegroundColor Green

$env:PRODUCT_ID = $PRODUCT_ID
$env:VARIANT_KEY = $VARIANT_KEY
$env:TOKEN = $TOKEN
$env:BASE_URL = $BASE_URL
$env:NUM_REQUESTS = 100
$env:INITIAL_STOCK = 20

k6 run --no-color "$K6_SCRIPT" 2>&1 | Tee-Object -FilePath $Log1

Write-Host "`nCho DB on dinh truoc khi chay scenario tiep theo..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# -- 5. Scenario 2: Tai cao -- 250 yeu cau dong thoi, kho 50 ------------------
Write-Host "`n>> SCENARIO 2: Tai cao (250 VUs, kho ban dau = 50)" -ForegroundColor Green
Write-Host "----------------------------------------------------------------" -ForegroundColor Green

$env:NUM_REQUESTS = 250
$env:INITIAL_STOCK = 50

k6 run --no-color "$K6_SCRIPT" 2>&1 | Tee-Object -FilePath $Log2

# -- 6. Tong hop ---------------------------------------------------------------
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  HOAN TAT -- Ket qua duoc luu tai:" -ForegroundColor Cyan
Write-Host "    Scenario 1: $Log1" -ForegroundColor Cyan
Write-Host "    Scenario 2: $Log2" -ForegroundColor Cyan
Write-Host "  Sao chep cac so lieu vao Bang 4.x trong do an." -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan
