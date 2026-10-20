# Checklist de Servidores SGA

Esta pasta contém a página e a API. A página lê e grava na tabela `public.servidores` do Neon por meio do Worker `checklist-servidores-api` no Cloudflare.

## Antes da primeira publicação

No painel do Cloudflare, abra o Worker `checklist-servidores-api` e entre em **Settings → Variables and Secrets**. Adicione estes dois itens como **Secrets** (segredos de execução):

1. `DATABASE_URL`: string de conexão PostgreSQL do Neon. Copie a conexão da branch `production` e do banco `neondb`; se houver opção **Pooled connection**, escolha-a.
2. `APP_PASSWORD`: crie uma senha para as pessoas que terão acesso ao checklist. Guarde-a em local seguro e não a coloque no GitHub.

Salve os segredos. Os valores não devem ser escritos em nenhum arquivo deste projeto.

## Colocar os arquivos no GitHub

Envie o conteúdo desta pasta para a raiz do repositório privado `checklist-servidores-sga`, mantendo as pastas `public` e `src`.

## Ligar o GitHub ao Cloudflare

No Cloudflare, abra **Workers & Pages → checklist-servidores-api → Settings → Builds → Connect**. Escolha o repositório `checklist-servidores-sga` e a branch `main`. Use:

- **Root directory:** `/` (raiz do repositório)
- **Build command:** `npm install`
- **Deploy command:** `npm run deploy`

O nome do Worker no arquivo `wrangler.jsonc` já está alinhado com `checklist-servidores-api`. Depois da primeira publicação, novos envios para a branch `main` atualizam o site.

## O que o checklist faz

- Busca os servidores do Neon e atualiza a lista a cada 12 segundos.
- Salva marcações, horários, pessoas adicionadas e importações no banco.
- Exporta os dados para CSV e permite importar uma planilha CSV com as colunas `Nome` e `Categoria`.
- Pede a senha em cada sessão do navegador. A senha não é incluída nos arquivos do site.

Use a tabela já criada e preenchida no Neon. Não habilite a Data API pública do Neon para este projeto.
