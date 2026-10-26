# Relatório final — Prompt Mestre (Etapas 0 a 8)

**Shinichi — O Caminho do Gato Ninja** · 2026-10-24 a 2026-10-26 · máquina de teste: AMD Radeon Vega 8 integrada, 8 núcleos, 8 GB.

Convenção usada em todo o relatório:
- **Medido:** executado e lido nesta máquina.
- **Estimado:** deduzido de outras medidas.
- **Planejado:** não feito.
- **Outro ambiente:** depende de algo que não existe aqui.

Os detalhes de cada etapa estão em `docs/REFORMULACAO.md` (§29 a §38). A auditoria inicial está em `docs/AUDITORIA_PROMPT_MESTRE.md`.

## Resumo em números (antes → final, medido)

| Medida | Antes (auditoria, 2026-10-24) | Final (2026-10-26) |
|---|---|---|
| FPS real em produção, praça, qualidade automática no degrau 6 | 18–21 | **~41–42** (A/B de hoje, 7 janelas de 10 s cada versão) |
| GPU na praça, degrau 0 (timer query, dev) | 40,6 ms | 15,0 ms * |
| GPU no mercado / bairro leste, degrau 0 | 67,1 / 72,2 ms | 23,5 / 21,7 ms * |
| Chamadas de desenho na praça, degrau 0 (dev) | 1.424 | 706 |
| Triângulos na praça | 2,49 M | 2,11 M |
| Materiais distintos | 1.597 | 881 |
| Malhas / geometrias / texturas | 2.014 / 1.868 / 242 | 1.522 / 1.275 / 157 |
| Heap JS | 508 (dev, sem coleta) – 700 MB | 314 MB logo após coleta; picos de ~650 MB durante o bench |
| Testes automatizados | 205 | **251**, todos passando |
| Erros no console de produção | 16 ao carregar (corrigidos na Etapa 3) | 0 (menu, passeio e jogo) |

\* A GPU desta máquina varia 1–3 ms com o aquecimento, e as medidas de hoje e da auditoria são de dias diferentes. As diferenças grandes (40 → 15 ms) são reais; diferenças de 1–2 ms entre etapas não são conclusivas.

## Critérios de aceitação por etapa

| Etapa | Critério | Resultado |
|---|---|---|
| 0. Segurança | Commit base e script de medição | **Cumprido.** Commit base `9e8049a`; `__bench` com 8 câmeras fixas |
| 1. Desempenho | ≥ 45 fps estáveis na praça com degrau ≤ 2; heap < 350 MB; materiais < 300 | **Não cumprido por completo.** 42–47 fps só nos degraus 5–6 (resolução de 66–72%). Nos degraus 2–4, 31–37 fps. Heap < 350 MB só logo após a coleta. Materiais 881. O jogo passou a ser limitado pela CPU (~17 µs por chamada de desenho) |
| 2. Superfícies | Close-ups sem mancha lisa, sem repetição visível, sem pedra plástica | **Cumprido.** Capturas aprovadas por você; custo dentro do ruído (A/B §33) |
| 3. Luz e render | Detalhe preservado; personagens legíveis; custo medido | **Cumprido.** pixels estourados nas luzes: 1,3–8,2% → 0,2–5,1% conforme a captura; custo não mensurável (A/B) |
| 4. Fauna | Animais no chão sem atravessar objetos; < 1,5 ms de GPU | **Cumprido.** 868 verificações sem bicho dentro de colisão ou na água; CPU 0,07 ms; GPU abaixo do ruído |
| 5. Personagens | Sem deslizamento visível | **Cumprido, com uma exceção.** Gato e moradores 0–5%; o Pipo (filhote) ainda desliza 27% (falta um clipe de corrida) |
| 6. Vegetação e composição | Capturas de percurso aprovadas | **Cumprido.** Aprovadas por você em 2026-10-25 |
| 7. Experiência inicial | Novo jogador entende o objetivo em < 1 min | **Cumprido no jogador simulado** (objetivo na tela em 0–0,1 s, missão iniciada em 5–8 s). **Falta o teste com uma criança real** |
| 8. QA e relatório | Diferença clara entre implementado, testado e planejado | Este documento |

