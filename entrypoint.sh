#!/bin/bash

show_usage() {
    echo "Environment Variables:"
    echo "  APP_COMMAND          - 実行するコマンド"
    echo "                          sync-matsui-zaim"
    echo "                          zaim-cli"
    echo "                          login-google"
    echo "  APP_ARGS             - コマンドに渡すオプション/引数"
    echo "  ENABLE_VNC=1         - VNCサーバーを起動する"
    echo "  VNC_GEOMETRY         - VNCサーバーの解像度を設定する（デフォルト1280x960）"
}

# APP_COMMANDが設定されていない場合はヘルプを表示
if [ -z "$APP_COMMAND" ]; then
    echo "Error: APP_COMMAND environment variable is not set"
    echo ""
    show_usage
    exit 1
fi

sudo chown -R "$(id -u):$(id -g)" /home/appuser/.config 2>/dev/null || true

# VNCサーバーを起動する
if [[ "$ENABLE_VNC" = "1" || "$APP_COMMAND" = "login-google" ]]; then
    export DISPLAY=:1
    vncserver "$DISPLAY" -geometry ${VNC_GEOMETRY:-1280x960} -SecurityTypes None
fi

# APP_ARGSを配列に変換（引用符やスペースを正しく処理）
eval "set -- $APP_ARGS"

case "$APP_COMMAND" in
    "sync-matsui-zaim")
        exec ./dist/commands/sync-matsui-zaim.js "$@"
        ;;
    "zaim-cli")
        exec ./dist/commands/zaim/index.js "$@"
        ;;
    "login-google")
        exec ~/.cache/ms-playwright/chromium-1181/chrome-linux/chrome \
            --user-data-dir="$CHROMIUM_USER_DATA_DIR_GOOGLE" \
            "$@"
        ;;
    *)
        echo "Error: Unknown command '$APP_COMMAND'"
        echo "Valid commands: sync-matsui-zaim, zaim-cli, login-google"
        echo ""
        show_usage
        exit 1
        ;;
esac
