# Patch da Home V19 → novo Mapa

Objetivo: conectar todos os CTAs existentes da Home ao Mapa real em `/mapa`, sem apagar a seção antiga e sem mexer em CSS/JS.

Na branch `mapa-v1`, abra `index.html` e use o editor do GitHub.

Faça uma substituição EXATA:

```text
href="#mapa"
```

por:

```text
href="/mapa"
```

Use `Replace All` somente para essa expressão exata.

Hoje esse padrão aparece nos links de:
- menu desktop `Mapa do Colapso`
- CTA do cabeçalho `Faça o Mapa gratuito`
- menu overlay/mobile
- CTA principal da Home
- CTA da seção `O PRIMEIRO PASSO`
- cinco cards de rota

Esperado: 10 substituições.

Não substitua apenas `#mapa` de forma genérica. O objetivo é alterar somente atributos `href` e preservar IDs, CSS e JavaScript.

Commit sugerido:
`Conecta Home V19 ao Mapa V1.3.1`