## 1. Diagnóstico inicial
Medido na auditoria (`AUDITORIA_PROMPT_MESTRE.md`):
- **Desempenho:** 18–21 fps em produção mesmo com a qualidade no mínimo.
  - Copas transparentes custavam ~10,6 ms.
  - Personagens custavam ~9 ms.
  - Havia 1.597 materiais e um heap de 510–700 MB.
- **Terreno:** a terra era uma mancha laranja lisa, a 8 px/m.
- **Rochas:** dodecaedros iguais e pedras de passagem em forma de disco.
- **Iluminação:** sem tone mapping nem luz do céu.
- **Fauna:** borboletas sem asas, pássaros em forma de triângulo e nenhum coelho.
- **Câmera:** espremida nas varandas.
- **Vegetação:** densidade uniforme.
- **Primeira experiência:** não havia sido desenhada.
- **Repositório:** o projeto não estava em git.

## 2. Causas confirmadas dos defeitos
- **Custo por chamada de desenho, não por pixel.** A ¼ da resolução e sem sombra, o quadro ainda levava ~26 ms. Cada chamada custa ~10–30 µs no ANGLE/D3D11 desta GPU (medido, Etapa 1).
- **Copas transparentes:** toda a folhagem estava no passe transparente desde a correção do granulado. Isso gerava sobreposição de pixels e anulava o teste de profundidade (medido: 10,6 → ~1 ms ao tornar opaco).
- **Memória:** as geometrias de origem ficavam ao lado das versões mescladas (medido: 508 → ~300 MB ao liberar os arrays).
- **"Luzes estouradas":** um corte seco em 1, sem tone mapping.
- **Câmera espremida:** ela só se aproximava, nunca procurava outro ângulo.
- **Primeiro minuto vazio:** o HUD só listava missões ativas, e o faro não apontava nada sem missão.
- **Bugs encontrados no caminho e corrigidos:**
  - o gato encolhia até sumir (arrays de keyframes compartilhados entre clipes);
  - 16 erros de contorno de malha em produção;
  - o gato travava quando a janela ia para segundo plano (a fase do jogo era lida do último render do React).

## 3. Alterações implementadas
| Etapa | Principais mudanças | Commit |
|---|---|---|
| 0 | Git, medição reprodutível (`dev/bench.ts`) | `9e8049a` |
| 1 | Copas opacas com fade só entre câmera e gato; arrays da CPU liberados; LOD e recorte por distância dos moradores; vegetação em blocos; orçamento de sombra; menos chamadas na sombra; física adormecida para corpos fixos; qualidade automática em 7 degraus | `ff5c0e4`, `05c515f`, `bf7c33f` |
| 2 | Shader de terra em coordenadas de mundo; gerador de rochas em 4 tipos; lajes de passagem; calçamento com textura; sombra de contato | `ea5d094`, `6083a51` |
| 3 | Tone mapping próprio para toon; luz do céu por harmônicos esféricos; contato de objetos estáticos; bloom e saturação revistos | `c5c43c9`, `c4c529f` |
| 4 | Coelhos, pássaros que pousam e borboletas com asas: máquinas de estado puras, validadas com raios de física | `58c4ae9` |
| 5 | Passada medida por modelo; agachar aditivo; aceleração dos moradores; sombra de contato suave | `47678fa` |
| 6 | Manchas de densidade, touceiras altas, 3 formatos de arbusto, linha de mata ao fundo (3 planos), câmera que procura vista livre | `da01fbf` |
| 7 | Objetivo em uma linha, patinhas guia, "!" legível, acessibilidade, "Passeio pela vila" | `d9b26c0` |

## 4. Recursos gráficos reconstruídos ou aprimorados
- **Terra e trilhas:**
  - borda recortada por ruído e faixa de grama úmida;
  - dois níveis de tom, pedrinhas e grãos que somem com a distância;
  - as pedrinhas saem do degrau 4 em diante.
