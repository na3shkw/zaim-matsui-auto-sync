#!/bin/bash

show_usage() {
    echo "Environment Variables:"
    echo "  APP_COMMAND          - 実行するコマンド"
    echo "                          sync-matsui-zaim"
    echo "                          zaim-cli"
    echo "                          login-google"
    echo "  APP_ARGS             - コマンドに渡すオプション/引数"
    echo "  PUID                 - マウントされたファイルの所有者UID（デフォルト: 設定なし＝変更しない）"
    echo "  PGID                 - マウントされたファイルの所有者GID（デフォルト: 設定なし＝変更しない）"
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

# PUID/PGIDが指定されている場合のみ、nodeユーザーのUID/GIDを動的に変更する
if [ -n "$PUID" ] || [ -n "$PGID" ]; then
    PUID=${PUID:-$(id -u node)}
    PGID=${PGID:-$(id -g node)}
    if [ "$PGID" != "$(id -g node)" ] || [ "$PUID" != "$(id -u node)" ]; then
        echo "Changing node user UID:GID to $PUID:$PGID"
        sed -i "s/^node:x:[0-9]*:[0-9]*:/node:x:$PUID:$PGID:/" /etc/passwd
        sed -i "s/^node:x:[0-9]*:/node:x:$PGID:/" /etc/group
        chown -R node:node /home/node/.config
    fi
fi

# VNCサーバーを起動する
if [[ "$ENABLE_VNC" = "1" || "$APP_COMMAND" = "login-google" ]]; then
    export DISPLAY=:1
    gosu node vncserver "$DISPLAY" -geometry "${VNC_GEOMETRY:-1280x960}" -SecurityTypes None
fi

# APP_ARGSを配列に変換（引用符やスペースを正しく処理）
eval "set -- $APP_ARGS"

case "$APP_COMMAND" in
    "sync-matsui-zaim")
        exec gosu node ./dist/commands/sync-matsui-zaim.js "$@"
        ;;
    "zaim-cli")
        exec gosu node ./dist/commands/zaim/index.js "$@"
        ;;
    "login-google")
        chromium=$(find /ms-playwright/ -executable -name chrome -print -quit)
        exec gosu node "$chromium" \
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
