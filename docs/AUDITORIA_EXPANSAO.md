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
| 4 | ~~Pipo desliza 27%~~ resolvido na Etapa 3 (0%) | — |
| 5 | 13 efeitos sonoros sintetizados; música de combate | 9 |
| 6 | Desempenho: 45 fps com degrau ≤ 2 não atingido | 9 |
| 7 | Teste com controle físico e celular real | manual |
| 8 | ~~Interiores~~ (Etapa 4); ~~Mikage, academia~~ (Etapa 5); lojas, região selvagem, combate, narrativa | 6–8 |
| 9 | Mais casas com interior (cantina, relojoeiro, Academia e Sede têm) | 6–8, conforme as missões pedirem |
| 10 | A rota escolhida na Expedição (`rota_rio` / `rota_montanha`) precisa mudar o caminho nas terras selvagens | 7 |
| 11 | Som ambiente próprio da Sede (hoje só a música muda dentro dela) | 9 |

## 5. Registro da Etapa 2 — Arquitetura e sistemas centrais (2026-10-29)

### Implementado
| Sistema | Antes | Agora |
|---|---|---|
| **Itens** | Nome, ícone e descrição | Categoria (missão, consumível, equipamento, ferramenta, colecionável, cosmético), raridade, preço de venda, efeito de uso e slot de equipamento (`types/index.ts`). As 6 faixas vão no slot "faixa"; poção e onigiri são consumíveis com efeito; a Pata Dourada é colecionável |
| **Inventário** | Lógica espalhada: store, loja, mochila, controle do gato | Um serviço puro (`systems/inventory.ts`): adicionar/tirar, comprar (moedas ou gemas, item único, saldo validado antes de mudar), vender (itens de missão não se vendem; item vestido não se vende), usar (gasta um, devolve o efeito), vestir/tirar. A store só grava o resultado |
| **Efeitos de itens** | A poção era aplicada dentro do controle do gato | `game/systems/itemEffects.ts`: um único caminho para a tecla 3, o controle e o botão "Usar agora" da mochila |
| **Equipamento** | Flags soltas `veste_<item>`, varridas a cada quadro | `progress.equipped` por slot. Saves antigos são convertidos no carregamento |
| **Estados de missão** | Só "ativa" e "concluída" | `systems/missionState.ts`: bloqueada / disponível / ativa / concluída, derivados do save (não podem ficar desatualizados). O registro de missões mostra as **disponíveis** e quem oferece |
| **Interação** | Escolha do alvo dentro do laço do quadro | `pickInteractable` pura e testada; também bloqueia interação com painel aberto |
| **Colisão** | Portões dos bairros: só os postes eram sólidos | Viga e telhado sólidos (a câmera não atravessa mais o telhado) |

**Decisão registrada:** abandonar missão **não** foi implementado. As etapas entregam itens e flags pelos diálogos, então refazer uma missão pagaria tudo de novo. Volta por missão quando as etapas forem escritas para serem repetíveis.

**Correção de diagnóstico:** a pendência "o telhado do portal do bambuzal esconde o gato" era de enquadramento, não de oclusão. Nas capturas, o gato fica 2,8 m depois do portão, pequeno, acima da borda do telhado.

### Testes executados
- `vitest`: **288 passando** (21 novos em `tests/systems.test.ts`). Cobrem:
  - compra sem saldo, clique duplo em item único, moeda/gema, oferta inválida;
  - venda permitida e proibida;
  - uso com e sem item;
  - vestir, trocar, tirar e perder o item vestido;
  - conversão de save antigo;
  - estados de missão;
  - recompensa paga uma vez (concluir de novo, recomeçar, etapa depois de concluída);
  - etapa fora de ordem;
  - interação fora de alcance, em outro andar, sem rótulo e durante diálogo, desafio, pausa ou painel.
- `tsc` e build de produção: ok.
- No jogo (dev):
  - save antigo com `veste_faixa_rosa` → `equipped.faixa`;
  - mochila: Vestir trocou a faixa, e a captura mostra a faixa azul no gato;
  - "Usar agora" gastou o onigiri, aplicou o impulso e fechou o painel;
  - tecla 3 gastou a poção.
