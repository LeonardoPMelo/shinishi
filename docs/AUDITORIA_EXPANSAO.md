# Auditoria para a expansão (Prompt Mestre: Evolução Profissional) — Etapa 1

Data: 2026-10-29. Versão auditada: `7a64bbb` (publicada em https://leonardopmelo.github.io/shinishi/).

Como ler:
- **Confirmado:** executado ou medido nesta máquina.
- **Inspeção:** lido no código, sem execução.
- **Manual:** depende de validação manual, como um teste com controle físico, celular real ou uma criança jogando.

## 1. Arquitetura encontrada
| Camada | O que existe |
|---|---|
| Base | React 18 + TypeScript 5 + Vite 5. Testes com Vitest + happy-dom (267 testes) |
| 3D | three 0.160, @react-three/fiber 8, drei 9. Um único mundo contínuo (vila + 3 bairros + bosque + templo), sem carregamento por região |
| Física | @react-three/rapier (corpos fixos dormindo, colisões das casas, raios para câmera e fauna) |
| Estado | Zustand com `persist` em `localStorage` (`shinichi-save` versão 4 com migração; `shinichi-ui`; `shinichi-family`) |
| Conteúdo | Orientado a dados em `src/data/*`: 31 missões, 24 personagens, 26 itens, desafios com 3 níveis de dica |
| Desempenho | `StaticMerge` (cenário mesclado), recorte por distância, LOD dos moradores, qualidade automática em 7 degraus |
| Interface | HUD, painéis (Mochila, Missões, Jornada, Mapa, Loja, Ajustes), diálogos, desafios, comemorações, passeio |
| Entrada | Teclado e mouse, toque (joystick e botões), controle (Gamepad API) |
| Áudio | Motor próprio (WebAudio) com 4 canais e volumes separados. 10 músicas e 24 efeitos CC0 (créditos), 13 efeitos sintetizados |
| Publicação | GitHub Actions → GitHub Pages (`BASE_PATH`); PWA (manifesto, ícones, service worker v2) |

## 2. Classificação dos componentes

### 2.1 Funcionais e bem implementados (preservar)
- **Movimentação e câmera:** movimento do gato (passada medida, agachar, salto duplo, impulso) e câmera em terceira pessoa com ajuda em lugares apertados. Confirmado nas Etapas 5 e 6 anteriores.
- **Interação por proximidade:** etiqueta [E] / botão de toque / botão do controle, sem sobreposição com diálogos (o controle só age na camada da frente).
- **Missões em dados:** etapas, pré-requisitos (`after`), contadores, rastreamento no HUD e no mapa. Teste de campanha completa: todas as missões podem ser iniciadas e concluídas.
- **Desafios educativos:** dicas graduais em 3 níveis, recompensa paga uma única vez, registro de saberes (Jornada) e prática livre.
- **Fauna:** coelhos, pássaros e borboletas com máquinas de estado testadas.
- **Iluminação, terra, rochas e vegetação:** Etapas 2, 3 e 6 anteriores.
- **Primeiro minuto e acessibilidade:** objetivo em uma linha, patinhas guia, passeio de demonstração, movimento reduzido, texto maior, câmera invertida.
- **Publicação:** GitHub Pages, PWA e controle (confirmados no site publicado).

### 2.2 Funcionais, mas a aprimorar
- **Loja:** uma só vendedora (Sora), 6 ofertas, só compra, em gemas. Não existe venda, nem lojas especializadas.
- **Itens:** 26 no catálogo. Os únicos usos ativos são a poção e as faixas cosméticas. Não há ferramentas nem equipamento com efeito.
- **Treinamento:** argolas com o Mestre Lótus e campo de alvos. Não há academia com salas, instrutores e graduações próprias.
- **Personagens não jogáveis:** rotas simples e falas por condição. Há poucos eventos dinâmicos.
- **Áudio:** 13 efeitos ainda sintetizados (habilidades, miado, fogos, splash). Não há música de combate.
- **Desempenho:** ~41–42 fps em produção no degrau 6, numa GPU integrada Vega 8. A meta antiga de 45 fps com degrau ≤ 2 não foi atingida; o jogo é limitado pela CPU (Relatório Final, §39).

### 2.3 Incompletos ou só visuais
- **Catálogo de modelos:** nomeia 55 modelos, mas só 21 arquivos existem. Os outros 34 (casas, mercado, templo, ponte, árvores, objetos e 2 inimigos) usam a versão procedural.
- **Vida do jogador:** o tipo `PlayerStats` tem `hp` / `maxHp`, mas nada usa esses campos (não há dano nem cura).
- **Inimigos:** `ninja_sombrio` e `raposa_ninja` estão no catálogo de modelos, sem nenhuma implementação.
- **Pendências visuais antigas:**
  - o Pipo desliza 27% na corrida;
  - o telhado do portal do bambuzal esconde o gato;
  - pássaros não pousam em telhados.

### 2.4 Defeituosos — confirmados nesta auditoria e corrigidos nesta etapa
| Defeito | Como foi confirmado | Correção |
|---|---|---|
| **Save incompleto derrubava o jogo para sempre.** Um save de versão antiga, cortado ou editado, sem `flags`/`counters`/etc., quebrava o menu e o jogo a cada carregamento. Recarregar não resolvia e o "Novo jogo" ficava inacessível | No navegador: save com só `missions` → "Cannot read properties of undefined (reading 'lanternas_escuras')" | `store/saveSanitize.ts`: todo carregamento passa por um reparo que completa e valida cada campo e recalcula nível e graduação. 5 testes novos |
| **Tela de erro sem saída e enganosa.** Culpava "um arquivo que não carregou" por qualquer erro e só oferecia recarregar | Mesmo teste | Mensagem com o detalhe real e opção "começar do zero" (com confirmação), que apaga só o save |
| **34 pedidos 404 a cada sessão** (modelos que não existem). Apareciam como erros vermelhos no console do site publicado | Site publicado: 5 erros 404 na cena inicial | Plugin `virtual:model-files` lista os `.glb` reais na compilação; o jogo não pede os que não existem. Produção: 61 pedidos, todos 200 |
| **Ajustes > Áudio dizia que todos os sons eram provisórios e gerados por código** | Manifesto de áudio: 10 músicas e 24 efeitos CC0 | Texto corrigido: o que é gravação CC0 e o que ainda é sintetizado |

**Defeito conhecido, não corrigido:** `tsc -p tsconfig.node.json` acusa 3 erros no `vite.config.ts` porque falta `@types/node`. Não afeta o build (`tsc && vite build` usa o `tsconfig.json`). Corrigir exige instalar um pacote; fica para quando houver aprovação.

### 2.5 Inexistentes e necessários para a expansão
Por inspeção: busca no código por interior, combate, inimigo e vida, sem implementação.
- Interiores com portas e transição (nenhum edifício é explorável por dentro).
- Sede de Mikage (o personagem não existe).
- Academia ninja como área própria, com graduações e minijogos de movimento.
- Combate: vida, dano, inimigos com estados, recompensas. Também as alternativas não violentas (furtividade e distração em inimigos).
- Região selvagem ampla com biomas, cavernas e cânion (hoje há bairros, bosque e mirante, sem perigos).
- Venda de itens, lojas especializadas, ferramentas (lanterna, corda), equipamentos com efeito, colecionáveis por categoria.
- Introdução cinematográfica e linha narrativa por capítulos com Mikage e ameaça principal (hoje há os capítulos 1–3 com mistérios locais).
- Botão "Instalar" da PWA e instruções de instalação manual dentro do jogo.

### 2.6 Redundantes ou prejudiciais
- **Imagens de referência no repositório público.** `references/concept/*` e `tools/art-archive/*` mostram a bandana com um símbolo de folha parecido com o de uma franquia existente. Não aparecem no jogo (a arte do jogo usa a patinha), mas estão públicas no GitHub. **Decisão sua:** tirar do repositório público (mantendo no disco) ou manter.
- **Entradas do catálogo sem arquivo** (34): não fazem mal agora que não são pedidas, mas inflam o catálogo. Ficam até a decisão de quais modelos serão feitos.
- **Campos `hp`/`maxHp` sem uso:** serão usados pelo combate (Etapa 7) em vez de removidos.

## 3. Recursos que devem ser preservados
- Arte e identidade:
  - o gato Shinichi (GLB próprio, com emblema de patinha);
  - os 21 moradores modelados;
  - a vila com cerejeiras, pontes vermelhas e caminhos de pedra;
  - a luz de entardecer.
- As 31 missões, os desafios com dicas graduais, a Jornada de saberes e o registro de aprendizado.
- Fauna, passada, câmera, primeiro minuto, acessibilidade, controle, toque e PWA.
- Ferramentas de QA no modo de desenvolvimento: `__bench`, `__qa`, `__compo`, `__onb`, `__padStep`.

## 4. Lista de pendências (atualizada a cada etapa)
| # | Pendência | Etapa prevista |
|---|---|---|
| 1 | `@types/node` para checar o `vite.config.ts` (precisa instalar pacote) | quando aprovado |
| 2 | Referências com símbolo de folha no repositório público | decisão do usuário |
| 3 | Botão "Instalar" da PWA + instruções manuais | 10 (ou antes, se pedido) |
| 4 | Pipo desliza 27%; telhado do bambuzal esconde o gato | 3 / 9 |
| 5 | 13 efeitos sonoros sintetizados; música de combate | 9 |
| 6 | Desempenho: 45 fps com degrau ≤ 2 não atingido | 9 |
| 7 | Teste com controle físico e celular real | manual |
| 8 | Interiores, Mikage, academia, lojas, região selvagem, combate, narrativa | 4–8 |