- **Rochas:** 4 tipos procedurais (bloco, chata, laje, seixo), com lascas, cor assada por face e musgo; substituíram 15 usos de dodecaedro.
- **Pedras de passagem:** lajes lascadas.
- **Calçamento:** textura de 1024 px com rejunte e musgo.
- **Iluminação:** curva de ombro por canal, sonda de luz do céu e presets revisados.
- **Vegetação:** campo de densidade, touceiras com espigas, 3 arbustos e ~320 árvores no plano médio.
- **Marcador de missão:** selo legível sobre qualquer fundo.

Comparações: `docs/relatorio_final/superficies_*.jpg`, `docs/etapa3/`, `docs/etapa6/`.

## 5. Animais e comportamentos adicionados
- **Coelhos:** 8, em 4 tocas. Farejam, saltam, descansam, se limpam e fogem do gato. **Agachado, o gato chega a ~1,2 m em vez de 3,2 m.**
- **Pássaros:** 9, que pousam nas cercas e nas praças, ciscam, pulam e fogem; mais um bando de 5 no céu.
- **Borboletas:** 15, de flor em flor, com 2 pares de asas articuladas.
- **Custo:** 3 chamadas de desenho + 1 de sombra, 0,07 ms de CPU.
- **Já existiam e foram mantidos:** carpas, patos, garça, libélulas, cervos e coruja.

## 6. Técnicas de renderização efetivamente usadas
- **Materiais:** toon com rampa de 64 tons, rim light e vento no vértice.
- **Luz:** sonda de harmônicos esféricos gerada do domo do céu; tone mapping próprio, com ombro por canal acima de 0,8.
- **Pós-processamento:** bloom com limiar 1,05; upscale com nitidez (CAS) na qualidade automática.
- **Oclusão:** assada nos vértices e num mapa de contato; não há AO em tela.
- **Desenho em lote:** instancing para fauna, vegetação e árvores; geometria estática mesclada com arrays da CPU liberados.
- **Recortes:**
  - recorte por distância e por tamanho;
  - LOD dos moradores;
  - fade só da copa entre câmera e gato.
- **Câmera:** raios do Rapier (pull-in e procura de vista).
- **Avaliado e não adotado:** SSAO/GTAO. Redesenharia a cena num jogo limitado pela CPU (+8–9 ms estimados).

## 7. Otimizações realizadas
Todas medidas na Etapa 1 (§29–31), salvo indicação:
- **Copas:** 10,6 → ~1 ms.
- **Heap:** 508 → ~300 MB.
- **Chamadas na praça:** 1.424 → ~614 em produção no degrau 0, 706 hoje no dev.
- **Física:** 3,5 → 2,5 ms por quadro, adormecendo os corpos fixos.
- **Moradores:** LOD a 7 m e ocultos além de 32 m.
- **Sombra:** sem as peças pequenas e redesenhada em quadros alternados nos degraus baixos.
- **Qualidade automática:** 7 degraus que mudam só o que não recompila shader.
- **Terra:** sem pedrinhas a partir do degrau 4 (sem ganho mensurável no A/B; mantido por não ter custo visual).
- **Custo das etapas visuais (A/B em produção com resfriamento):** a Etapa 3 e as Etapas 6+7 não tiveram custo mensurável.

## 8. Testes executados e resultados (todos executados nesta máquina)
| Teste | Resultado |
|---|---|
| Vitest: 251 testes em 20 arquivos (campanha completa, dados, desafios, fauna, passada, luz, rochas, composição, primeiro minuto, loja, estado do jogo) | **251 passando** |
| `tsc --noEmit` e build de produção | ok |
| Console de produção: menu, passeio e jogo | **0 erros** |
| Colisões: 8 casas × 4 faces, correndo contra a parede (`__qa.walls`) | nunca entrou (para a 0,44 m), nunca travou |
| Ponte: atravessar andando, correndo e junto às duas grades | atravessa nos 4 casos, sem cair |
| Câmera em 6 trechos apertados (`__compo.camera`, 5 rodadas) | espremida **1,2–6,2%** do tempo (antes 27,4%), visão bloqueada **0%** (antes 2,6%) |
| Primeiro minuto, jogador simulado, jogo novo (`__onb.firstMinute`, 2 rodadas) | objetivo em 0–0,1 s; patinhas em 2,7–5,4 s; Chef Hana em 4,1–6,7 s; missão ativa em 5,2–8,2 s |
| Fauna no jogo com física real | 868 verificações, nenhum bicho em colisão ou na água |
| FPS em produção, A/B Etapa 5 × final, degrau 6, resfriamento de 2 min | 48, 48, 44, 40, 38, 38, 39 × 48, 39, 39, 40, 39, 41, 43: **diferença dentro do ruído** |
| HUD em celular (375 px, controles de toque) | cartão do objetivo cabe; texto de toque; botões não cobrem o cartão |

