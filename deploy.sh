#!/bin/bash

# 获取当前脚本的所在目录
SCRIPT_DIR=$(dirname "$(realpath "$0")")

cd "$SCRIPT_DIR" || exit 1

# 设置默认值（与 npx-server/deploy.sh 用法一致：$1=SSH 别名 $2=远程目录 $3=本地目录）
DEFAULT_SSH_ALIAS="m2"
DEFAULT_REMOTE_DIR="/Users/dong4j/Developer/Blog/cover-generator"
DEFAULT_LOCAL_DIR="."

SSH_ALIAS="${1:-$DEFAULT_SSH_ALIAS}"
REMOTE_DIR="${2:-$DEFAULT_REMOTE_DIR}"
LOCAL_DIR="${3:-$DEFAULT_LOCAL_DIR}"

if [ ! -d "$LOCAL_DIR" ]; then
  echo "Error: Local directory '$LOCAL_DIR' not found."
  exit 1
fi

backup_dir="${REMOTE_DIR}_backup_$(date +%Y%m%d%H%M%S)"
echo "Creating backup of remote directory: $REMOTE_DIR"
ssh "$SSH_ALIAS" "rsync -av --exclude \"node_modules/\" \"$REMOTE_DIR/\" \"$backup_dir\" && echo 'Backup created at $backup_dir' || echo 'Backup failed.'"

rsync -avz --progress \
  --exclude '.DS_Store' \
  --exclude '._*' \
  --exclude '__MACOSX' \
  --exclude "deploy.sh" \
  --exclude "package-lock.json" \
  --exclude "node_modules/" \
  --exclude ".git/" \
  --exclude "logs/" \
  "$LOCAL_DIR/" "$SSH_ALIAS:$REMOTE_DIR/"

echo "Upload complete."

ssh "$SSH_ALIAS" "source ~/.nvm/nvm.sh && cd \"$REMOTE_DIR\" && mkdir -p logs && if pm2 describe cover-generator >/dev/null 2>&1; then pm2 reload ecosystem.config.cjs --update-env; else pm2 start ecosystem.config.cjs; fi && pm2 save"
if [ $? -ne 0 ]; then
  echo "Error: Failed to reload cover-generator on server '$SSH_ALIAS'."
  exit 1
fi

echo "Server configuration successfully updated and reloaded on '$SSH_ALIAS'."
echo "Health check: ssh $SSH_ALIAS \"curl -sS http://127.0.0.1:\${PORT:-4321}/health\""
