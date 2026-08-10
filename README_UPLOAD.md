# Colapsei. E Agora? · Mapa V1.3.1

Este pacote atualiza a branch `mapa-v1` sem tocar na `main`.

## Arquivos deste pacote
- `mapa.html`: Mapa V1.3.1
- `api/mapa.js`: Vercel Function de captura, Supabase e Resend
- `supabase/schema.sql`: banco mínimo para contatos e sessões do Mapa

## O que foi corrigido nesta versão
- copy de captura atualizada: não diz mais que os dados ficam apenas no navegador
- `agora` rosa apenas na frase de marca `E agora?`
- CTA para a Dulce aponta para `/?origem=mapa&rota=<rota>#contato`
- adicionado `privacy_version` ao registro de sessão
- resultado completo é usado para montar o e-mail, mas não é persistido no banco
- consentimento de marketing não é apagado silenciosamente quando alguém refaz o Mapa com checkbox desmarcado
- endpoint preparado para funcionar em Preview e depois no domínio oficial sem hardcode do endereço atual

## Upload no GitHub
Na branch `mapa-v1`, use `Add file > Upload files` e ARRASTE:
1. `mapa.html`
2. a pasta `api` inteira
3. a pasta `supabase` inteira

O GitHub precisa mostrar os caminhos `api/mapa.js` e `supabase/schema.sql` antes do commit.

Depois faça o patch da Home descrito em `HOME_PATCH.md`.

## Banco e e-mail
Após o preview subir:
1. criar/configurar projeto Supabase
2. executar `supabase/schema.sql` no SQL Editor do Supabase
3. configurar na Vercel: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
4. configurar Resend e na Vercel: `RESEND_API_KEY`, `MAPA_FROM_EMAIL`
5. opcional/recomendado: `MAPA_REPLY_TO`, `MAPA_SITE_URL`, `DULCE_CONTACT_URL`

Nunca publique chaves no GitHub.
