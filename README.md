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

`POST /api/mapa` valida nome, e-mail, WhatsApp opcional, consentimentos e respostas. Depois:

1. atualiza ou cria o contato no Supabase;
2. salva uma sessão do Mapa sem persistir o texto completo do resultado;
3. envia o resultado ao visitante;
4. envia um aviso operacional para `MAPA_NOTIFY_EMAIL`; o link de WhatsApp só aparece quando houve autorização específica.

O aviso operacional não inclui as respostas pessoais. O telefone é opcional e a continuidade por WhatsApp exige consentimento explícito.

## Livro e Kiwify

O botão de compra leva diretamente ao checkout `https://pay.kiwify.com.br/FMBFGL4`. No desktop ele abre em nova aba; no celular, na mesma tela. Parâmetros `utm_*` e `src` são preservados para atribuição. Pagamento, confirmação e entrega do PDF são operados pela Kiwify.

## Banco

Execute `supabase/schema.sql` no SQL Editor do projeto Supabase. Ele é idempotente e cria as tabelas do Mapa. Em instalações existentes, execute também os arquivos ainda não aplicados de `supabase/migrations/`.

## Critério de lançamento

- domínio correto e variação `www` respondendo com HTTPS;
- um lead real de QA confirmado no Supabase e nas duas caixas de e-mail;
- link de WhatsApp do aviso abrindo a conversa correta;
- checkout da Kiwify abrindo corretamente em desktop e celular;
- compra real de QA confirmada, e-mail recebido e acesso ao PDF validado;
- Home, Mapa e compra validados em desktop e celular.

O produto não diagnostica, não prescreve e não substitui profissionais habilitados ou serviços de emergência.