- **Regressão de câmera:** espremida 1,4%, bloqueada 0% (faixa anterior: 1,2–6,2%).
- **Regressão de colisões** (`__qa.walls`, `__qa.bridge`):
  - 8 casas × 4 faces: o gato nunca entra (para a 0,45 m da parede) e nunca trava;
  - ponte atravessada andando, correndo e junto às duas grades.

### Critérios de aceitação
- **Atendido:** os sistemas centrais (itens, inventário, loja, uso, equipamento, missões, interação, save) funcionam juntos, cada regra num lugar só e testada. As lojas, ferramentas e equipamentos das etapas seguintes acrescentam dados, sem duplicar lógica.
- **Pendente:** movimentação sem mudanças nesta etapa. Já havia sido corrigida e medida antes (passada, câmera, colisões) e foi revalidada aqui por regressão.

## 6. Registro da Etapa 3 — Shinichi e gameplay (2026-10-29)

### Implementado
| Mudança | Efeito no jogo (verificado no jogo) |
|---|---|
| **Carinho nos coelhos** (`fauna/brains.ts` `canPet`/`petRabbit`, `world/Fauna.tsx`) | Chegando agachado, a etiqueta "Fazer carinho no coelho" aparece a ~1,5 m, antes de o coelho se assustar (1,22 m). O E faz o carinho: o coelho senta com as orelhas relaxadas, ganha corações e ronronar, e **confia no gato por 14 s**: não foge dele em pé, só de um gato correndo. O contador `carinhos_coelho` fica no save |
| **Emote "Comemorar"** (G no teclado, analógico direito pressionado no controle, botão 🎉 no toque) | O gato fica de pé e comemora (clipe `victory`). Os moradores a até 8 m respondem com uma fala e um pulinho. Medido: 5 moradores reagiram na praça |
| **Pipo sem deslizar os pés** | Velocidade de 3,4 → 2,4 m/s, a maior que o clipe dos moradores cobre no tamanho dele (medido com `gaitFor`: 28% → 0%). No jogo: 395 amostras correndo, deslize máximo 0% |
| **Pedra alta exige o salto duplo de novo** (`TALL_ROCK` 1,8 → 2,4 m) | Defeito antigo descoberto nesta etapa: o pulo simples subia a pedra (pico de ~1,52 m + ~0,38 m que a cápsula sobe ao bater na quina). No jogo, 2,4 m: pulo simples 0/4 sobe, com poção 0/4, salto duplo 5/6 (a sexta falhou por apertar cedo demais, o tempo que o Mestre Lótus ensina) |

### Medido e descartado
**Agarrar e subir bordas:** foi implementado e medido no jogo com pulos contra o degrau de 1,3 m, de 0,1 a 4 m de distância, com e sem a ajuda. Resultados:
- o gato subiu em **todos** os casos, com ou sem ela;
- a base arredondada da cápsula já perdoa bordas até ~0,38 m acima das patas, e a ajuda só agiria numa faixa coberta por isso.

Seria uma ação sem efeito perceptível, então foi **retirada** (o Prompt Mestre pede para não deixar comandos que não funcionam). Volta se aparecerem bordas que o jogador erra na prática.

### Controles revisados
- Todas as ações existem nos três modos (teclado, toque, controle):
  - mover, câmera, pular / salto duplo, agachar, correr;
  - interagir, faro, miado, impulso, shuriken, poção e comemorar.
- O botão 🎉 do toque foi conferido no celular emulado: nenhum botão de toque se sobrepõe. Na primeira posição ele caía em cima do botão de agachar e foi movido.
- O mapa de botões do controle e a lista de teclas nos Ajustes incluem o novo emote.

### Testes
- `vitest`: **295 passando** (7 novos em `tests/gameplay.test.ts`: carinho, confiança, susto com gato correndo, fim da confiança, alcance de cada pulo contra a pedra).
- `tsc` e build ok.

### Pendências
- **Esquiva:** fica para a Etapa 7 (combate). Sem inimigos, seria um segundo "impulso".
- **Nadar e escalar:** não implementados. A água continua sendo um aviso que devolve o gato ao último lugar seco.
- **Alimentar animais:** depende dos petiscos da loja (Etapa 6).

## 7. Registro da Etapa 4 — Casas e interiores (2026-10-29)