## 9. Comparações visuais antes e depois
- `docs/relatorio_final/superficies_1.jpg` e `superficies_2.jpg`: 6 câmeras fixas, do início da Etapa 2 ao final.
- `docs/relatorio_final/percurso_1.jpg` e `percurso_2.jpg`: o percurso de 9 paradas, do início da Etapa 6 ao final.
- Por etapa:
  - `docs/etapa3/` (luz, entardecer e dia);
  - `docs/etapa4/fauna.jpg`;
  - `docs/etapa5/passadas.jpg`;
  - `docs/etapa6/`;
  - `docs/etapa7/passeio.jpg`.
- As comparações antes da Etapa 2 (auditoria) ficaram em `tools/art-staging/aud_*.png`. A câmera manual usada naquela sessão não existe mais, então não há par exato com o final.

## 10. Problemas pendentes e limitações reais

**Não atingido**
- Meta de desempenho: ≥ 45 fps com degrau ≤ 2. O jogo roda a ~41–42 fps no degrau 6 (resolução de 66–72%). O limite é a CPU. Os próximos passos seriam:
  - instanciar peças repetidas;
  - congelar as matrizes dos ramos estáticos;
  - reduzir os ~330 corpos de física.
- Materiais: 881 (meta < 300).
- Heap: picos de ~650 MB; < 350 MB só logo após a coleta.

**Conhecido e não corrigido**
- **Pipo:** desliza 27%; precisa de um clipe de corrida.
- **Corrida do gato:** fica no ritmo máximo do clipe (3,6×).
- **Bambuzal:** o telhado do portal esconde o gato na entrada (não tem colisor); a grama alta ficou um pouco desgrenhada.
- **Câmera:** no beco do bairro leste fica espremida até 15% do tempo numa rodada, com distância média de 2,9 m.
- **Pássaros:** não pousam em telhados.
- **Sombra dos coelhos:** usa a pose de repouso.
- **Tamanho do texto:** só afeta o que é medido em `rem`.
- **Bloom:** forte nos emissivos no degrau 0.
- **Preset noturno:** não existe.

**Planejado e não feito**
- Folhas secas e gravetos na terra.
- Relevo do terreno: o mundo continua plano, com relevo só em blocos.
- Remapeamento de teclas e modo para daltonismo.
- Sons de animais e legendas para sons.

**Depende de outro ambiente ou de outras pessoas**
- **Áudio definitivo:** as músicas e sons atuais são provisórios, gerados por código. O jogo aceita arquivos licenciados.
- **Teste com uma criança que nunca jogou:** é o único que confirma o critério da Etapa 7. Pedido: observar sem ajudar e anotar o tempo até ela falar com a Chef Hana.
- **Outras máquinas:** celular real (só emulado), outra GPU e outros navegadores não foram testados. Todas as medidas são desta GPU integrada.
- **Concurso:** nenhum regulamento foi informado, então os critérios não foram conferidos contra um alvo.

**Limitações das medições**
- O timer de GPU varia 1–3 ms com o aquecimento, e as comparações de dias diferentes são indicativas.
- O FPS só vale com a janela em primeiro plano: em segundo plano o navegador desenha a ~0,5 quadro/s, o que invalidou algumas rodadas, refeitas depois.
- A câmera e o primeiro minuto variam entre rodadas, por isso aparecem como faixas.
