# Como jogar, testar e publicar

## Por que dar dois cliques no `index.html` não funciona
O jogo é um projeto **Vite**:
- O `index.html` da pasta carrega `/src/main.tsx`, que é código TypeScript/JSX. Só o servidor do Vite traduz esse código para o navegador.
- Os modelos 3D (`.glb`), sons e imagens também precisam ser servidos por HTTP.

Aberto direto do disco (`file://`), o navegador procura `C:/src/main.tsx`, não encontra, e a página ficava só com o fundo escuro. Agora ela mostra uma mensagem explicando o que fazer.

## Jogar no computador (Windows)
**Mais fácil:** dê dois cliques em **`Jogar.cmd`**, na pasta `shinichi-game`.
- Na primeira vez, ele instala as dependências (precisa de internet e do Node.js LTS: https://nodejs.org).
- Depois, abre o jogo no navegador.

**Pelo terminal** (PowerShell ou Prompt de Comando, aberto na pasta `shinichi-game`):
```
npm install
npm run dev
```
- O endereço aparece no terminal, normalmente `http://localhost:5173`. Se essa porta estiver ocupada, o Vite usa a próxima.
- `npm run jogar` faz o mesmo que `npm run dev` e já abre o navegador.

## Testar a versão de produção
```
npm test
npm run build
npm run preview
```
- `npm test` roda os testes automatizados.
- `npm run build` compila para a pasta `dist/` (verifica os tipos antes).
- `npm run preview` serve a pasta `dist/` em `http://localhost:4173`, exatamente como ficará publicada.

A pasta `dist/` também **não abre com dois cliques**. Ela precisa ser servida por HTTP, como qualquer site.

Para testar como no GitHub Pages, com o jogo numa subpasta (PowerShell):
```
$env:BASE_PATH="/shinichi-game/"; npm run build; npx vite preview --base /shinichi-game/
```
Depois abra `http://localhost:4173/shinichi-game/`. No Git Bash, use `MSYS_NO_PATHCONV=1 BASE_PATH=/shinichi-game/ npm run build`, porque o Git Bash converte caminhos que começam com `/`.

## Publicar no GitHub Pages
O fluxo já está pronto em `.github/workflows/deploy.yml`. A cada push na branch `main`, ele:
1. instala;
2. roda os testes;
3. compila com o endereço certo (`/<nome-do-repositório>/`);
4. publica.

**Uma vez só:**
1. Crie um repositório no GitHub, por exemplo `shinichi-game`.
2. Na pasta `shinichi-game`, ligue o projeto a ele e envie:
   ```
   git remote add origin https://github.com/<seu-usuario>/shinichi-game.git
   git push -u origin main
   ```
3. No repositório: **Settings → Pages → Source: GitHub Actions**.
4. Acompanhe em **Actions → Publicar no GitHub Pages**. No fim aparece o endereço: `https://<seu-usuario>.github.io/shinichi-game/`.

Depois disso, cada `git push` publica uma nova versão. Para publicar sem mudar nada: **Actions → Publicar no GitHub Pages → Run workflow**.

**Observações:**
- O nome do repositório vira o caminho do site. O fluxo lê esse nome sozinho; não é preciso editar nada se o repositório for renomeado.
- Todos os arquivos de `public/` (modelos, sons, imagens, ~32 MB) estão no git, então o site publicado tem tudo.
- O repositório pode ser privado só em planos pagos do GitHub; no plano gratuito, o GitHub Pages exige repositório público.

## Instalar como aplicativo (PWA)
Na versão publicada (ou no `npm run preview`):
- **Chrome ou Edge no computador:** ícone de instalar na barra de endereço, ou menu ⋮ → "Instalar Shinichi".
- **Android (Chrome):** menu ⋮ → "Adicionar à tela inicial" ou "Instalar app".
- **iPhone/iPad (Safari):** Compartilhar → "Adicionar à Tela de Início". O iOS tem suporte mais limitado a PWA.

**Funciona offline depois de uma sessão online:** o service worker (`public/sw.js`) guarda o jogo, os modelos e os sons à medida que são usados. Para forçar todos a baixarem de novo depois de mudanças grandes, aumente `VERSION` em `public/sw.js`.

No modo de desenvolvimento (`npm run dev`), o service worker fica desligado de propósito, para não servir código antigo.

## Arquivos envolvidos
| Arquivo | Papel |
|---|---|
| `vite.config.ts` | `base` vem de `BASE_PATH` (padrão `/`) |
| `src/assetPath.ts` | `asset('assets/...')`: caminho certo em qualquer endereço. Use-o para todo arquivo de `public/` citado no código |
| `index.html` | aviso para `file://`, mensagem se o jogo não iniciar, manifesto e ícones |
| `src/ui/CrashScreen.tsx` | mensagem amigável se um arquivo não carregar ou se não houver WebGL |
| `public/manifest.webmanifest`, `public/icons/`, `public/sw.js` | PWA |
| `.github/workflows/deploy.yml` | publicação automática |
| `Jogar.cmd` | atalho para Windows |