### Implementado
| Parte | O que faz |
|---|---|
| **Entrar e sair** (`game/systems/zone.ts`) | Na porta aparece "Entrar: <casa>"; o E escurece a tela, põe o gato num ponto livre do outro lado, vira a câmera para onde ele anda e clareia. Dentro, "Sair" na porta faz o caminho de volta, e o gato sai de frente para a rua, 1,4 m fora da casa. O mundo de fora fica escondido enquanto se está dentro (desempenho). A zona **não** vai para o save: recarregar dentro de uma casa volta para fora, com o progresso intacto |
| **Salas** (`data/interiors.ts`, `game/world/Interiors.tsx`) | **Cantina da Chef Hana** (balcão, fogão, prateleiras, quadro de receitas, aquário, 3 mesas baixas com almofadas, barris, lanternas, janelas) e **Casa do Relojoeiro** (relógio de pêndulo, bancada, estante, móveis cobertos, tapete, teias). Paredes e móveis sólidos. A parede sul (entre a câmera e o gato) é desenhada baixa, mas continua sólida na altura toda; a saída é um capacho iluminado. As salas ficam longe do mapa (x > 150), sem chance de se cruzarem com a vila |
| **Objetos interativos** | Pilha de tigelas (desafio), baú da cantina (moedas + onigiri, abre uma vez), aquário e quadro de receitas (falas), diário (pista), relógio (desafio; os ponteiros mostram 7:40 e, resolvido, 3:00 com o compartimento aberto), compartimento (engrenagem dourada, abre uma vez), estante |
| **Moradora nova: Mimi** | Ajudante da cantina, modelo próprio (gata malhada laranja, bata azul, avental e bandana; Blender, 360 KB + LOD de 209 KB) |
| **Missões** | **Mesa Posta** (Mimi; multiplicação e subtração: 3 × 4 − 5 = 7) e **O Relógio Parado** (Vovó Mochi; ler o diário, ângulo reto no relógio = 3 horas, compartimento secreto, contar à Mochi; medalha "Detetive do Tempo") |
| **Navegação** | De fora, o rastro do objetivo e o mapa apontam para a **porta** da casa onde está o alvo; de dentro, para o próprio alvo (`reachablePosition`). Dentro, o minimapa dá lugar ao nome da sala |

### Defeitos encontrados e corrigidos nesta etapa
- **O gato voltava para dentro da sala ao sair** (e às vezes não entrava): a zona mudava, mas o corpo ficava onde estava. A causa foi achada instrumentando `setTranslation`:
  - o `userData={{ player: true }}` do corpo do Shinichi era um objeto novo a cada renderização;
  - o @react-three/rapier trata isso como uma opção mudada e põe o corpo de volta onde o objeto 3D estava no último passo da física;
  - a troca de zona renderiza a cena de novo entre dois passos, e isso desfazia o teletransporte.
  
  Agora é uma constante. Depois disso: **12 de 12 travessias** (2 casas × 3 voltas × entrar e sair) caíram exatamente no ponto esperado (desvio 0,00 m), com o rótulo certo em cada uma.
- **O registro de missões mostrava como "disponível" uma missão que o NPC não oferecia.** Cada morador oferece uma coisa de cada vez (a primeira fala que vale ganha). O registro lia a lista de ofertas em outra ordem. Dois casos:
  - **Vovó Mochi** (o relógio): agora vem depois da horta, ponte → horta → relógio, com a mesma condição no registro e na fala;
  - **Seu Bigodes** (anterior a esta etapa: o registro dizia "peixe fujão", a fala oferecia o banquete): as ofertas do Capítulo 3 agora entram **depois** das ofertas antigas de cada morador, na mesma ordem do registro (`data/npcs.ts`).
- **Ponteiros do relógio:** eram barras centradas, então às 3:00 formavam um "+". Agora saem do centro.
- **Parede da frente escondia o gato** (vista nas capturas): virou meia-parede. As janelas passaram para as paredes laterais. O vazio amarelo em volta da sala virou chão escuro.

### Testes
- `vitest`: **316 passando**. `tests/interiors.test.ts` (15 testes) cobre:
  - porta de fora no muro da casa, ponto de saída fora da casa e em área andável;
  - ponto de entrada longe das paredes e de todo móvel sólido (folga > raio da cápsula);
  - salas longe do mapa e uma da outra;
  - nada pendurado na parede baixa;
  - objetos e a Mimi na sala certa;
  - alvo dentro de casa → porta;
  - respostas dos desafios e etapas das missões;
  - **para todo morador, em 4 saves diferentes, a missão que o registro chama de disponível é a que a fala começa.**
