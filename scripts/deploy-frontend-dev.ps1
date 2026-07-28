#Requires -Version 5.1
<#
.SYNOPSIS
    React SPA を production build し、dev の S3 へ配置して CloudFront を invalidation する。

.DESCRIPTION
    Terraform apply 済みの dev 環境に対し、フロントエンドを手動デプロイする。
    値（S3 バケット名 / CloudFront / Cognito）はハードコードせず Terraform output から取得する。

    - VITE_* は実行プロセスの環境変数として設定し、build に反映する
      （Vite は既に process.env に存在する変数を .env より優先する）。
    - dist は Terraform では管理せず、このスクリプトで S3 へ sync する。
    - AWS 認証は事前に `aws login`（SSO 等）済みであることを前提とする。静的 Access Key は扱わない。
    - パスワード・Token・Secret は扱わない。

.EXAMPLE
    # リポジトリルートで実行する
    .\scripts\deploy-frontend-dev.ps1

.NOTES
    このスクリプトは terraform apply を実行しない。apply は別途ユーザーが行う。
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$tfDir = Join-Path $repoRoot 'infra/terraform/environments/dev'
$frontendDir = Join-Path $repoRoot 'apps/frontend'

function Write-Section {
    param([string]$Message)
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail {
    param([string]$Message, [string]$Hint)
    Write-Host ''
    Write-Host "エラー: $Message" -ForegroundColor Red
    if ($Hint) { Write-Host "対処 : $Hint" -ForegroundColor Yellow }
    exit 1
}

# ネイティブコマンドを安全に実行するヘルパー（PowerShell 5.1 の stderr + Stop 問題を回避）。
function Invoke-Cli {
    param(
        [Parameter(Mandatory = $true)][string]$Exe,
        [Parameter(Mandatory = $true)][string[]]$CliArgs
    )
    $errFile = [System.IO.Path]::GetTempFileName()
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $Exe @CliArgs 2>$errFile
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $prev
    }
    $errText = ''
    if (Test-Path -LiteralPath $errFile) {
        $errText = Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $errFile -ErrorAction SilentlyContinue
    }
    return [pscustomobject]@{
        ExitCode = $code
        StdOut   = ($out | Out-String).Trim()
        StdErr   = ("$errText").Trim()
    }
}

function Get-TfOutput {
    param([string]$Name)
    $r = Invoke-Cli -Exe 'terraform' -CliArgs @("-chdir=$tfDir", 'output', '-raw', $Name)
    if ($r.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($r.StdOut)) {
        Fail "Terraform output '$Name' を取得できませんでした。`n$($r.StdErr)" 'terraform apply 済みか確認してください。'
    }
    return $r.StdOut
}

# --- 1. 前提確認 -----------------------------------------------------------
Write-Section '前提コマンド・AWS 認証を確認します'
if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) { Fail 'terraform が見つかりません。' 'PATH を確認してください。' }
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { Fail 'aws が見つかりません。' 'AWS CLI v2 を確認してください。' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Fail 'npm.cmd が見つかりません。' 'Node.js / npm を確認してください。' }

$sts = Invoke-Cli -Exe 'aws' -CliArgs @('sts', 'get-caller-identity', '--output', 'json')
if ($sts.ExitCode -ne 0) { Fail 'AWS CLI の認証が無効です。' 'aws login でサインインしてください。' }

# --- 2. Terraform output 取得 ----------------------------------------------
Write-Section 'Terraform output を取得します'
$bucket = Get-TfOutput 'frontend_bucket_name'
$distId = Get-TfOutput 'cloudfront_distribution_id'
$cfUrl = Get-TfOutput 'cloudfront_url'
$poolId = Get-TfOutput 'cognito_user_pool_id'
$clientId = Get-TfOutput 'cognito_app_client_id'
$hostedUi = Get-TfOutput 'cognito_hosted_ui_domain'

# VITE_COGNITO_DOMAIN はホスト名のみ（https:// を除去）。
$cognitoDomain = $hostedUi -replace '^https://', ''

Write-Host "S3 バケット        : $bucket"
Write-Host "CloudFront Dist ID : $distId"
Write-Host "CloudFront URL     : $cfUrl"

# --- 3. VITE_* を設定して production build --------------------------------
Write-Section 'フロントエンドを production build します'
# AWS 上は同一 origin（CloudFront）で API を提供するため API Base URL は CloudFront URL。
$env:VITE_API_BASE_URL = $cfUrl
$env:VITE_COGNITO_USER_POOL_ID = $poolId
$env:VITE_COGNITO_CLIENT_ID = $clientId
$env:VITE_COGNITO_DOMAIN = $cognitoDomain
$env:VITE_COGNITO_REDIRECT_SIGN_IN = "$cfUrl/"
$env:VITE_COGNITO_REDIRECT_SIGN_OUT = "$cfUrl/"

Push-Location $frontendDir
try {
    $build = Invoke-Cli -Exe 'npm.cmd' -CliArgs @('run', 'build')
    if ($build.ExitCode -ne 0) {
        Fail "frontend の build に失敗しました。`n$($build.StdErr)`n$($build.StdOut)" 'ローカルで npm run build が通るか確認してください。'
    }
    Write-Host 'build 完了。'
}
finally {
    Pop-Location
    # 後続の環境へ影響させないよう、設定した VITE_* を破棄する。
    Remove-Item Env:VITE_API_BASE_URL, Env:VITE_COGNITO_USER_POOL_ID, Env:VITE_COGNITO_CLIENT_ID, `
        Env:VITE_COGNITO_DOMAIN, Env:VITE_COGNITO_REDIRECT_SIGN_IN, Env:VITE_COGNITO_REDIRECT_SIGN_OUT `
        -ErrorAction SilentlyContinue
}

$distDir = Join-Path $frontendDir 'dist'
if (-not (Test-Path $distDir)) { Fail "build 成果物が見つかりません: $distDir" 'build が成功したか確認してください。' }

# --- 4. S3 へ sync ---------------------------------------------------------
Write-Section 'dist を S3 へ sync します（--delete で不要ファイルを削除）'
$sync = Invoke-Cli -Exe 'aws' -CliArgs @('s3', 'sync', $distDir, "s3://$bucket", '--delete')
if ($sync.ExitCode -ne 0) { Fail "S3 sync に失敗しました。`n$($sync.StdErr)" 'S3 権限（s3:PutObject/DeleteObject/ListBucket）を確認してください。' }
Write-Host 'S3 sync 完了。'

# --- 5. CloudFront invalidation --------------------------------------------
Write-Section 'CloudFront を invalidation します'
$inv = Invoke-Cli -Exe 'aws' -CliArgs @('cloudfront', 'create-invalidation', '--distribution-id', $distId, '--paths', '/*')
if ($inv.ExitCode -ne 0) { Fail "invalidation に失敗しました。`n$($inv.StdErr)" 'CloudFront 権限（cloudfront:CreateInvalidation）を確認してください。' }
Write-Host 'invalidation を作成しました（反映まで少し時間がかかります）。'

# --- 6. 完了 ---------------------------------------------------------------
Write-Section '完了'
Write-Host "公開 URL: $cfUrl" -ForegroundColor Green
Write-Host "ヘルスチェック: $cfUrl/api/health" -ForegroundColor Green
