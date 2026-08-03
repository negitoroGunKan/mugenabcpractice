@echo off
echo =========================================
echo  早押しクイズ練習アプリを起動しています...
echo =========================================
echo.

:: package.json があるディレクトリで実行されているか確認
if not exist "package.json" (
    echo エラー: package.json が見つかりません。
    echo 正しいフォルダでこのファイルを実行してください。
    pause
    exit /b
)

:: 依存関係がインストールされているか確認し、なければインストール
if not exist "node_modules" (
    echo 初回起動のため、必要なファイルをインストールします（少し時間がかかります）...
    call npm install
)

echo.
echo アプリを起動し、ブラウザを自動で開きます...
call npm run dev