- `tsc` e build de produção: ok.
- **No jogo (dev, pela interface):**
  - **Mesa Posta** completa: falar com a Mimi → pilha de tigelas → 7 no teclado numérico → Mimi (recompensas e onigiris);
  - **O Relógio Parado** completo: Mochi → porta (o rastro apontava para a porta) → diário → relógio (6 horas errado mostra a dica; 3 horas certo) → compartimento (engrenagem, abre uma vez) → Mochi (medalha);
  - baú da cantina abre uma vez e some;
  - paredes: o gato para a ~0,35 m nas 4 paredes das duas salas;
  - recarregar dentro de uma casa: volta para fora, missões e itens intactos;
  - console: nenhum erro nesta carga.
- Capturas: `docs/expansao/etapa4_cantina.jpg`, `etapa4_relojoeiro.jpg`, `etapa4_porta_cantina.jpg`.

### Critérios de aceitação
- **Atendido:** o jogador entra e sai das casas sem ficar preso nem atravessar paredes (medido) e sem perder progresso (recarregar dentro de uma casa preserva tudo).
- **Verificação manual pedida:** jogar no celular real e com controle físico (o E da porta é a mesma ação de interagir que já funciona nos três modos).

### Pendências
- Só duas casas têm interior; as outras continuam fechadas (pendência 9).
- O "cair do mapa" (y < −5) devolve o gato ao ponto inicial da vila mesmo dentro de uma sala. Nunca aconteceu nos testes (chão e paredes sólidos), mas fica registrado.
## 8. Registro da Etapa 5 — Mikage e Academia Ninja (2026-10-29)

### Implementado
| Parte | O que tem e o que dá para fazer |
|---|---|
| **Academia Ninja** (no dojô da praça; `data/academy.ts`) | Sala dos Números, Sala da Lógica, Corredor do Rouxinol, pátio do Circuito das Patas e a entrada. Professores novos: **Sumi** (diretora, números e lógica) e **Haru** (movimento e furtividade). Missão **A Academia Ninja**: matrícula → quatro selos, em qualquer ordem → formatura |
| Selo dos Números | Quadro com 3 problemas, um de cada vez, de dificuldade crescente: sequência (2, 5, 11, 23 → 47), frações dividindo suprimentos (36 − 1/3 − 1/4 = 15) e medidas (3 m 20 cm ÷ 40 cm = 8). Depois, um desafio extra opcional de álgebra (×3 + 4 = 31 → 9) |
| Selo da Lógica | Alavancas com símbolos (🐟 🌙 🍃 🔔), puxadas na ordem que as pistas permitem, em duas rodadas (3 e 4 peças). Errou: as alavancas voltam e o jogo diz **qual pista** não bateu. Depois, treino livre |
| Selo do Silêncio | **Chão-rouxinol** (inspirado no Castelo Nijō, em Kyoto): em pé, as tábuas "piam"; no segundo pio, o Haru ouve e o gato volta ao começo. Agachado, passa em silêncio |
| Selo do Movimento | **Circuito das Patas** com cronômetro na tela: plataformas, viga de equilíbrio, degraus, plataforma alta e volta ao tapete. Rota alternativa pela torre alta, só com o salto duplo. Medalha por tempo (ouro ≤ 13 s, prata ≤ 22 s) e recorde salvo. Cair não zera nada |
| Formatura | Faixa Índigo da Academia (cosmética, vestível), técnica nova **Passo Leve** (agachado anda a 3,3 m/s em vez de 1,9, ainda em silêncio), medalha "Graduado da Academia" e a **chave da Sede** |
| **Sede de Mikage** (`data/mikage.ts`) | Portão imponente no fim da Floresta do Treinamento (telhado duplo, postes vermelhos, portas com a pata dourada, que se abrem quando o Guarda Toshi libera). Dentro: Portão de Entrada, Jardim Ornamental (lago de carpas, lanternas de pedra, bonsais, a Pedra do Pacto), Pátio de Treinamento, Salão de Audiências (Mikage sobre o estrado), Sala de Reuniões, Biblioteca, Escritório de Mikage, Sala de Mapas e **Área Reservada** atrás de uma estante secreta. O HUD mostra o nome de cada área |
| **Mikage** | Personagem original: gato prateado e alto, juba e sobrancelhas brancas, barba, manto índigo com faixa dourada, cajado com sino. Sábio, caloroso e péssimo com papelada. Conta a história da vila: a Grande Cheia e o **Pacto das Patas** ("Ninguém fica para trás. Quem sabe, ensina. Quem erra, tenta de novo"), que liga a Academia à fundação |
| Moradores novos | Sumi, Haru, Mikage, Toshi (guarda), Yuki (estrategista), Fumi (bibliotecário, tanuki). **Seis modelos Blender novos**, comprimidos como os outros (360–398 KB + LOD) |
| Missões da Sede | **A Audiência** (Toshi → Mikage). **Os Registros Sumidos**: 3 páginas em 3 salas, cada uma com uma pista, e a dedução final (o culpado é o próprio Mikage, que usava os registros como porta-copos). **A Expedição**: ler coordenadas no mapa (C4 → E1), **decidir a rota no conselho** (rio ou montanha: muda a conta de suprimentos, 9 ou 15 peixes, e o prêmio, Corda Ninja ou Capa Corta-Vento; a escolha fica salva para a região selvagem) e calcular os suprimentos. **O Segredo da Biblioteca**: o poema do catálogo → 5 livros puxados em ordem → a estante desliza → chão-rouxinol da sala reservada → o **Pergaminho da Fundação** → a história contada pelo Mikage |
| Pátio da Sede | Desafio de precisão opcional: acertar 3 alvos com o shuriken, do menor número para o maior (2, 4, 6) |
| Coerência | A Academia abre depois do Templo dos Enigmas (vira o **Capítulo 5**, "A Academia e a Sede"). O General Hissui, prometido no aviso do próximo capítulo, aparece como rumor na fala da Yuki |

