# Colapsei. E Agora? — Homologação

Versão estática de homologação da Home e páginas prototipadas.

## Rodar localmente

```bash
python3 -m http.server 4173
```

Abra `http://localhost:4173`.

## Publicar com GitHub CLI

```bash
git init
git add .
git commit -m "Homologação inicial do site"
git branch -M main
gh auth login
gh repo create colapsei-site --private --source=. --remote=origin --push
```

## Publicar na Vercel

```bash
npm install -g vercel
vercel login
vercel
```

Para promover a versão aprovada para produção provisória:

```bash
vercel --prod
```

A versão de homologação está bloqueada para indexação por buscadores por `robots.txt`, meta robots e cabeçalho `X-Robots-Tag`.
