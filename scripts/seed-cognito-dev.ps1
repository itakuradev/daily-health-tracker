#Requires -Version 5.1
<#
.SYNOPSIS
    dev 環境の Cognito User Pool に開発用ユーザーを作成／更新する。

.DESCRIPTION
    terraform destroy / apply で Cognito User Pool が再作成された後、
    開発用ユーザーを作り直すためのスクリプト。

    - 作成するのは Cognito 側のユーザーのみ。アプリDBの User は作成しない。
      （アプリDBの User は、認証後の初回 API アクセス時にバックエンドが自動作成する。
       認証・認可設計書 10.3 / 18.2）
    - User Pool ID は dev の Terraform output から取得する。Region は User Pool ID
      から導出する。そのため User Pool が再作成されてもスクリプトを修正せず実行できる。
    - AWS 認証は事前に `aws login`（SSO 等）済みであることを前提とする。
      静的 Access Key は扱わない。認証方式の変更もしない。

.PARAMETER Email
    作成／更新する開発ユーザーのメールアドレス。
    この User Pool は username_attributes=["email"] のため、email がログイン ID になる。

.PARAMETER Name
    表示名（任意）。指定した場合のみ Cognito の name 属性へ設定する。

.EXAMPLE
    # リポジトリルートで実行する
    .\scripts\seed-cognito-dev.ps1 -Email "developer@example.com" -Name "開発ユーザー"

.NOTES
    パスワードは引数で受け取らず、実行時に対話入力する（画面非表示）。
    パスワードポリシー（明示設定なし = Cognito 既定）:
      8 文字以上／大文字・小文字・数字・記号をそれぞれ含む
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Email,

    [Parameter(Mandatory = $false)]
    [string]$Name
)

$ErrorActionPreference = 'Stop'

# --- リポジトリ内のパス ----------------------------------------------------
# このスクリプトは scripts/ 配下にある前提。リポジトリルートはその親。
$repoRoot = Split-Path -Parent $PSScriptRoot
$tfDir = Join-Path $repoRoot 'infra/terraform/environments/dev'

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

# ネイティブコマンド（terraform / aws）を安全に実行するヘルパー。
#
# PowerShell 5.1 では $ErrorActionPreference='Stop' の下でネイティブコマンドが
# stderr へ出力すると終了エラー（NativeCommandError）に変換されてしまう。
# aws は「ユーザー未存在」などを stderr に出すため、そのままでは正常な分岐前に落ちる。
# そこで stderr を一時ファイルへ逃がし、ErrorActionPreference を一時的に Continue に
# して実行し、終了コードと出力を明示的に返す。
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

# --- 1. 前提コマンドの確認 -------------------------------------------------
Write-Section '前提コマンドを確認します'

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    Fail 'terraform コマンドが見つかりません。' 'Terraform をインストールし、PATH を通してください。'
}
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Fail 'aws コマンドが見つかりません。' 'AWS CLI v2 をインストールし、PATH を通してください。'
}
if (-not (Test-Path $tfDir)) {
    Fail "Terraform ディレクトリが見つかりません: $tfDir" 'リポジトリルートからこのスクリプトを実行してください。'
}
Write-Host 'terraform / aws を確認しました。'

# --- 2. AWS 認証の確認 -----------------------------------------------------
Write-Section 'AWS CLI の認証を確認します'

$sts = Invoke-Cli -Exe 'aws' -CliArgs @('sts', 'get-caller-identity', '--output', 'json')
if ($sts.ExitCode -ne 0) {
    Fail 'AWS CLI の認証が無効です。' 'aws login（SSO 等）でサインインしてから再実行してください。'
}
try {
    $account = ($sts.StdOut | ConvertFrom-Json).Account
    Write-Host "認証済みアカウント: $account"
}
catch {
    Write-Host '認証は確認できました（アカウント表示は省略）。'
}

# --- 3. Terraform output から User Pool ID を取得 --------------------------
Write-Section 'Terraform output から User Pool ID を取得します'

$poolResult = Invoke-Cli -Exe 'terraform' -CliArgs @("-chdir=$tfDir", 'output', '-raw', 'cognito_user_pool_id')
if ($poolResult.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($poolResult.StdOut)) {
    Fail "Terraform output から cognito_user_pool_id を取得できませんでした。`n$($poolResult.StdErr)" 'terraform apply 済みか、正しい環境ディレクトリかを確認してください。'
}
$userPoolId = $poolResult.StdOut

# Region は User Pool ID から導出する。
# Cognito User Pool ID は必ず "<region>_<英数字>" 形式であり、region に含まれるのは
# ハイフンのみ・suffix は英数字のみのため、最初の "_" より前が region になる。
# こうすることで region 用の Terraform output を追加せず、現在の state のまま実行できる。
$region = $userPoolId.Split('_')[0]
if ([string]::IsNullOrWhiteSpace($region) -or $region -eq $userPoolId) {
    Fail "User Pool ID から Region を導出できませんでした: $userPoolId" 'cognito_user_pool_id の値が想定形式か確認してください。'
}
Write-Host "User Pool ID: $userPoolId"
Write-Host "Region      : $region"

# --- 4. 既存ユーザーの確認 -------------------------------------------------
Write-Section "対象ユーザーの存在を確認します: $Email"

# admin-get-user の結果でユーザー有無を判定する。
# UserNotFoundException のみ「未作成」として扱い、その他のエラー
# （権限不足・User Pool ID 不正・認証切れ等）は握りつぶさず中断する。
$getUser = Invoke-Cli -Exe 'aws' -CliArgs @(
    'cognito-idp', 'admin-get-user',
    '--user-pool-id', $userPoolId,
    '--username', $Email,
    '--region', $region,
    '--output', 'json'
)

