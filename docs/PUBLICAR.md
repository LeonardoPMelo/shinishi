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

Para testar como no GitHub Pages, com o jogo na subpasta `/shinishi/` (PowerShell):
```
$env:BASE_PATH="/shinishi/"; npm run build; npm run preview -- --base /shinishi/ --port 4175 --strictPort
```
Depois abra `http://localhost:4175/shinishi/`. No Git Bash, use `MSYS_NO_PATHCONV=1 BASE_PATH=/shinishi/ npm run build`, porque o Git Bash converte caminhos que começam com `/`. No Claude Code, a configuração `shinichi-pages` em `.claude/launch.json` (na pasta acima do jogo) faz o mesmo preview.

## Roteiro completo: rodar, testar e publicar
Este é o roteiro usado na Etapa 10. Siga na ordem; se um passo falhar, pare e corrija antes do próximo.
1. **Testes:** `npm test`, todos passando.
2. **Compilar:** `npm run build` (checa os tipos antes). Anote o tamanho do pacote principal (hoje ~900 KB, gzip ~285 KB).
3. **Testar na subpasta**, como acima. Confira:
   - o menu abre e o console não mostra arquivo faltando;
   - "Começar" carrega a vila (modelos e sons);
   - em Configurações, a seção "📲 Instalar" aparece.
4. **Testar no celular** (ou no modo celular do navegador, em pé e deitado): os botões de toque não cobrem o quadro de missões nem os corações.
5. **Mudou arquivo de `public/`?** Aumente `VERSION` em `public/sw.js`, para quem já jogou baixar a versão nova.
6. **Publicar:** commit na `main` e `git push origin main`. **Nunca** envie o ramo `historico-local`.
7. **Conferir:** em Actions, o fluxo "Publicar no GitHub Pages" termina verde (~1 minuto). Depois abra https://leonardopmelo.github.io/shinishi/. O service worker busca a página na rede primeiro, então a versão nova aparece logo; sem internet, abre a última guardada.

## Publicar no GitHub Pages
**Publicado em:** https://leonardopmelo.github.io/shinishi/ (repositório `LeonardoPMelo/shinishi`).

**Dia a dia:** faça o commit e rode `git push`. O fluxo testa, compila e publica em ~1 minuto. **Não use "Add files via upload" na página do GitHub:** ele não envia as pastas (`src/`, `public/`, `.github/`), e o site fica sem o jogo.

**Ramos locais:**
- `main` é exatamente o que está no GitHub.
- `historico-local` guarda o histórico de desenvolvimento, que contém as artes de aniversário com o nome da criança. **Nunca envie esse ramo.**

As artes `public/assets/ui/birthday.webp` e `references/concept/06-birthday.webp` ficam só neste computador (`.gitignore`). No site, a comemoração usa a arte normal.

**Configuração recomendada:** em Settings → Pages → Source, escolha **GitHub Actions**. Hoje ainda está em "Deploy from a branch", que publica também uma cópia crua (sem compilar) a cada push. As duas publicações disputam o mesmo site, e a crua mostra a tela "O jogo não conseguiu iniciar".

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

## Jogar com controle
O jogo aceita controles de Xbox, PlayStation, Switch Pro e genéricos, por cabo ou Bluetooth, no computador ou no celular (Chrome, Edge, Firefox; no iPhone, Safari). O navegador só reconhece o controle depois que um botão é apertado com a página aberta.
- O mapa de botões aparece em **Configurações → Controle**. As dicas na tela passam a mostrar os botões do controle conectado (✕ no PlayStation, A no Xbox).
- **Nos menus, diálogos e desafios:**
  - direcional ou analógico esquerdo escolhe;
  - botão de baixo (A ou ✕) confirma;
  - botão da direita (B ou ○) volta;
  - Start pausa.
- **No celular**, com o controle em uso, os botões de toque somem. Tocar na tela traz os botões de volta.
- **Código:** `src/game/systems/gamepad.ts`. Testes: `tests/gamepad.test.ts`.

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
