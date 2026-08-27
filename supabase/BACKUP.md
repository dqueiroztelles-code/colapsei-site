# Backup da base de leads

O Supabase Free não oferece o mesmo histórico automático de backups dos planos pagos. O esquema está versionado neste repositório e os dados podem ser exportados com o script abaixo.

1. Instale e autentique a Supabase CLI.
2. Defina `SUPABASE_DB_URL` somente no terminal ou em um cofre de segredos.
3. Execute `sh scripts/backup-supabase.sh`.
4. Guarde os dois arquivos gerados em local privado e criptografado.

Os arquivos ficam em `backups/`, diretório ignorado pelo Git. Eles contêm dados pessoais e nunca devem ser publicados no repositório.