### Sistemas novos (reutilizáveis)
- `systems/orderPuzzle.ts`: quebra-cabeça "na ordem certa", com regras em dados (primeiro, último, antes de, logo depois de...). Os testes provam por força bruta que **cada quebra-cabeça tem exatamente uma resposta**, e o jogo confere as regras, não uma resposta guardada.
- `systems/academy.ts`: circuito com pontos de controle (com rotas alternativas) e o chão-rouxinol.
- Interiores maiores: paredes internas com portas, áreas nomeadas, pisos (tatame em módulos de 1,8 × 0,9 m, areia rastelada, pedra, grama, tábuas de rouxinol), portas trancadas por condição e câmera própria por construção.
- `world/cutaway.ts`: **paredes que abaixam** quando ficam entre a câmera e o gato, nas 4 construções. Os colisores continuam inteiros.
- `data/abilities.ts`: nome, ícone e descrição de cada técnica num lugar só (o aviso de "nova técnica" dizia "Salto Duplo" para qualquer técnica).

### Problemas encontrados no jogo e corrigidos
| Problema | Como apareceu | Correção |
|---|---|---|
| Portão da Sede em cima da escada do Mirante | A primeira posição (norte da praça) passava na checagem física porque a escada ainda está quebrada; ela é consertada na missão da escada | Busca sistemática de espaço livre em todas as bordas, com os colisores; só 3 lugares cabiam. Portão no fim da floresta, ao sul. Teste novo impede voltar |
| Degraus do circuito impossíveis | Pulando de verdade, o gato passava por cima do degrau de 0,8 m e caía no vão (o pulo andando voa ~2 m) | Degrau de 1,4 m e plataforma alta de 1,8 m, vãos de 0,4–0,7 m. Teste: vão + pouso ≥ 1,8 m |
| Medalha de ouro fácil demais | Volta limpa medida: 8,4 s, com o ouro em 22 s | Ouro ≤ 13 s, prata ≤ 22 s. O texto do Haru vem das mesmas constantes |
| Objeto "roubava" a conversa | Perto da Yuki, o E abria o mapa (1,2 m dela); o Fumi com o catálogo; a Mimi (Etapa 4) com o baú da cantina | Moradores afastados. Teste: nenhum objeto a menos de 1,8 m de um morador |
| Estante secreta abria, mas a passagem continuava fechada | O corpo físico fixo não acompanha a mudança de posição do grupo | O corpo é refeito ao abrir (`key`). Medido: a passagem abre |
| O gato sumia atrás das paredes internas | Captura da Sala de Mapas | Paredes que abaixam (`cutaway`) e estantes baixas encostadas nas paredes internas |
| Uma falha num aviso cortava a formatura ao meio | Com um módulo desatualizado no servidor de desenvolvimento, o aviso de técnica nova lançou erro, e a missão seguinte nunca começou | `emit` isola cada ouvinte (o erro é registrado e a lógica do jogo continua). Teste com um ouvinte que lança erro |
| Areia do pátio parecia manchas | Capturas | Areia rastelada: uma cor e linhas finas |

