# Mapa do Colapso · integração Vercel V1

Arquivos:
- `mapa.html`: experiência do Mapa com captura real, resultado imediato, CTA humano e tentativa de envio por e-mail.
- `api/mapa.js`: Vercel Function sem dependências externas de npm. Salva no Supabase e envia via Resend.
- `supabase/schema.sql`: tabelas mínimas `contacts` e `map_sessions`, com RLS ativado.

## Variáveis de ambiente necessárias na Vercel

Obrigatórias para banco:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Para e-mail:
- `RESEND_API_KEY`
- `MAPA_FROM_EMAIL` (ex.: `Mapa <mapa@seudominio.com.br>`, depois de verificar o domínio no Resend)

Recomendadas:
- `MAPA_REPLY_TO`
- `MAPA_SITE_URL`
- `DULCE_CONTACT_URL`

Sem Supabase configurado, o resultado continua aparecendo na tela, mas a API retorna que banco/e-mail não estão ativos. Sem Resend, o lead é salvo e `email_sent=false`.

## Fluxo

1. Usuário escolhe rota e responde 3 perguntas.
2. Recebe primeira clareza.
3. Informa nome/e-mail e reconhece a política; marketing continua opcional.
4. Front-end envia somente categorias estruturadas + snapshot do resultado para `/api/mapa`.
5. API faz upsert do contato e cria uma sessão do Mapa.
6. Resultado aparece na tela independentemente do e-mail.
7. Se Resend estiver configurado, envia assunto neutro: `Seu Mapa está pronto.`
8. Resultado oferece CTA `Quero organizar isso com a Dulce`, sem transportar respostas pessoais automaticamente para a conversa.

## Antes de produção
- validar Política de Privacidade/LGPD e trocar a frase temporária do checkbox pelo link definitivo;
- configurar domínio/remetente do Resend;
- definir a URL oficial de contato/WhatsApp da Dulce;
- executar teste de lead real e confirmar registro + e-mail;
- manter comunidade/grupo fora desta entrega até existir moderação e protocolo próprios.
