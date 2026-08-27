#!/usr/bin/env sh
set -eu

: "${SUPABASE_DB_URL:?Defina SUPABASE_DB_URL com a conexão direta do banco.}"

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_dir="$project_dir/backups"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup_dir"

supabase db dump --db-url "$SUPABASE_DB_URL" --file "$backup_dir/schema-$timestamp.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy --file "$backup_dir/data-$timestamp.sql"
chmod 600 "$backup_dir/schema-$timestamp.sql" "$backup_dir/data-$timestamp.sql"

echo "Backup concluído em $backup_dir"