### Testes
- `vitest`: **374 passando** (eram 316). São 26 testes novos em `tests/academy.test.ts`; os testes que percorrem todas as missões, moradores e modelos passaram a cobrir também os novos. Os novos cobrem:
  - cada quebra-cabeça com uma única resposta, e as pistas na tela iguais às regras conferidas;
  - pontos de controle em cima das plataformas, alcance dos pulos, pouso largo;
  - largada → chegada, medalhas, sair da área zera;
  - chão-rouxinol: agachado silencioso, em pé pego, pular não engana;
  - corredor e sala reservada só acessíveis pelas tábuas e pela porta secreta;
  - portas internas largas o bastante, entradas e moradores fora das paredes;
  - áreas nomeadas certas; portão longe do Mirante;
  - respostas dos desafios conferidas pela conta;
  - as cinco missões jogadas do começo ao fim com as ações do próprio jogo, as duas rotas da expedição, e a Sumi sem matricular antes do templo;
  - paredes que abaixam só quando escondem o gato.
- `tsc` e build ok. O pacote principal cresceu de 682 para 760 KB (gzip 217 → 240 KB).
- **No jogo (navegador, física real):**
  - **Academia:**
    - matrícula e formatura pela interface;
    - os 3 problemas do quadro digitados;
    - alavancas: ordem errada (aviso com a pista) e as duas rodadas certas;
    - corredor: em pé, pego após ~1,5 m e devolvido; agachado, atravessa e pega o pergaminho;
    - circuito completo com pulos de verdade (cada pouso conferido pela altura dos pés), 8,4 s, selo e recorde.
  - **Sede:**
    - portão fechado antes do Toshi, aberto depois;
    - caminho da entrada até o salão pelas portas internas;
    - as 4 missões completas: páginas, dedução errada e depois certa, mapa, rota do rio, caixas, livros errados e depois certos, estante bloqueando e depois liberando, chão-rouxinol nos dois jeitos, pergaminho e a história do Mikage;
    - alvos fora de ordem e depois na ordem (15 moedas uma vez só);
    - ao sair, o gato aparece no ponto em frente ao portão.
- Capturas: `docs/expansao/etapa5_*.jpg` (portão fechado e aberto, salão, biblioteca, jardim, sala de mapas, academia, circuito, sala da lógica, elenco).

### Critérios de aceitação
- **Atendido:** as duas áreas têm interações e atividades jogáveis, não só decoração.
  - Na Academia: 4 provas (corpo, silêncio, lógica, números), progressão e recompensas (faixa, técnica, medalha, acesso a uma área nova, reconhecimento dos moradores).
  - Na Sede: 9 ambientes que se percorrem, 4 missões, uma decisão com consequência, uma passagem secreta, um artefato histórico e um desafio opcional.
- **Verificação manual pedida:**
  - circuito e chão-rouxinol com teclado, controle e toque, por uma criança (os tempos das medalhas podem precisar de ajuste);
  - Passo Leve no celular (agachar é o botão 🐾).

### Pendências
- Som ambiente próprio da Sede e da Academia: hoje só a música muda (treino na Academia, mistério na Sede). Pendência 11.
- A escolha de rota ainda não altera um caminho físico: isso só existe quando a região selvagem existir (Etapa 7). Pendência 10.
- Ferramenta de teste: depois de várias edições seguidas, o servidor de desenvolvimento pode servir um módulo desatualizado. Reinicie o servidor antes de testar no navegador.
