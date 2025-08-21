#!/bin/bash

show_usage() {
    echo "Usage: $0 <command> [args...]"
    echo "Commands:"
    echo "  sync-matsui-zaim - 松井証券の資産情報をZaimに同期する"
    echo "  zaim-cli         - Zaim APIのコマンドラインラッパー"
}

if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

COMMAND=$1
shift

case "$COMMAND" in
    "sync-matsui-zaim")
        exec ./dist/commands/sync-matsui-zaim.js "$@"
        ;;
    "zaim-cli")
        exec ./dist/commands/zaim/index.js "$@"
        ;;
    *)
        echo "Error: Unknown command '$COMMAND'"
        show_usage
        exit 1
        ;;
esac
