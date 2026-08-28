# Colapsei. E Agora?

Site público de navegação em saúde mental, com o Mapa do Colapso, páginas de conteúdo e compra do livro digital *Burnoutei, e agora?*.

## Rodar localmente

```bash
npm install
npm test
npm run check
npx vercel dev
```

Copie `.env.example` para `.env.local` e preencha as variáveis somente no ambiente local ou na Vercel. Nunca versione segredos.

## Captação do Mapa

`POST /api/mapa` valida nome, e-mail, WhatsApp, consentimentos e respostas. Depois:

1. atualiza ou cria o contato no Supabase;
2. salva uma sessão do Mapa sem persistir o texto completo do resultado;
3. envia o resultado ao visitante;
4. envia um aviso operacional para `MAPA_NOTIFY_EMAIL`, com link para abrir o WhatsApp do contato.

O aviso operacional não inclui as respostas pessoais. O telefone só é aceito com consentimento explícito para contato via WhatsApp.

## Livro e Kiwify

O botão de compra aponta diretamente para o checkout hospedado pela Kiwify. No desktop ele abre uma nova aba; no celular, continua na mesma aba. Parâmetros UTM da visita são preservados no endereço do checkout.

## Banco

Execute `supabase/schema.sql` no SQL Editor do projeto Supabase. Ele é idempotente e cria as tabelas necessárias ao Mapa.

## Critério de lançamento

- domínio correto e variação `www` respondendo com HTTPS;
- um lead real de QA confirmado no Supabase e nas duas caixas de e-mail;
- link de WhatsApp do aviso abrindo a conversa correta;
- checkout da Kiwify abrindo corretamente em desktop e celular;
- compra real de QA confirmada e instruções recebidas no e-mail informado;
- Home, Mapa e compra validados em desktop e celular.

O produto não diagnostica, não prescreve e não substitui profissionais habilitados ou serviços de emergência.