$userExists = $false
if ($getUser.ExitCode -eq 0) {
    $userExists = $true
    Write-Host '既存ユーザーが見つかりました。属性とパスワードを更新します。'
}
elseif ($getUser.StdErr -match 'UserNotFoundException' -or $getUser.StdOut -match 'UserNotFoundException') {
    $userExists = $false
    Write-Host '未作成のユーザーです。新規に作成します。'
}
else {
    Fail "ユーザーの存在確認に失敗しました。`n$($getUser.StdErr)" 'AWS の権限（cognito-idp:AdminGetUser）や User Pool ID を確認してください。'
}

# --- 5. パスワードの対話入力 -----------------------------------------------
Write-Section 'パスワードを入力してください（画面には表示されません）'
Write-Host 'パスワードポリシー: 8 文字以上／大文字・小文字・数字・記号を含む' -ForegroundColor DarkGray

$securePassword = Read-Host -AsSecureString 'Password'
if (-not $securePassword -or $securePassword.Length -eq 0) {
    Fail 'パスワードが入力されませんでした。' 'もう一度実行し、パスワードを入力してください。'
}

# --- 6. ユーザーの作成 or 属性更新 -----------------------------------------
# email / email_verified（+ name）を設定する。
# 招待メールは送らない（開発用途のため --message-action SUPPRESS）。
$attributes = @(
    "Name=email,Value=$Email",
    'Name=email_verified,Value=true'
)
if (-not [string]::IsNullOrWhiteSpace($Name)) {
    $attributes += "Name=name,Value=$Name"
}

if (-not $userExists) {
    Write-Section 'Cognito ユーザーを作成します'
    $createArgs = @(
        'cognito-idp', 'admin-create-user',
        '--user-pool-id', $userPoolId,
        '--username', $Email,
        '--user-attributes'
    ) + $attributes + @(
        '--message-action', 'SUPPRESS',
        '--region', $region,
        '--output', 'json'
    )
    $create = Invoke-Cli -Exe 'aws' -CliArgs $createArgs
    if ($create.ExitCode -ne 0) {
        Fail "ユーザー作成に失敗しました。`n$($create.StdErr)" 'AWS の権限（cognito-idp:AdminCreateUser）やメール形式を確認してください。'
    }
    Write-Host 'ユーザーを作成しました。'
}
else {
    Write-Section '既存ユーザーの属性を更新します'
    $updateArgs = @(
        'cognito-idp', 'admin-update-user-attributes',
        '--user-pool-id', $userPoolId,
        '--username', $Email,
        '--user-attributes'
    ) + $attributes + @(
        '--region', $region,
        '--output', 'json'
    )
    $update = Invoke-Cli -Exe 'aws' -CliArgs $updateArgs
    if ($update.ExitCode -ne 0) {
        Fail "属性更新に失敗しました。`n$($update.StdErr)" 'AWS の権限（cognito-idp:AdminUpdateUserAttributes）を確認してください。'
    }
    Write-Host '属性を更新しました。'
}

# --- 7. 恒久パスワードの設定 -----------------------------------------------
# SecureString を一時的に平文化して aws CLI へ渡し、直後に破棄する。
# （admin-set-user-password は標準入力に対応しないため、この方法をとる）
Write-Section '恒久パスワードを設定します'
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    $setPw = Invoke-Cli -Exe 'aws' -CliArgs @(
        'cognito-idp', 'admin-set-user-password',
        '--user-pool-id', $userPoolId,
        '--username', $Email,
        '--password', $plainPassword,
        '--permanent',
        '--region', $region
    )
}
finally {
    # 平文パスワードを確実に破棄する
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    if (Get-Variable -Name plainPassword -Scope Local -ErrorAction SilentlyContinue) {
        Remove-Variable -Name plainPassword -Scope Local -ErrorAction SilentlyContinue
    }
}

if ($setPw.ExitCode -ne 0) {
    if ($setPw.StdErr -match 'InvalidPasswordException') {
        Fail 'パスワードがポリシーに違反しています。' '8 文字以上で、大文字・小文字・数字・記号を含めてください。'
    }
    Fail "パスワード設定に失敗しました。`n$($setPw.StdErr)" 'AWS の権限（cognito-idp:AdminSetUserPassword）を確認してください。'
}
Write-Host '恒久パスワードを設定しました。'

# --- 8. 最終状態の確認 -----------------------------------------------------
Write-Section '最終的なユーザー状態を確認します'
$finalUser = Invoke-Cli -Exe 'aws' -CliArgs @(
    'cognito-idp', 'admin-get-user',
    '--user-pool-id', $userPoolId,
    '--username', $Email,
    '--region', $region,
    '--output', 'json'
)
if ($finalUser.ExitCode -eq 0) {
    try {
        $status = ($finalUser.StdOut | ConvertFrom-Json).UserStatus
        Write-Host "Email      : $Email"
        Write-Host "UserStatus : $status"
    }
    catch {
        Write-Host 'ユーザーは存在します（状態の解析は省略）。'
    }
}

# --- 9. 次の手順を表示 -----------------------------------------------------
Write-Section '完了。次の手順'
Write-Host @"
1. frontend / backend の .env に Terraform output の値を設定する
   （手順は docs/04-auth-design.md「22.2 dev環境の再構築」を参照）
2. PostgreSQL を起動: docker compose up -d postgres
3. backend を起動 : cd apps/backend  ; npm run start:dev
4. frontend を起動: cd apps/frontend ; npm run dev
5. ブラウザで http://localhost:5173/ を開き、Managed Login からログイン

作成した Email: $Email
（この開発ユーザーで Managed Login にサインインできます）
"@ -ForegroundColor Green
