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
| 3 | ~~Botão "Instalar" da PWA~~ resolvido na Etapa 10 (Configurações → 📲 Instalar; instruções manuais onde o navegador não oferece). O pedido de instalação real só aparece no Chrome/Edge normais, não no painel de testes | — |
| 4 | ~~Pipo desliza 27%~~ resolvido na Etapa 3 (0%) | — |
| 5 | 16 efeitos sonoros sintetizados (a Etapa 9 somou a gota da caverna); a luta usa a música de treino. Os pacotes Kenney baixados antes não estão mais no computador: trocar por gravações CC0 exige baixar de novo (precisa de aprovação) | quando aprovado |
| 6 | Desempenho: 45 fps com degrau ≤ 2 não confirmado. Medição real exige a janela visível ou um aparelho de verdade (o painel oculto só dá custo de CPU por quadro) | teste manual |
| 7 | Teste com controle físico e celular real (a Etapa 10 conferiu o layout de toque em 8 tamanhos de tela simulados; a captura do usuário no celular levou às correções do templo e do quadro de missões) | manual |
| 8 | ~~Interiores~~ (Etapa 4); ~~Mikage, academia~~ (Etapa 5); ~~lojas~~ (Etapa 6); ~~região selvagem, combate~~ (Etapa 7); ~~narrativa~~ (Etapa 8) | — |
| 9 | Mais casas com interior (cantina, relojoeiro, Academia e Sede têm) | 6–8, conforme as missões pedirem |
| 10 | ~~A rota da Expedição muda o caminho~~ resolvido na Etapa 7: a corda conserta a ponte, a capa vence o vento do mirante; a outra se compra no Armazém | — |
| 11 | ~~Som ambiente da Sede~~ resolvido na Etapa 9 (carrilhão do jardim, eco de sala; Academia com golpes de treino) | — |
| 12 | ~~Poções de cura~~ resolvido na Etapa 7 (Poção de Ervas: Armazém e caldeirão) | — |
| 13 | ~~Corda Ninja e Capa Corta-Vento sem uso~~ resolvido na Etapa 7 | — |
| 14 | ~~Registro de missões × conversa~~ resolvido na Etapa 8: o "!", o registro, o mapa e o próximo passo só anunciam uma missão que a conversa realmente oferece | — |
| 15 | Nas terras selvagens, os bichos voltam a cada visita e pagam moedas de novo (pouco: 3 a 5 por bicho). Depois do pacto (capítulo 7), só restam os espíritos e o javali. Avaliar um limite se a economia pedir | 9 |
| 17 | Templo de Mikage (seção 15): refazer os modelos dos NPCs antigos, conversas entre NPCs e missões novas nas Terras Selvagens ficaram para depois | decisão do usuário |
| 18 | Terras Selvagens (seção 16): aumentar a área, criar mais cavernas, testar o combate num aparelho e gravar sons próprios ficaram para depois | próxima rodada |
| 16 | Pacote principal: 1.038 KB (gzip 325 KB) depois das Terras Selvagens (982 KB após o Templo de Mikage; 901 KB na Etapa 10). Avaliado na Etapa 9: todo esse código é necessário antes do primeiro quadro, então dividir não reduz o que o jogador baixa; só mudaria o cache entre versões. Mantido | — |

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
## 9. Registro da Etapa 6 — Lojas, itens e economia (2026-10-29)

### Auditoria (antes)
- Uma loja só: a Sacola da Sora, com faixas e poções, paga em gemas.
- As **moedas** se acumulavam sem nada para comprar.
- Não havia tela de venda.
- Os slots "coleira" e "mochila" existiam no save sem nenhum item, e nada era desenhado no gato.
- Um só efeito de item (impulso).
- A base (`systems/inventory.ts`, Etapa 2) já validava saldo, item único e venda. Foi aproveitada.

### Implementado
| Parte | O que faz |
|---|---|
| **Três lojas com especialidade** (`data/shops.ts`) | **Peixaria do Seu Bigodes** (moedas, comida com efeito), **Armazém do Boku** (moedas, equipamento; compra o que você achou), **Sacola da Sora** (gemas, enfeites e poções). Cada uma tem dono, cor, frase e balcão na barraca do mercado, com placa |
| **Itens novos, cada um com função** | **Peixe Grelhado** (pula mais alto por 20 s). **Chá de Erva-de-gato** (Faro na hora, 14 s, mesmo recarregando). **Petisco de Atum** (alimenta um coelho, que confia em você por 1 minuto). **Mochila do Explorador** (vestida: bússola na tela até a Pata Dourada mais perto que falta). **Coleira do Faro** (vestida: Faro de 9 s em vez de 6, recarga de 8 s em vez de 12). **Coleira do Sininho** (enfeite) |
| Liberados pela história | Peixe Grelhado depois do Peixe Fujão; Chá depois do Chá da Luna; Mochila depois do Mapa do Tesouro; Coleira do Faro para graduados da Academia. Trancados aparecem com 🔒 e o motivo |
| Tela de loja | Abas Comprar e Vender. Cada item mostra ícone, nome, para que serve, preço e o que falta. Mensagem clara para cada resultado: comprado, falta dinheiro, já é seu, trancado, vendido, vestido (tire antes de vender) |
| Proteções | Clique duplo compra uma vez só (350 ms). Item único não se compra duas vezes. Nenhuma compra ou venda dá lucro (venda sempre abaixo da compra). Coleções e itens de missão não se vendem |
| Vestir | Coleira e mochila aparecem **no Shinichi**, presas aos ossos do modelo (seguem as animações). A mochila mostra a descrição, o efeito e "Vestindo agora" |
| Missão nova | **Amigo dos Coelhos** (Pipo): comprar petiscos, alimentar 3 coelhos, contar o segredo ao Pipo. Medalha "Amigo dos Bichos". Missões antigas apresentam os itens novos: o Peixe Fujão dá um Peixe Grelhado e o Chá da Luna dá um Chá |

### Problemas encontrados no jogo e corrigidos
| Problema | Como apareceu | Correção |
|---|---|---|
| O petisco não dava para usar andando | Andando, o coelho se assusta a 3,2 m, e dar o petisco exige 2,2 m | Com petisco na mochila, o cheiro deixa o coelho curioso: um gato andando chega a ~1,4 m. Correndo, continua assustando |
| Um coelho só contava como vários | O mesmo coelho podia comer de novo segundos depois | Coelho que já confia no gato não come de novo |
| Peixe Grelhado forte demais | Medido: 2,03 m de pulo, que com a subida da cápsula vencia a pedra alta reservada ao salto duplo | Força 1,16 → 1,13: medido 1,90 m. Teste novo protege o portão da Etapa 3 |
| Coleira invisível | A cabeça chibi cobre o pescoço; um anel de 0,11 m sumia no pelo | Medido ao vivo: anel na base do pescoço com 0,24 m. Visível de trás, a câmera normal de jogo |
| Placas escondidas pelas lanternas | Captura do mercado | Placas acima do varal de lanternas |
| Itens antigos sem dizer para que servem | Tela da Peixaria | Onigiri, poção e faixas ganharam a linha de efeito |

### Testes
- `vitest`: **395 passando** (eram 374). São 21 testes novos em `tests/economy.test.ts`, mais um teste antigo (`tests/shop.test.ts`) atualizado: ele esperava que dois cliques instantâneos comprassem duas vezes, e a Etapa 6 pede o contrário. Cobrem:
  - cada item novo tem função; lojas, moedas e ids certos;
  - **nenhum lucro comprando e vendendo**; pacote mais barato por unidade;
  - compra com e sem saldo, clique duplo, itens trancados que não cobram, item único, moeda certa por loja;
  - quem compra o quê, venda de item vestido;
  - Faro com a coleira; molas que não se somam; efeitos ao comer e beber;
  - bússola (mais perto, ignora as achadas, direção da seta);
  - petisco (alcance, correndo não, coelho já confiante não come de novo, cheiro do petisco);
  - nenhuma comida vence a pedra alta;
  - recompensas novas e a missão completa sem pagar duas vezes;
  - o save guarda itens e equipamentos.
- O validador de dados agora confere as lojas: item existe, id não se repete, trancado diz por quê e toda ação `SHOP:` aponta para uma loja real.
- `tsc` e build ok (pacote principal 775 KB, gzip 245 KB).
- **No jogo (navegador):**
  - **Compras:** balcões abrem as lojas; clique duplo real comprou uma vez (40 → 35 moedas, 3 petiscos); venda (+1 moeda); mochila e coleira compradas pelo Armazém (100 → 35) e vestidas pela mochila.
  - **Persistência:** moedas, itens e missão continuaram iguais depois de recarregar a página.
  - **Efeitos:**
    - bússola mostrando "🐾 17 m";
    - Faro com a coleira: 9 s, recarga 8 s;
    - pulo normal 1,51 m e com o peixe 1,90 m;
    - chá ligando o Faro no meio da recarga, por 14 s.
  - **Coelhos:** 3 alimentados andando, sem agachar.
  - **Missão do Pipo:** completa.
  - **Console:** nenhum erro.
- Capturas: `docs/expansao/etapa6_mercado.jpg`, `etapa6_gato_mochila.jpg`.

### Critérios de aceitação
- **Atendido:** compras, vendas, inventário e efeitos funcionam e não duplicam recompensas.
  - Saldo validado, clique duplo e item único protegidos.
  - Nenhuma compra e venda dá lucro.
  - Recompensas pagas uma vez.
  - O save guarda tudo.

### Pendências
- Poções de cura e itens de combate ficam para a Etapa 7: sem vida e sem inimigos, seriam itens sem função (pendência 12).
- Corda Ninja e Capa Corta-Vento ganham uso na região selvagem (pendência 13).
- Lanterna e áreas escuras: só se a região selvagem tiver cavernas.
- Limite de espaço na mochila: não existe, de propósito (a mochila é pequena e cada item tem uso).
## 10. Registro da Etapa 7 — Região selvagem e combate (2026-10-30)

### Auditoria (antes)
- O mundo era só a vila, os bairros em volta e as casas com interior. Nenhum inimigo, nenhuma vida.
- `PlayerStats.hp`/`maxHp` existiam no save sem uso. O clipe `attack` do Shinichi só tocava com a shuriken.
- A Expedição (Etapa 5) prometia "as terras selvagens", e a Corda Ninja e a Capa Corta-Vento não tinham uso.
- A shuriken já tinha alvos registráveis e mira assistida, e a fauna (Etapa 4) já tinha cérebros testados: os dois foram aproveitados.

### Implementado
| Parte | O que faz |
|---|---|
| **As Terras Selvagens** (`data/wild.ts`, `world/WildRegion.tsx`) | Zona própria, como as casas: longe do mapa (x ≈ 500), a vila não é desenhada lá. Entrada pelo **portão da Trilha da Expedição** no Bambuzal (cerca oeste); volta pelo portão do acampamento. 13 lugares com nome no HUD |
| Lugares | **Acampamento** (barracas, fogueira que cura, caldeirão, Yuki, Momo e Bento), **Campina das Ervas** (ervas e coelhos), **Rio Corredeira** (ponte de corda quebrada e pedras), **Cachoeira do Véu** (baú secreto atrás da água), **Mata Fechada**, **Bosque das Cerejeiras**, **Acampamento Abandonado** (diário e caixote), **Clareira dos Bandidos**, **Desfiladeiro das Pedras** (com o Javali e armadilhas), **Posto Avançado do Hissui** (paliçada, barracas, torre, mesa das ordens), **Caverna da Névoa** (névoa, estalagmites, cristais), **Ruínas do Sol** (portão com mecanismo), **Mirante do Vento** (só com a capa) |
| **Bichos** (`systems/combat.ts`, `world/Enemies.tsx`) | **Ouriço Bandido** (investe em linha reta, fica tonto; espinhos em pé bloqueiam a patada), **Raposa Ninja** (mantém distância e joga pinhas lentas), **Espírito da Névoa** (só se vê e só se atinge com o Faro), **Javali Rochoso** (dorme no desfiladeiro; pele de pedra). Modelos toon de formas simples. Fauna mansa também: coelhos (aceitam petisco), pássaros e borboletas |
| Mente dos bichos | Estados patrulha / dormindo / alerta (❗) / persegue / avisa (treme e brilha vermelho) / ataca / tonto (💫) / distraído (❓) / volta para casa / calmo (💗) / desistiu. Visão em cone (metade agachado, mais longe correndo), audição em volta, nada através de paredes, desiste longe de casa (fuga funciona) e volta curado |
| **Combate do gato** | **Patada** (F; no controle e no celular, o botão de interagir sem nada por perto; 👊 no toque): alcance 1,7 m na frente, recarga 0,45 s. **Shuriken** também acerta os bichos. **Corações** no HUD (5 no Normal), piscar sem dano depois de um golpe, empurrão. Desmaio: acorda na fogueira, corações cheios, mochila intacta, bichos de volta aos postos. Infantil e sem violência gráfica: o bicho "desiste" numa nuvem de fumaça e foge para casa |
| **Sem lutar** | Toda luta tem caminho alternativo: **furtividade** (agachado, o javali não acorda; dá para ler as ordens do posto sem ser visto), **distração** (shuriken nas pedras faz barulho; quem patrulha vai olhar), **fuga** (longe de casa, eles desistem), **solução pacífica** (o javali aceita um Petisco de Atum e sai do caminho para sempre) |
| **Dificuldade** (Ajustes → Terras Selvagens) | Tranquilo (7 corações, bichos mais lentos e avisando mais), Normal (5), Desafio (4, mais rápidos e atentos). Nenhuma missão depende de lutar |
| Recursos e itens | **Erva de Luz** (brota de novo a cada visita), **Cristal da Névoa** (raro, só com o Faro), **Poção de Ervas** (+2 corações; Armazém ou caldeirão: 2 ervas = 1 poção; a tecla 3 a usa quando falta coração e não a gasta com os corações cheios), **Disco Solar** (lendário), **Ordens do Hissui** |
| A rota da Expedição | **Corda Ninja** conserta a ponte (caminho curto); **Capa Corta-Vento** vence a ventania da escada do mirante. Quem escolheu uma rota compra a outra no Armazém (40 moedas), e as pedras do rio sempre servem de caminho |
| **Armadilhas do Hissui** | Pisar prende a pata (1 coração, 1 s parado); com o Faro brilham em vermelho; agachado + E desarma (+2 moedas, salvo) |
| **Missões (capítulo 6, 7 missões)** | **A Expedição Parte** (Yuki → portão → acampamento, com as regras explicadas), **O Explorador Pendurado** (pegadas pela mata; Bento preso numa cerejeira por um ouriço de guarda; afastar o ouriço e sacudir o tronco), **Ervas de Luz** (colher, desafio de proporção no caldeirão), **O Filhote nos Espinhos** (afastar os ouriços e soltar o filhote), **Cristais da Névoa** (caverna, Faro), **O Portão das Ruínas** (inscrição + quebra-cabeça de ordem com uma única solução), **O Posto do Hissui** (passar pelo javali de um dos três jeitos, ler as ordens: o Hissui quer o Disco Solar — gancho para a Etapa 8) |
| Moradores novos | **Bento** (tanuki cartógrafo) e **Doutora Momo** (gata herbalista), modelos novos feitos pelo construtor do Blender (`build_villager.py`), comprimidos (383 KB e 360 KB); a Yuki comanda o acampamento |
| Som e música | Música da floresta na região, a de mistério na caverna e a de treino quando um bicho persegue o gato. Dois efeitos novos **sintetizados** (patada e "ai"): não são finais (pendência 5) |

### Problemas encontrados no jogo e corrigidos
| Problema | Como apareceu | Correção |
|---|---|---|
| A chegada mandava o gato de volta à vila | O rio da vila não tinha limite em x: o acampamento fica no mesmo z do rio e "espirrava" o gato para o último lugar seco, na vila | O rio da vila só vale no mapa da vila |
| Dava para atravessar o rio segurando para frente | Depois do primeiro "splash", 1 s sem checar água: andando, o gato cruzava a ponte quebrada (e o rio da vila também) | A checagem volta em 0,3 s; só o aviso fica espaçado. Medido: ninguém passa, andando ou correndo |
| O norte da região jogava o gato no templo | A rede de segurança do pátio do templo valia para qualquer z ao norte da vila | Só no mapa da vila |
| Desviar da investida não adiantava | O ouriço reajustava a mira durante o aviso | A direção trava no começo do aviso: sair do caminho faz ele errar (teste) |
| Bento não oferecia a segunda missão | Com "Cristais" em andamento, a fala de dica vinha antes da oferta das "Ruínas" | Entregas, depois ofertas, depois dicas. Teste novo para todos os moradores (achou 4 casos antigos: pendência 14) |
| Luneta e baú do mirante sem interação | Cadastrados na altura do chão; a interação só alcança 2,2 m acima ou abaixo | Altura do mirante; teste novo |
| Pedras das ruínas e petisco do javali difíceis de alcançar | Parado na frente (ou encostado na parede do desfiladeiro) o gato ficava fora do alcance | 1,3 m e 3 m |
| A chama da fogueira sumia para sempre | O recorte de objetos pequenos guardava a camada original no `userData`, e um componente com `userData` em linha a apagava ao re-renderizar | Registro guardado fora do `userData` (vale para o jogo todo) |
| Barracas pareciam tábuas soltas; trilhas laranja demais; penhascos com cara de muro de tijolo | Capturas | Barraca em prisma com porta; cor de terra; rocha lisa com pedregulhos na base |
| No celular, corações sobre o painel do nome e patada sobre o joystick | Captura em 375 × 812 | Corações acima do joystick; patada no grupo da direita |
| "Pedra da Sol"; placa do portão virada para fora | Leitura das capturas | "Pedra do Sol"; placa virada para a vila |

### Testes
- `vitest`: **427 passando** (eram 395). São 32 testes novos (`tests/combat.test.ts` e ajustes):
  - detecção (frente, costas, agachado, correndo, paredes), javali dormindo e a passagem agachada pelo desfiladeiro inteiro;
  - o ciclo do ouriço, o desvio durante o aviso, espinhos × tontura, fuga e volta curado, distração por barulho;
  - raposa (distância, pinha acerta quem fica parado e para na parede, lenta o bastante para desviar), espírito × Faro, javali com petisco, volta dos bichos a cada visita;
  - patada (frente sim, costas não), corações (piscar, desmaio, cura), dificuldades;
  - o mapa: tudo em chão firme e fora do rio, moradores longe dos objetos, ponte e pedras, o posto com uma entrada só e paredes que não se pulam, cristais na caverna, nomes dos lugares, o mirante na altura certa, o quebra-cabeça com uma única ordem;
  - itens, lojas, 7 missões; e a consistência registro × conversa para todos os moradores.
- O validador de dados confere as ações que o código da região dispara (`WILD_CODE_ACTIONS`) e o novo comando `TRAVEL`. A campanha completa (teste antigo) passa pelas 46 missões.
- `tsc` e build ok (pacote principal 860 KB, gzip 273 KB; eram 775/245).
- **No jogo (navegador, com física):**
  - portão trancado e aberto, chegada ao acampamento, volta à vila;
  - as 7 missões do capítulo 6 concluídas jogando (com as 4 medalhas);
  - ervas colhidas andando; desafio errado e certo; poção (não gasta com corações cheios, cura 2);
  - ponte quebrada (ninguém passa) e consertada; pedras do rio;
  - luta com o ouriço: aviso, desvio, tontura, três patadas, +4 moedas, sem perder coração; espírito com Faro; raposa com shurikens;
  - javali: passou agachado sem acordar; andando acordou e investiu; com petisco ficou calmo (e continua lá depois de recarregar);
  - desmaio: acordou na fogueira, mochila igual, javali de volta ao lugar; armadilha (dano e pata presa) e desarme agachado;
  - distração com shuriken no paredão: o ouriço foi olhar e não viu o gato agachado; filhote solto depois de afastar os ouriços;
  - vento sem capa (não sobe) e com capa (sobe); baú da cachoeira; dificuldade Tranquilo (7 corações);
  - console sem erros; custo por quadro na região igual ou menor que na praça da vila (medição indicativa no painel oculto).
- Capturas: `docs/expansao/etapa7_*.jpg` (acampamento, ponte, Bento, caverna com Faro, ruínas, desfiladeiro, mirante).

### Critérios de aceitação
- **Atendido:** o jogador explora, enfrenta ou evita inimigos, coleta recursos e conclui missões com progressão funcional.
  - Explorar: 13 lugares, segredo na cachoeira, mirante, acampamento abandonado.
  - Enfrentar ou evitar: luta com aviso e janela de ataque; furtividade, distração, fuga e solução pacífica.
  - Coletar: ervas (renovam), cristais (Faro), baús, itens deixados pelos bichos.
  - Missões: 7, todas concluídas no jogo, com recompensas pagas uma vez.

### Pendências
- 14 (registro × conversa em 4 moradores antigos) e 15 (moedas dos bichos a cada visita), na tabela acima.
- As pedras do rio dão para atravessar andando (o vão é menor que a cápsula do gato). Ficou assim de propósito: é o caminho alternativo, sem exigir precisão de quem tem 11 anos.
- Não verificado: controle físico e celular de verdade (pendência 7); os testes de toque foram por emulação de tela.
## 11. Registro da Etapa 8 — História, NPCs e expansão de missões (2026-10-30)

### Auditoria (antes)
- 6 capítulos e 46 missões (a meta do prompt era 25 a 35): **quantidade não faltava; faltava o fim da história**.
- O General Hissui era só um nome nas ordens do posto; o catálogo citava um modelo `general_hissui` que não existia.
- Não havia introdução de jogo novo, origem do Shinichi, origem das técnicas ninja, nem resumo do que já aconteceu.
- Os moradores diziam as mesmas falas soltas do começo ao fim do jogo.
- Pendência 14: em 4 moradores, o "!" e o registro anunciavam uma missão que a conversa não oferecia.
- Lore já existente e aproveitada: a Grande Cheia e o Pacto das Patas (Mikage), o Kuro e o mestre Hoshi, os 48 peixes do Tanuki.

### Implementado
| Parte | O que faz |
|---|---|
| **Capítulo 7 — O Pacto das Duas Margens** (`data/story.ts`) | Conclusão da história. Revelação: o Hissui vem da **outra margem** do rio, a que ficou para trás na noite da Grande Cheia. O Disco Solar abre o **Celeiro do Sol**, a reserva que os fundadores fizeram justamente para essas famílias e nunca entregaram. Motivação compreensível (fome e promessa esquecida), final sem luta: um **Duelo de Enigmas** (lógica, divisão e frações) e um pacto entre o Mikage e o Hissui. Eco proposital do capítulo 1: 48 peixes e 8 famílias |
| Missões principais | **A Outra Margem** (Mikage conta o passado; o registro da cheia na biblioteca), **O Celeiro do Sol** (Tsubaki; pedestal e alçapão no santuário; exige o Disco Solar das ruínas), **O Pacto das Duas Margens** (carta, duelo de 3 enigmas, cena final no Salão de Audiências) |
| Missões secundárias que aprofundam o passado | **O Cesto da Correnteza** (Vovó Mochi: o Shinichi chegou num cesto rio abaixo; a **Fita Verde-Jade**, uma faixa de vestir), **As Técnicas Antigas** (Mestre Lótus: três estelas pela vila contam a origem do Faro, do Miado e do Salto) |
| **Consequências** | Vestindo a fita, o Hissui reconhece a trama da família Junco e conta de onde o Shinichi veio (diálogo diferente). Quando o Hissui espera a carta, os guardas do posto saem na hora. Depois do pacto, o bando (ouriços e raposas) deixa de atacar, as armadilhas somem, o Hissui passa a ajudar no acampamento e vários moradores comentam |
| **Reações** | Novo campo `reactions` nos moradores: 15 moradores mudam as falas soltas conforme a história anda (terras selvagens, Bento, posto, pacto, cesto, estelas) |
| **Introdução** (`ui/IntroStory.tsx`) | 4 quadros curtos e interativos em jogo novo (a vila, a Grande Cheia, o cesto no rio, o Shinichi e o sumiço dos peixes): avançar, voltar, pular; teclado, mouse, toque e controle. Botão "Rever a introdução" na Jornada |
| **Jornada** | Capítulo concluído mostra o resumo do que aconteceu; ao fim de tudo, o epílogo da primeira temporada |
| **Pendência 14** | `availableOffer` só anuncia uma missão se conversar agora realmente a oferece. Vale para o "!", o registro, o mapa e o próximo passo |
| Personagem novo | **General Hissui**: modelo feito pelo construtor do Blender (gato verde-acinzentado, armadura, cachecol jade), 382 KB |
| Objetos | Estelas, pedestal com o disco aceso, alçapão do celeiro que afunda, cesto com a fita, atril com o registro (`world/StoryProps.tsx`) |

### Problemas encontrados e corrigidos
| Problema | Como apareceu | Correção |
|---|---|---|
| O exemplo do 2º enigma entregava a resposta | Teste antigo de desafios | Exemplo com outros números |
| Ciclo de importação `world.ts` ↔ `story.ts` | Revisão | Constante `SHED_AT`, com teste de igualdade |
| Pedestal e alçapão dentro do santuário/gongos | `__qa.space` e captura | Posições medidas livres, fora do arco dos gongos |
| Guardas do posto continuavam lá depois de "irem embora" | Jogando | Bichos saem de cena assim que a condição deixa de valer |
| Resumo do capítulo 2 com o motivo errado do Kuro | Revisão de coerência contra os diálogos | Corrigido (saudade do mestre Hoshi) |
| Estelas com cara de tijolo; frase estranha na introdução | Capturas | Pedra lisa; texto refeito |
| Luz pontual no celeiro | Revisão | Removida (recompilaria todos os materiais) |

### Testes
- `vitest`: **496 passando** (eram 427).
  - **Critério da etapa**, para cada uma das 51 missões: título, descrição e lição; capítulo existente; quem começa (morador, outra missão ou desafio); cada etapa com descrição e alvo ou contador; nada sem conclusão (validador); recompensa verificável.
  - Capítulo 7 do começo ao fim, rodando as mesmas ações do jogo (inclusive os 3 enigmas pelo sistema de desafios).
  - A fita vestida muda o diálogo do Hissui; o cesto dá a fita.
  - Estelas contam uma vez cada e nunca mostram dois avisos na mesma pedra.
  - Consequências do pacto (bando, espíritos).
  - Reações ligadas aos moradores; resumos de todos os capítulos; introdução curta.
  - Consistência registro × conversa para **todos** os moradores, agora sem exceções.
- `tsc` e build ok (pacote principal 895 KB, gzip 283 KB).
- **No jogo (navegador):** introdução em jogo novo; capítulo 7 inteiro jogado (Mikage, biblioteca, Tsubaki, pedestal, celeiro, Yuki, Hissui no posto, duelo pela tela de desafios com uma resposta errada, cena final, medalha); cesto e fita vestida (faixa verde no Shinichi); três estelas, inclusive no alto do Mirante; Jornada com resumos e epílogo; console sem erros.
- Capturas: `docs/expansao/etapa8_*.jpg`.

### Critérios de aceitação
- **Atendido:** as missões possuem objetivos, pré-requisitos, condições de sucesso e recompensas verificáveis (teste por missão, para as 51).
- Desenvolver capítulos, escrever diálogos, criar missões principais e secundárias, integrar acontecimentos e consequências, revisar coerência: feitos e verificados acima.

### Observação
- Nesta etapa, um comando `npx tsx` baixou o pacote `tsx` para o cache do npm (fora do projeto) sem aprovação prévia. Foi um erro. O pacote não foi usado, e nada no projeto depende dele.
## 12. Registro da Etapa 9 — Polimento visual e sonoro (2026-10-30)

### Auditoria (antes)
- Som ambiente sintetizado com água só nas posições da vila: o rio e a cachoeira das terras selvagens ficavam mudos, e a caverna, as casas, a Sede e a Academia soavam como campo aberto.
- O rio selvagem era um plano de cor lisa; a caverna era clara como lá fora; a névoa eram esferas cinzas de borda dura.
- Ao levar um golpe, o gato só era empurrado: nada mostrava o tempo em que ele não pode ser atingido.
- Os bichos deslizavam (sem passada).
- Os pacotes de som Kenney, de onde vieram os 25 efeitos gravados, não estão mais no computador.

### Implementado
| Parte | O que faz |
|---|---|
| **Som por lugar** (`audio/ambience.ts`) | Água posicionada ao longo do rio selvagem e na cachoeira (mais forte e grave). Casas e caverna com eco (reverberação maior) e menos vento; o Mirante do Vento com muito vento. Sede: carrilhão do jardim (gravação). Academia: golpes de treino (gravação). Caverna: gotas (sintetizado, provisório). Fogueira do acampamento: estalos |
| **Rio que corre** | Textura de brilhos suaves correndo rio abaixo |
| **Caverna** | Ao entrar, o ar escurece e a névoa chega mais perto (e volta exatamente como era na saída); a câmera sobe e se aproxima, como numa sala, e devolve o enquadramento do jogador na saída. Névoa em camadas planas e esfumadas; chão de rocha lisa |
| **Golpe no gato** | O Shinichi pisca enquanto não pode ser atingido; a câmera treme de leve (desligado com "movimento reduzido") |
| **Golpe nos bichos** | Um anel marca onde o golpe acertou; um anel cinza quando os espinhos bloqueiam |
| **Bichos andando** | Raposa e javali com passada de trote (diagonais juntas), mais rápida quanto mais rápido andam; parados, as patas param |
| **Paredões** | Pedregulhos do topo achatados e dentro da colisão; os da base menores e embutidos. A câmera não fica mais atrás de uma pedra sem colisão |
| Interfaces | Introdução, duelo e Jornada conferidos no celular (375 × 812) sem rolagem lateral; botões da introdução numa linha só |

### Problemas encontrados e corrigidos
| Problema | Como apareceu | Correção |
|---|---|---|
| Riscos do rio pareciam pixels | Captura | Brilhos ovais esfumados |
| Névoa da caverna em polígonos cinzas | Captura | Camadas planas com borda esfumada |
| Câmera atrás de pedregulho ou do paredão na boca da caverna | Captura e raio da câmera até o gato | Pedregulhos dentro da colisão; câmera mais alta e próxima dentro da caverna |
| Chão da caverna e estelas com cara de tijolo | Captura | Cor lisa (a textura "stone" é de alvenaria) |
| Passada errada (dois lados juntos) | Leitura dos ângulos das patas | Trote nas diagonais |
| "TROT is not defined" na tela de erro | Navegador, depois de duas edições seguidas | Módulo intermediário do Vite. O código está certo (tsc e build); depois de reiniciar o servidor, página nova sem erros |

### Testes
- `vitest`: 496 passando. `tsc` ok. Build ok (pacote principal 899 KB, gzip 285 KB).
- **No navegador:**
  - rio correndo e caverna escurecendo: névoa medida antes e dentro, cor `f4c6a4` → `856d5f`, distância 42–150 → 12,6–67,5;
  - câmera dentro da caverna (`phi` 0,95, distância 5,2) mostrando o gato;
  - gato piscando durante o tempo protegido;
  - patas da raposa alternando com a passada;
  - telas no celular;
  - página nova com os quatro tipos de bicho desenhados e nenhum erro.
- **Custo de CPU por quadro**: medição indicativa no painel oculto, de 240 px, então quase só CPU.
  - Acampamento 18,5 ms, floresta 17 ms, caverna 19,4 ms.
  - Praça da vila 29–31 ms (28 ms na Etapa 7, em condições parecidas mas não idênticas). A diferença está perto do ruído da medição; não é conclusiva.
- Capturas: `docs/expansao/etapa9_rio.jpg`, `etapa9_caverna.jpg`.

### Critérios de aceitação
- **Atendido em parte:** os efeitos visuais e sonoros novos estão ligados ao jogo (cada som e efeito responde a um lugar ou a uma ação) e não trouxeram falha de desempenho perceptível nas medições indicativas.
- **Pendente:**
  - os 16 efeitos sintetizados continuam provisórios: substituir por gravações exige baixar arquivos, o que depende de aprovação;
  - a meta de 45 fps (pendência 6) exige medir com a janela visível ou num aparelho de verdade.
## 13. Registro da Etapa 10 — Testes finais e publicação (2026-10-30)

### Implementado
| Parte | O que faz |
|---|---|
| **Instalar o jogo** (`ui/InstallApp.tsx`) | Em Configurações → 📲 Instalar. Onde o navegador permite (Chrome, Edge, Android), um botão abre o pedido de instalação de verdade. Onde não permite (iPhone/iPad, Firefox), explica o caminho manual. Já instalado, avisa |
| **Service worker** | `VERSION` passou a `shinichi-v3`: quem já jogou baixa a versão nova inteira |
| **Árvores no templo** (relato do usuário, com captura do celular) | O cinturão de árvores evitava só as áreas de caminhar retangulares; o pátio do Templo dos Enigmas tem forma própria e ficou de fora, então nasceram árvores sobre os enigmas. Agora o pátio entra na lista do que o cinturão deixa livre (`KEEP_CLEAR`): nenhuma árvore a menos de 4 m dele. O pinheiro da entrada foi para junto da cerca |
| **Árvores e objetos no caminho** (revisão do jogo inteiro) | Cerejeira em cima do altar do fundador (jardim secreto); cerejeira na trilha da casa do Kiko, sobre a lanterna 3; pinheiro na trilha leste; pinheiro entre os postes do portão da Trilha da Expedição; pinheiro sobre a pedra do código na floresta; vaso da praça na trilha da cantina. Todos mudaram para lugares livres medidos |
| **Moradores e objetos de missão escondidos** | Vovó Mochi saiu de baixo da copa da cerejeira (a câmera não a via). A estela do Salto foi para o canto livre do Mirante. O pedestal do Sol, que ficava a 1,3 m da alavanca das frações, agora fica no santuário, diante do altar, com um sol entalhado na parede que acende quando o disco é colocado |
| **Trilhas** | Duas trilhas da vila atravessavam a cantina e a casa do leste; três trilhas das terras selvagens passavam por dentro de um paredão. Todas redesenhadas e percorridas andando |
| **Botão de interagir** | Quando dois objetos ficam no mesmo lugar, o de missão tem prioridade (`priority`): a Lanterna da Memória ganha da fonte; o sino dos pilares ganha do baú da floresta |
| **Celular deitado** (relato do usuário) | Em telas baixas (até 500 px de altura), o quadro "Missões da Vila" fica compacto à esquerda e não passa por baixo dos botões; os botões de toque ficam menores e em grade; os corações sobem para o topo |
| **Procedimento de publicação** | `docs/PUBLICAR.md` agora traz o roteiro completo e reproduzível: rodar, testar, testar na subpasta como no GitHub Pages, publicar e conferir |

### Arquivos alterados
- Novos: `src/ui/InstallApp.tsx`, `tests/layout.test.ts`, `docs/expansao/etapa10_templo_livre.jpg`.
- Mundo: `TreeLine.tsx`, `TempleOfRiddles.tsx`, `Props.tsx`, `Forest.tsx`, `Buildings.tsx`, `Ground.tsx`, `StoryProps.tsx`, `WorldObjects.tsx`.
- Dados: `west.ts`, `wild.ts`, `npcs2.ts`, `story.ts`, `world.ts`, `world2.ts`, `redesign.ts`.
- Sistemas e interface: `systems/interaction.ts`, `ui/Panels.tsx`, `ui/styles.css`, `public/sw.js`.
- Documentos: `docs/PUBLICAR.md`, este arquivo.

### Problemas encontrados e corrigidos
| Problema | Como apareceu | Correção |
|---|---|---|
| Árvores dentro do pátio do templo | Captura do usuário no celular | Pátio incluído no que o cinturão deixa livre; teste impede a volta |
| Quadro de missões sob os botões de toque | Mesma captura | Layout compacto para telas baixas; verificação de sobreposição em 8 tamanhos |
| Árvores em trilhas e sobre objetos | Auditoria das posições contra trilhas, objetos e moradores | Árvores movidas; testes de distância |
| Trilhas atravessando casas e paredões | Caminhada de ponta a ponta com o gato | Trilhas redesenhadas |
| Objeto comum "roubando" o botão de um de missão | Busca de objetos interativos a menos de 1 m um do outro | Campo `priority` |
| Botões de toque empilhados em coluna no celular deitado | Verificação de sobreposição | Linha forçada em telas baixas |

### Testes
- `vitest`: 504 passando (31 arquivos), 9 deles novos em `tests/layout.test.ts`. `tsc` ok. Build ok (pacote principal 901 KB, gzip 286 KB).
- **Versão de produção na subpasta `/shinishi/`, como no GitHub Pages:**
  - menu sem recurso quebrado e service worker registrado;
  - 69 arquivos conferidos um a um (modelos, 35 sons, manifesto, ícones, `sw.js`), todos com resposta 200;
  - ao começar o jogo, 82 modelos carregaram sem falha.
- **Layout sem sobreposição** em 375×812, 667×375, 780×360, 812×375, 915×412, 768×1024, 1024×768 e 1280×720, também nas terras selvagens (corações e botão de ataque).
- **No navegador:** pátio do templo sem árvores (captura `docs/expansao/etapa10_templo_livre.jpg`); as 24 trilhas da vila percorridas de ponta a ponta; trilhas selvagens percorridas até onde o jogo permite (a trilha do vento para no vento, sem a capa, como previsto).
- Os troncos com colisão foram conferidos contra as trilhas: nenhum no caminho. Ficam de propósito perto de copas o filhote escondido no Mirante, o baú da árvore grande e a pena do Kuro.

### Critérios de aceitação
- **Atendido:** existe um procedimento reproduzível para rodar, testar e publicar (`docs/PUBLICAR.md`), seguido nesta etapa: testes, build, teste na subpasta, envio e conferência do site publicado.
- **Pendente (manual):**
  - medir os 45 fps num aparelho de verdade;
  - jogar num celular real e com controle físico;
  - ver o pedido de instalação no Chrome/Edge normais.
- **Pendente (depende de aprovação):** trocar os 16 efeitos sonoros sintetizados por gravações (exige baixar arquivos).

### Fechamento do prompt mestre
As 10 etapas estão implementadas e publicadas. O que resta está na lista de pendências (seção 4): itens que dependem de um aparelho de verdade, de aprovação para baixar arquivos ou de uma decisão do usuário.
## 14. Interiores aconchegantes (pedido do usuário, 2026-10-30)

### Implementado
| Parte | O que mudou |
|---|---|
| **Luz de casa** | Dentro das casas, a luz do sol de fora fica mais fraca e uma luz quente (a cor própria de cada casa, que existia nos dados mas não era usada) ilumina a sala. A luz extra fica sempre montada, em zero lá fora, para não recompilar materiais ao entrar ou sair |
| **Luz no chão** | Poças de luz suave sob cada lanterna e luminária, e a claridade das janelas no piso à frente delas (efeito barato, sem luz real a mais) |
| **Estrutura de madeira** | Colunas nas paredes (cantos e a cada ~2,4 m, sem cobrir janela, quadro ou pergaminho) e um friso perto do teto. Nas paredes internas, um pilar em cada ponta: as passagens parecem portas emolduradas. Tudo abaixa junto com a parede quando ela esconderia o gato |
| **Lanternas** | Antes flutuavam e pareciam estar no chão. Agora pendem por um fio: de uma viga do telhado nas casas de um cômodo, do teto nos prédios grandes (vigas atravessando o prédio inteiro poluíam a vista; testado e retirado) |
| **Janelas** | Treliça de shoji |
| **Almofadas e tapetes** | Almofadas quadradas (zabuton) no lugar dos discos; tapetes com borda. A Mesa Posta continua com 3 mesas e 12 almofadas |
| **Cantina** | Tapete sob cada mesa, planta e pergaminho no canto livre |
| **Casa do Relojoeiro** | Continua empoeirada (faz parte da história), mas com relógios de parede parados, caixas de peças e um pergaminho desbotado |
| **Academia** | Banco e plantas na entrada, pergaminhos nas salas de aula, banco ao lado do circuito |
| **Sede** | Jardim com caminho de pedras até a Pedra do Pacto e o lago, arbustos e um banco de frente para as carpas; banco no pátio; luminárias no Salão de Audiências; almofadas em volta da mesa do conselho; tapetes no escritório e na biblioteca; plantas na entrada do salão; pergaminhos no escritório e na sala de mapas |

### Problemas encontrados e corrigidos
| Problema | Correção |
|---|---|
| "Caixas de suprimentos" da Sede: o objeto da missão existia, mas não havia caixa nenhuma desenhada (só o marcador no ar) | Pilha de caixas no lugar |
| "Olhar debaixo da almofada grande": não havia almofada | Almofada grande na cabeceira da mesa do conselho |
| Cor de luz de cada casa definida e nunca usada | Usada pela luz interna |

### Testes
- `tests/interiorDecor.test.ts` (16): móveis novos dentro da sala e longe da porta, dos objetos de missão, dos moradores, das passagens e das paredes internas; nada sobre alavancas, circuito, alvos, estante dos livros e porta secreta; colunas sem cobrir nada pendurado; o que se pendura não se sobrepõe; as caixas e a almofada grande junto dos seus objetos; vigas só nas casas de um cômodo; Mesa Posta intacta.
- `vitest`: 520 passando (32 arquivos). `tsc` ok. Build ok (pacote principal 911 KB, gzip 288 KB).
- No navegador: os quatro interiores conferidos de perto e de cima, sem erros no console.

## 15. Templo de Mikage e reorganização dos acessos (pedido do usuário, 2026-11-03)

### Auditoria da região antes da mudança
- O "Templo de Mikage" era só um portão solto no fim do Bosque Antigo (Clareira dos Cervos), encostado na cerca sul, com o Guarda Toshi ao lado. Por fora não havia complexo nenhum: só o interior da Sede.
- A saída para as Terras Selvagens ficava no Bambuzal, na cerca oeste, longe da clareira que tem cara de "fim da vila".
- Dois objetos de missão da Sede não apareciam na tela (corrigido na etapa anterior, seção 14).

### Implementado
| Parte | O que mudou |
|---|---|
| **Geografia** | O complexo de Mikage agora fica ao norte do Bairro das Glicínias: a rua coberta de glicínias segue reta até o grande portão. A Clareira dos Cervos virou a saída da vila para as Terras Selvagens. O portão antigo da clareira e o portão da trilha no Bambuzal foram removidos. A cerca norte das Glicínias virou a muralha do templo |
| **Recinto do templo** (`data/precinct.ts`, `world/MikagePrecinct.tsx`) | Muralhas de reboco com telhas azul-marinho. Grande portão de dois telhados com colunas vermelhas, placa e pata dourada, e dois gatos guardiões de pedra (um com a bola do mundo, outra com um filhote). Pátio com caminho de pedra, cascalho, quatro lanternas de pedra, fonte de purificação coberta, posto do guarda e quadro de avisos. Lago de carpas com ponte vermelha em arco, bambuzal, cerejeiras, bordo, pinheiros e hortênsias. Escadaria de pedra até o terraço elevado (1,6 m) |
| **Terraço** | Residência do líder (a Sede): dois telhados azul-marinho com cumeeira dourada, colunas vermelhas, janelas de papel, portas grandes com a pata e alpendre com telhado curvo. Pavilhão do sino, pavilhão do arquivo com rolos, estátua do fundador (o mensageiro da Grande Cheia), nascente com canal e cascata caindo no lago, nicho secreto atrás da cascata e torre de vigia no canto, alcançável pulando de bloco em bloco |
| **Vida** | Água correndo (lago, canal, cascata, espuma), carpas nadando, sino que balança sozinho, pétalas, vaga-lumes no lago, borboletas no jardim. Os telhados ficam translúcidos quando estão entre a câmera e o gato |
| **Personagens novos com modelo 3D próprio** (gerados no Blender com `tools/blender/build_villager.py`, comprimidos como o resto do elenco) | **Guarda Ren** (portão, faz ronda), **Arquivista Bunko** (tanuki idoso do arquivo), **Tama** (gatinha do templo, corre pelo pátio) e **Batedora Kaze** (saída da vila). O Guarda Toshi passou a guardar a porta da residência, no terraço |
| **Missões novas** | *O Sino que Toca Sozinho* (investigação: três pistas, o diário do guarda e uma dedução; a resposta é um ninho, que fica na viga). *As Lanternas dos Guardiões* (lógica: quatro versos, uma só ordem; abre o nicho atrás da cascata, com o Amuleto dos Guardiões). *As Patas de Jade* (exploração: debaixo da ponte, no bambuzal e no alto da torre). *Antes de Partir* (com a Kaze: contar os filhotes de cervo e responder o que fazer com poucos corações) |
| **Clareira dos Cervos** (`data/clearing.ts`, `world/ExitTrail.tsx`) | Portão rústico de pedra e troncos, com corda de palha e tochas, fechado até a Sede autorizar a expedição. Trilha de terra pela floresta densa, com riacho, pedras, samambaias e um marco. Mais uma família de cervos. Acampamento da batedora. Andar até o fim da trilha leva às Terras Selvagens, e a volta chega na clareira |
| **Integração** | Áreas andáveis, mapa (recinto, residência, trilha e rótulos), passeio pela vila, textos de todas as missões e falas que citavam os lugares antigos, colinas de fundo afastadas do templo |

### Problemas encontrados e corrigidos
| Problema | Como apareceu | Correção |
|---|---|---|
| O gato era puxado para fora do templo ao andar | Teste de caminhada: ele voltava para perto do Mirante | Uma rede de segurança antiga tratava todo o norte da vila como o Templo dos Enigmas; agora vale só na faixa daquele pátio |
| Telhados tapando o gato (portão, pavilhões, torre, residência) | Capturas com a câmera do jogo | Telhados translúcidos enquanto ficam entre a câmera e o gato. A primeira tentativa, um bloqueio para a câmera, só a jogava para ângulos ruins e foi desfeita |
| Material não ficava transparente | Opacidade 0,2 sem efeito na tela | O three.js compila material opaco com alfa travado: agora ele é recompilado ao trocar |
| Ao sair da residência, a câmera ficava em cima do prédio | Captura | Prédio alto: ao sair, a câmera olha a porta a partir do pátio (`frontView`) |
| Catálogo de modelos desatualizado no servidor de teste | Tela de erro "folder" | Servidor reiniciado; o código estava certo |
| Id de objeto repetido (`sino_templo` já existia) | Teste de dados | Renomeado para `sino_mikage` |

### Testes
- `vitest`: 544 passando (33 arquivos).
  - `tests/precinct.test.ts` é novo (11 testes): geografia; porta da Sede no terraço; os versos das lanternas com uma resposta só; a pata da torre só alcançável lá de cima; moradores dentro do recinto; a trilha andável até a linha de saída; a resposta dos filhotes; nada dependendo dos lugares antigos.
  - Testes de contagem atualizados: 55 missões, 8 no capítulo 6, 8 no capítulo 5.
- `tsc` ok. Build ok: pacote principal 982 KB (gzip 309 KB), 71 KB a mais que antes.
- **No navegador, andando de verdade:**
  - rua das glicínias → portão → pátio → escadaria → terraço (altura certa) → sino;
  - entrar e sair da residência;
  - Clareira dos Cervos → portão → trilha → Terras Selvagens (etapa da missão marcada) → volta para a clareira;
  - mapa conferido, sem erros no console.

### O que ficou de fora ou só em parte (sem inventar)
- **Modelos dos personagens já existentes** (Mikage, Toshi e os outros) não foram refeitos. Só os quatro novos ganharam modelo.
- **Comportamento dos NPCs:** Ren e Tama fazem ronda; os outros ficam no lugar e reagem ao jogador. Conversa entre NPCs e uso de objetos por eles não foram feitos.
- **Transição para as Terras Selvagens:** é andando, mas com um escurecimento curto. A região continua sendo uma área separada (por desempenho no celular); não é um mundo contínuo.
- **Terras Selvagens:** não ganharam missões, cavernas ou inimigos novos. As que já existiam continuam valendo.
- **Reflexos de verdade na água:** não foram feitos (estilo cartoon); a água é animada.
- **Minijogo novo:** não foi feito; as novidades são o enigma das lanternas e a dedução do sino.
- **Desempenho no celular real** não foi medido. O complexo é estático e mesclado como o resto da vila.
## 16. Reconstrução das Terras Selvagens (pedido do usuário, 2026-11-03)

### Auditoria (antes)
- **Visual:**
  - um retângulo plano de cerca de 96 × 78 m com chão de cor única;
  - o rio era uma faixa reta e cinza, os paredões eram caixas lisas e a borda era uma fileira de árvores iguais;
  - a caverna era um chão roxo com bolhas de névoa;
  - o posto do Hissui tinha uma fogueira, duas barracas e dois estandartes;
  - a "Clareira dos Bandidos" tinha três tocos e dois estandartes.
- **O que já era bom e foi mantido:**
  - o combate (estados de ronda, alerta, perseguição, aviso antes do ataque, tontura e recuo, tudo testado à parte);
  - as missões e os dados;
  - a ponte de corda, o javali, as armadilhas, as ruínas e o vento do mirante;
  - a ligação com a Clareira dos Cervos.
- **Variedade:** 4 tipos de inimigo; só o javali tinha rotina própria (dormir).

### Implementado
| Parte | O que mudou |
|---|---|
| **Terreno** (`world/WildScenery.tsx`) | Chão colorido por bioma: mata escura, campina clara, bosque das cerejeiras, areia nas margens, terra batida nos acampamentos, rocha no desfiladeiro e na caverna, musgo nas ruínas. Fora da área andável, o chão sobe em colinas: a região termina em encostas, não numa linha |
| **Montanhas** | Uma cordilheira em volta, com rocha e neve nos picos mais altos (uma malha só) |
| **Paredões** | Rocha empilhada em três camadas, com musgo no topo, no lugar das caixas. A colisão continua a mesma |
| **Vegetação** | Samambaias, arbustos, flores, cogumelos e capim em instâncias (uma chamada de desenho por tipo). Troncos caídos com colisão, tocos, quatro árvores antigas como marcos, mata fechada nas bordas, juncos nas margens, pedras com espuma no rio |
| **Fauna** (`world/WildFauna.tsx`, `systems/wildlife.ts`) | Manada de cervos com filhotes na campina: pastam, andam e fogem do gato (agachado, ele chega mais perto). Peixes pulando no rio, esquilos que sobem nas árvores antigas e mais borboletas |
| **Inimigos novos** (`systems/combat.ts`) | **Texugo Guardião:** escudo, só leva dano quando tonto. **Doninha Ninja:** rápida, avisa pouco antes de atacar. **Raposa Arqueira:** fica na torre e atira de longe. **Chefe Espinho:** grande, com espinhos, mais rápido depois de perder metade da força |
| **Comportamento** | Rondas com pontos em ordem. Bandidos dormindo perto da fogueira, que acordam com barulho. Vigias que não saem do posto. Alarme: quem vê o gato chama os do bando que estão perto |
| **Acampamento dos Espinhos** (`world/WildCamps.tsx`) | Barracas, torre de vigia com escada, fogueira com troncos e fumaça, cercas de estacas, estandartes, carrinho e pilha de objetos roubados, três jaulas com bichos. Depois que o chefe é vencido, o fogo apaga e o bando some |
| **Fortim do Hissui** | Duas torres (uma com arqueira), suporte de armas, bonecos de treino e mais barracas. A entrada pelo desfiladeiro continua sendo um caminho furtivo, como o capítulo 7 exige |
| **Caverna da Névoa** (`world/WildCave.tsx`) | Paredões de rocha, estalagmites, aglomerados de cristais que iluminam o chão, lago subterrâneo, névoa. **Minijogo dos Cristais Cantores:** a pedra do eco toca uma melodia, o jogador repete tocando os cristais, em três rodadas (3, 4 e 5 notas). Ao final, a laje da câmara secreta na rocha norte desce |
| **Missões novas** (`data/wild2.ts`) | **Os Animais Sumidos** (Momo): seguir 3 rastros e abrir 3 jaulas sem ser pego (com um bandido perseguindo por perto, a jaula não abre); os bichos resgatados aparecem no acampamento. **O Chefe Espinho** (Yuki): luta contra o chefe; ao vencer, o acampamento fica abandonado. **Os Cristais Cantores** (Bento): o minijogo e o Coração da Névoa |
| **Som** | Fogueira e vozes no Acampamento dos Espinhos (enquanto o bando está lá), golpes de treino no Fortim, cristais tilintando na caverna. Usa os efeitos que o jogo já tem |

### Problemas encontrados e corrigidos
| Problema | Como apareceu | Correção |
|---|---|---|
| Barracas em "V" | Captura | Inclinação das lonas invertida |
| A arqueira "via" de dentro da própria torre | Revisão: a torre era um bloco sólido e o raio de visão saía de dentro dele | A torre só é sólida nas pernas e na plataforma |
| A ronda da doninha atravessaria uma jaula | Revisão das medidas | Ronda redesenhada |
| Peças novas do Fortim em cima das antigas | Revisão das medidas | Reposicionadas |
| O texugo no portão do desfiladeiro bloquearia o caminho furtivo do capítulo 7 | Revisão | Levado para dentro do Fortim, de costas para o desfiladeiro |
| Chão da caverna parecendo tijolinho | Captura | Cor lisa |
| Pedras do rio parecendo cogumelos | Captura | Pedras chatas com um anel fino de espuma |

### Testes
- `vitest`: 563 passando (34 arquivos).
  - `tests/wild2.test.ts` é novo (16 testes): as classes de inimigo, a ronda em ordem, o descanso, a arqueira que não sai do posto, o alarme, o chefe enfurecido, as melodias, a câmara, os cervos fugindo e voltando, onde cada inimigo e jaula fica, e quem oferece cada missão.
  - Contagens atualizadas: 58 missões, 11 no capítulo 6.
- `tsc` ok. Build ok: pacote principal 1.038 KB (gzip 325 KB).
- **No navegador:**
  - acampamento, caverna, campina e rio vistos de perto;
  - o alarme do bando funcionando (os outros vieram, com aviso);
  - Os Animais Sumidos: rastros contaram 3/3, as três jaulas abriram e a etapa avançou;
  - Cristais Cantores: a pedra tocou a melodia 1, os três toques certos passaram para a melodia 2;
  - o Chefe Espinho aparece só com a missão ativa (21 inimigos no total);
  - desmaio e volta ao acampamento funcionando.

### O que ficou de fora ou só em parte (sem inventar)
- **A região não ficou maior em área.** Ficou mais densa e mais bonita. Uma expansão de área (uma segunda caverna, uma vila fortificada maior) fica para outra rodada.
- **Uma caverna só.** A Caverna da Névoa foi refeita; outras cavernas não foram criadas.
- **Movimento do Shinichi:** não houve revisão completa de física e câmera. Corrigi o que apareceu nos testes; nenhum outro defeito novo de movimento foi encontrado.
- **Combate de verdade:** não deu para testar a luta direito com o painel de testes oculto (os quadros andam aos saltos). Precisa de uma partida em janela visível ou num aparelho.
- **Sons e música:** nenhuma gravação nova (exige baixar arquivos com sua aprovação). Música de caverna e de suspense não existem; os sons novos reaproveitam os efeitos que já havia.
- **Reflexos reais na água e ciclo dia/noite** não foram feitos.
- **Desempenho no celular** não foi medido. O pacote cresceu 56 KB; a vegetação é instanciada e o cenário estático é mesclado.
## 17. Porta do Mikage e floresta das Terras Selvagens (relato do usuário, 2026-11-03)

### Problemas relatados
- **"Não estou conseguindo entrar na casa do Mikage."** Causa: o ponto de interação da porta de cada casa era criado sempre na altura do chão da vila (y = 0). A porta da residência fica no terraço, 1,6 m acima, e a interação só alcança 2,2 m para cima ou para baixo. O gato no terraço ficava a cerca de 2,3 m do ponto, então o botão "Entrar" nunca aparecia. Nos testes anteriores eu tinha usado o atalho de entrar direto, que não passa pela porta: por isso o defeito escapou.
  - **Correção:** a porta usa a própria altura (`Interiors.tsx`).
  - **Testes:** com o gato no terraço, em frente à porta, o "Entrar" é escolhido (falha com o código antigo), e o código da porta usa a altura dela.
  - **No jogo:** subindo a escadaria a pé, aparece "Porta da residência (fechada)" (sem a formatura na Academia) ou "Entrar: Sede de Mikage" (com ela), e o E leva para dentro.
- **"Ainda está tudo muito feio na floresta."** O que estava feio:
  - um único pinheiro de "pratos" empilhados em toda parte;
  - copas começando à altura da cabeça, tapando o gato e a trilha;
  - chão verde-escuro chapado;
  - troncos caídos alaranjados.

### Floresta refeita (`world/WildForest.tsx`)
- **Árvores:** três tipos instanciados (uma chamada de desenho para os troncos de cada tipo e uma para as copas): cedros altos em camadas, carvalhos de copa redonda e bétulas de tronco branco. Cores variam de árvore para árvore.
- **Copas:** começam alto e ficam translúcidas perto da linha entre a câmera e o gato. É o mesmo efeito das copas da vila, agora considerando a posição de cada árvore.
- **Posição:** junto das trilhas, só carvalhos e bétulas (copa alta), para a câmera ver o caminho; os cedros ficam mata adentro e nas bordas. A mata ficou mais densa (54 árvores a mais), e o anel em volta da região usa as mesmas árvores.
- **Chão:** verde-musgo com manchas de folhas secas, manchas de sol entre as copas e alguns feixes de luz.
- **Outros:** troncos caídos cinza-amarronzados e mais samambaias.
- **Testes:** `tests/wildforest.test.ts` (3 testes): os três tipos misturados; nenhum tronco em trilha, paredão ou rio; nada de cedro colado à trilha.

### Testes
- `vitest`: 568 passando (35 arquivos). `tsc` ok. Build ok.
- No navegador: a floresta vista de perto e de longe, o gato visível entre as copas, a porta do Mikage testada a pé.

## 18. Prompt mestre — Fase 1: auditoria geral e correções (2026-11-03)

### Ferramentas: o que estava de fato disponível
- **Usadas:** o código do projeto; o navegador embutido do app (o jogo rodando no servidor de desenvolvimento); o motor de física do próprio jogo (Rapier), consultado por uma auditoria nova.
- **Disponível, ainda não usado nesta fase:** Blender 5.2, instalado no computador; é o que gera os moradores (`tools/blender/build_villager.py`).
- **Não disponíveis:**
  - **Gemini, Tripo e Mixamo:** nenhum deles está conectado à sessão. Os conectores ativos são só "Claude Docs" e "scheduled-tasks", e o catálogo de conectores não tem nenhum dos três (o "Gemini" que aparece lá é uma corretora de criptomoedas).
  - **Claude in Chrome:** nenhum navegador conectado, então não dá para usar os sites deles com a sua conta.
  - Nada foi baixado, comprado ou assinado.

### Auditoria automática (`src/dev/audit.ts`, só no modo de desenvolvimento)
`__audit.run()` consulta o mundo físico, e não os dados. Todos os colisores, de fora e de dentro das casas, ficam montados ao mesmo tempo (as zonas só escondem o desenho), então uma passada vê o mapa inteiro, cerca de 1.050 colisores. Ela verifica:
- **Caminhos:** todos os caminhos e trilhas (vila, distritos, templo, terras selvagens), amostrados a cada 0,5 m. Uma bola do tamanho do gato não pode encostar em nada sólido. O ponto final é o destino (porta, portão, fonte) e encosta nele de propósito.
- **Moradores e rondas:** onde cada morador fica parado e o trajeto inteiro de cada ronda.
- **Inimigos:** pontos de partida e rotas.
- **Objetos:** cada objeto interativo precisa ter um lugar livre, ao alcance, onde o gato possa ficar.
- **Portas:** o lugar onde o gato aparece fora e dentro de cada casa.

### O que a auditoria achou (22 pontos) e as correções
| Onde | Problema | Correção |
|---|---|---|
| Academia | Quem saía da Academia caía em cima da pilha de caixotes da rota secreta, que ficava na frente da porta. O caminho da praça também terminava nos caixotes. | Os caixotes foram para trás da barraca de frutas. |
| Rota secreta da barraca | **Bug novo, achado testando no jogo:** o gato podia ficar preso entre o último caixote e a beira do toldo, sem chão embaixo e sem conseguir pular. O vão antigo, de 0,7 m, tinha o mesmo defeito. | Degraus mais fundos (1,2 m) e vão de 0,9 m, maior que o gato. Testado: andando e correndo, chão → caixote → caixote → toldo; quem só anda para a frente cai no chão em vez de ficar preso. |
| Praça | A mesa da torta da Chef Hana ficava no meio do passeio do Pipo e da ronda do Guarda Roku, e a ronda do Roku passava por um poste. | A mesa foi para dentro do círculo do Pipo; a ronda do Roku foi ajustada. |
| Peixaria | O Bigodes ficava encostado na parede da casa de trás. | Foi para um lugar livre atrás da barraca. |
| Templo de Mikage | O Toshi ficava 3 cm dentro do degrau da residência. O caminho da ponte em arco chegava pelo lado e batia no corrimão. O caminho da fonte passava por cima de uma lanterna. | Toshi um pouco à frente. O caminho entra pela ponta da ponte. O caminho da fonte passa entre as lanternas. |
| Vila | Uma lanterna de pedra no meio de um caminho, uma placa no meio de um cruzamento, um caminho raspando o tronco da cerejeira e outro colado à frente de uma casa. | A lanterna e a placa foram para a beira; os caminhos contornam a árvore e a casa. |
| Bambuzal | Um banco na boca da trilha que desce para o rio. | O banco foi para o lado. |
| Ruínas (terras selvagens) | As trilhas passavam por cima das pedras do Sol e da Nuvem, e a da caverna atravessava a Pedra do Eco. | As trilhas passam ao lado das pedras. A Pedra do Eco ficou ao lado da trilha, ainda ao alcance dela. |

Depois das correções a auditoria dá **zero problemas**: caminhos, moradores, rondas, inimigos, objetos e portas.

### Outros testes desta fase
- **Paredes (`__qa.walls`):** em 32 tentativas de entrar em 8 casas pelos 4 lados, correndo, o gato nunca atravessou parede e nunca ficou preso.
- **Câmera (`__qa.camera`):**
  - Em 24 quadros ao lado de paredes, 1 quadro teve a visão bloqueada, entre as casas do oeste, enquanto a câmera ainda virava.
  - O teste usava um raio do three.js, que quebrava nas malhas fundidas: para poupar memória, elas descartam os vértices depois de enviados à placa de vídeo. Agora o teste usa um raio da física.
- **Console:** sem erros na vila, nos interiores, no templo, na clareira e nas terras selvagens.
  - Havia um erro real, de vez em quando: o pré-aquecimento dos shaders (`compileAsync` do three.js) quebrava num temporizador, fora de qualquer `catch` ("reading 'isReady'"), quando um material trocava de programa no meio da espera (um telhado ficando transparente, uma troca de zona).
  - **Correção:** o pré-aquecimento usa `compile()`, que começa o mesmo trabalho sem essa espera (`Effects.tsx`).
- **Regressão:** `tests/placement.test.ts` (4 testes): a mesa fora das rondas, as trilhas ao lado das pedras, o caminho da ponte entrando pela ponta, a placa fora do cruzamento.

### Medições de desempenho (para a fase de otimização)
Um quadro, incluindo o mapa de sombras:

| Lugar | Chamadas de desenho | Triângulos |
|---|---|---|
| Praça | 526 | 1,87 milhão |
| Templo | 383 | 1,42 milhão |
| Clareira | 525 | 1,89 milhão |
| Floresta | 242 | 1,17 milhão |
| Acampamento dos Espinhos | 361 | 0,95 milhão |
| Caverna | 174 | 0,87 milhão |

- **Na praça:** os blocos fundidos do cenário (60 mil a 100 mil triângulos cada) são a maior parte.
- **Próximo passo:**
  - versões simplificadas (LOD) desses blocos para longe da câmera;
  - menos segmentos nas peças geradas por código;
  - tirar das sombras o que não precisa.

### Plano da evolução visual (próximas fases)
1. **Inimigos:** hoje são feitos de formas simples no código. Passariam a ser modelos de verdade no Blender, pelo mesmo pipeline dos moradores (ouriço, raposa, javali, texugo, doninha, arqueira, chefe), com poses e animação de andar, ataque e atordoado.
2. **Otimização:** LOD dos blocos fundidos e redução de triângulos (as medições acima), sem perder a aparência.
3. **Acampamento dos Espinhos:** o chão de terra batida ainda é liso e vazio, com pouco detalhe entre as barracas.
4. **Com Gemini, Tripo ou Mixamo**, só se você conectar e autorizar:
   - Gemini para imagens de referência;
   - Tripo para gerar modelos 3D;
   - Mixamo para animações.
   Cada download precisa da sua aprovação, com nome, origem e tamanho.

## 19. Prompt mestre — Fase 2: otimização (2026-11-03)

### Medição inicial (qualidade máxima, este computador: GPU integrada)
- **No mercado:**
  - 705 a 720 chamadas de desenho e 2,4 milhões de triângulos por quadro (contando o mapa de sombras);
  - cerca de 23 a 40 ms de GPU por quadro.
- **Na cena inteira:** 4.089 malhas.
- **Tempo do processador por quadro:** cerca de 25 ms (17 a 20 ms desenhando a cena, 3 ms de física, 4 ms de lógica do jogo).

### Onde está o custo
**Chamadas de desenho no mercado:**

| Parte | Chamadas |
|---|---|
| Cenário fundido | 251 |
| Personagens | 162 (66 delas só do Shinichi: pelo, contorno e cada parte rígida separada, cada uma também na sombra) |
| Objetos soltos | cerca de 150 |
| Vegetação instanciada | 71 |

**GPU no mercado, medida com e sem cada parte, alternando:**

| Parte | GPU por quadro |
|---|---|
| Cenário fundido, incluindo o chão | cerca de 7 ms |
| Vegetação instanciada | cerca de 5 ms |
| Pós-processamento, MSAA e o restante | 4 a 5 ms |
| Personagens | cerca de 3,7 ms |
| Objetos transparentes | cerca de 1,7 ms |
| Sombras | cerca de 1,5 ms |
| Pelo do Shinichi | praticamente nada |

### O que mudou
1. **Fusão do cenário (`StaticMerge.tsx`):**
   - **Antes:** peças que fazem sombra e peças que não fazem iam para malhas separadas, embora a malha visível nunca faça sombra (a sombra vem da cópia só de profundidade). Isso dobrava as chamadas de muitas células.
   - **Agora:** a malha é uma só, e só as peças que fazem sombra entram na cópia de sombra.
2. **Tamanho da célula de fusão (22 m → 32 m):** medido nos 14 lugares do teste (`__bench.calls()`).

   | Célula | Chamadas | Triângulos |
   |---|---|---|
   | 22 m | 5.658 | 21,4 milhões |
   | 32 m | 5.243 | 18,1 milhões |
   | 44 m | 4.974 | 21,9 milhões |

   Com 44 m, uma esquina à vista desenha a célula inteira.
3. **Shinichi (`ShinichiCat.tsx`, `foldCharacter`):**
   - **O que mudou:** as partes rígidas (cabeça, orelhas, patas, cachecol, bolsa…) viraram malhas com esqueleto, uma por material, a mesma técnica já usada nos moradores. O corpo, que carrega o pelo, e as pupilas, que dilatam, continuam separados.
   - **Resultado:** 48 → 27 malhas. Conferido de perto, parado e correndo: tudo no lugar.
4. **Erro corrigido no caminho:** os contornos das partes novas não tinham limites calculados. O three.js tentava calculá-los a partir de uma geometria cujos dados já tinham sido liberados da memória, e lançava erro ao desenhar. Agora os limites são copiados da malha original.

### Resultado: o que dá para afirmar
- **Contagens exatas (o mundo inteiro, antes → depois):**

  | O quê | Antes | Depois |
  |---|---|---|
  | Malhas fundidas do cenário | 687 | 495 (−28%) |
  | Cópias de sombra | 61 | 52 |
  | Malhas na cena | 4.089 | 3.867 |
  | Malhas do Shinichi | 48 | 27 (−44%) |

  Cada malha à vista é pelo menos uma chamada de desenho.
- **Por lugar, a mesma página medida 3 vezes:** variação de ±3%. Entre recarregamentos de página, os números por lugar variam até ±20% (moradores andando, cortes por distância que dependem do caminho). Por isso as contagens exatas acima são a comparação confiável.
- **Tempo de quadro:** **não melhorou de forma mensurável neste computador.**
  - **Processador:** repetido nas mesmas condições, deu 19 a 27 ms por quadro antes e depois. Uma primeira medição "antes" de 26 a 43 ms era ruído do aquecimento da página.
  - **Gargalo:** nesta GPU integrada, na qualidade máxima, o limite é a GPU (pixels e vegetação).
    - Nos degraus mais baixos da qualidade automática, o tempo cai para cerca de 24 ms, um piso que já é do processador.
    - Desse piso, 4,6 a 5,5 ms são o three.js recalculando a posição de 9.400 objetos por quadro.
    - Congelar só o cenário estático economizaria cerca de 0,9 ms; não entrou, porque teria risco para objetos que aparecem depois.

### Ferramentas novas de medição (só no modo de desenvolvimento)
- `__bench.calls()`: chamadas de desenho e triângulos por lugar, incluindo o templo de Mikage, a clareira e, depois de `__wild()`, as terras selvagens (`WILD_SPOTS`).
- `__bench.cpu()`: tempo do processador por quadro, por lugar.
- `await __bench.settle()`: espera os modelos terminarem de carregar antes de medir.

### Próximos alvos de desempenho, pelo que a medição mostrou
1. **Vegetação instanciada** (cerca de 5 ms de GPU no mercado): tufos de capim em dupla face e muitos grupos pequenos. Caminhos possíveis: densidade menor por distância, menos grupos.
2. **Chão e cenário fundido** (cerca de 7 ms): sombreamento do chão e malhas grandes.
3. **Recalcular posições** (cerca de 5 ms de processador): congelar o que é estático, com cuidado com o que entra na cena depois.

### Outros
Arquivos que a edição anterior tinha passado de CRLF para LF voltaram ao original. Só mudou o fim de linha, não o conteúdo.

## 20. Prompt mestre — Fase 2b: vegetação por distância (2026-11-03)

### O que acontecia
- **Vila:** o capim, o capim alto e as flores eram desenhados até a beira do mapa. Já estavam divididos em células de 30 m com corte pelo campo de visão, mas sem limite de distância (o corte por distância existente ignora malhas instanciadas). Um tufo tem poucos pixels depois de ~30 m, e a neblina começa em 42 m.
- **Terras Selvagens, pior:** samambaias, flores, cogumelos, tufos e juncos eram **uma malha por tipo para a região inteira** (96 × 96 m), então eram desenhados inteiros em todo quadro, inclusive atrás da câmera.

### O que mudou (`src/game/vegetation.ts`)
- **No shader:** cada planta encolhe até a raiz entre 30 e 40 m da câmera. Não há "estalo": ela some aos poucos, antes da neblina. As distâncias seguem o degrau da qualidade automática, como os outros cortes por distância.
- **Células:** cada célula inteira além da distância deixa de ser desenhada (`VegetationCull`, algumas células por quadro).
- **Terras Selvagens:** as plantas pequenas foram divididas em células de 24 m.
- **Fora disso:** as moitas e as pedras ficam como estavam, porque desenham a beira dos caminhos ao longe.
- **Divisão em células:** saiu de `Foliage.tsx` e virou `chunkInstanced` no módulo novo, usado pela vila e pelas terras selvagens.

### Medição
- **Correção da ferramenta:** a contagem de um quadro só variava ±0,7 milhão de triângulos, porque o mapa de sombras é redesenhado a cada dois quadros. Agora `__bench.calls()` faz a média de dois quadros.
- **Lugares onde as duas medições "antes" concordaram** (com `__vegOff = true`, só no modo de desenvolvimento, todas as plantas voltam a ser desenhadas):

  | Lugar | Triângulos antes | Triângulos depois | Redução |
  |---|---|---|---|
  | Praça | 2,04 milhões | 1,66 milhão | −19% |
  | Floresta da vila | 1,43 milhão | 1,04 milhão | −27% |
  | Bosque Antigo | 1,09 milhão | 0,77 milhão | −30% |
  | Clareira | 0,87 milhão | 0,63 milhão | −28% |
  | Caverna | 0,62 milhão | 0,55 milhão | −12% |

  Nos outros lugares, moradores e bichos andando mudam a amostra de uma medição para outra.
- **GPU:** **não deu para medir o ganho neste computador.** A mesma cena, medida quatro vezes seguidas, deu 17, 73, 93 e 80 ms. A GPU integrada reduz o próprio ritmo com o uso contínuo, e o painel escondido piora isso.
- **Aparência:** conferida com capturas lado a lado, com e sem o corte, na vila e na campina das terras selvagens. O capim e as flores à vista ficam iguais.

### Chão
- **O shader do chão já é cuidadoso:** pedrinhas só de perto, detalhe de terra só onde há terra.
- **O único corte possível** seria pular o ruído da borda no gramado liso. Ele mudaria as manchas escuras do gramado, e o ganho não pôde ser medido, então ficou como está.

### Testes
`tests/vegetation.test.ts` (4 testes):
- as células guardam todas as plantas, cada uma uma vez, com a cor;
- só capim e flores entram no corte por distância;
- o encolhimento entra depois do shader que o material já tinha, e o programa ganha outra chave;
- as distâncias terminam antes da neblina.

## 21. Prompt mestre — Fase 3: os bichos das terras selvagens modelados no Blender (2026-11-04)

### Antes
Os oito tipos de bicho eram montados no código com esferas, cones e caixas. As patas balançavam por código e não havia animação de verdade: dormir era o corpo inclinado, e ficar tonto era um balanço.

### Agora: `tools/blender/build_enemies.py` (Blender 5.2, local)
- **Corpo:** metaballs fundidas numa malha macia, como o corpo do Shinichi, com cores pintadas nos vértices (barriga clara, meias escuras nas patas, ponta da cauda).
- **Rosto:**
  - olhos grandes com íris, pupila (em fenda nas raposas) e brilho;
  - uma pálpebra de cara feia pintada no próprio olho, mais baixa perto do nariz;
  - focinho e nariz.
- **Cada um com a sua identidade:**

  | Bicho | Detalhes |
  |---|---|
  | Ouriço bandido | 260 espinhos de pontas claras, faixa vermelha na testa |
  | Raposa ninja | Faixa escura, olhos cor de âmbar, cauda de ponta creme |
  | Raposa arqueira | Cinza, faixa verde, arco nas costas e aljava de pinhas |
  | Javali rochoso | Presas, crina, placas de pedra nas costas |
  | Texugo guardião | Listras no rosto, capacete com crista, escudo redondo de tábuas com aro e umbo |
  | Doninha ninja | Corpo comprido, faixa preta, cachecol vermelho com as pontas para trás |
  | Espírito da névoa | Gota com cauda de fumaça, olhos fundos e uma folhinha na cabeça |
  | Chefe Espinho | Ouriço grande de espinhos dourados, coroa de espinhos e manto vermelho preso por um broche dourado |

- **Esqueleto:** corpo, cabeça, quatro patas e duas peças de cauda; o espírito não tem patas. Tudo vira **uma malha só com esqueleto** (uma parte por material), e o jogo desenha 5 peças por bicho.
- **Animações (7):**
  - parado (respira, olha em volta, mexe a cauda);
  - andar (trote em diagonal);
  - correr (galope);
  - preparo (agachado, cabeça baixa, cauda em pé: o aviso antes do bote);
  - ataque (o bote para a frente; a arqueira empina e arremessa);
  - tonto (a cabeça gira, as patas abrem);
  - dormir (deitado, patas dobradas, cauda enrolada).
- **Compressão (`compress_enemies.sh`):** simplificação de 55% + meshopt, com o gltf-transform que já estava no cache (nada foi baixado). Ficaram 8 a 12 mil triângulos e 70 a 113 KB por bicho, cerca de 800 KB no total. Conferido no estúdio: olhos, espinhos e meias continuam intactos.

### No jogo (`world/EnemyModel.tsx`, `world/Enemies.tsx`)
- **Os materiais são de cada bicho:** o brilho branco ao levar golpe e o brilho vermelho do preparo acendem só aquele bicho. São os mesmos toon e contorno dos moradores. O espírito é transparente e sem contorno, e o faro o deixa visível como antes.
- **A animação segue o estado:**

  | Estado | Animação |
  |---|---|
  | Dormindo ou calmo | dormir |
  | Tonto ou derrotado | tonto |
  | Preparando o bote | preparo |
  | Atacando | ataque (a velocidade acompanha a duração do bote de cada um) |
  | Andando | andar ou correr, pela velocidade real, com o passo acompanhando |
  | O resto | parado |

  As trocas são suaves.
- **O que o jogo continua fazendo:** o tremor do preparo, o encolher da derrota, as marcas na cabeça e a barra de vida.
- **Formas antigas:** continuam no código e são desenhadas enquanto o modelo carrega, ou se o arquivo faltar.
- **Desempenho:**
  - Cada bicho tem corte pelo campo de visão (limites com folga para as poses). Além da neblina (45 m) ele não é desenhado, mas a cabeça dele continua funcionando.
  - **Resultado:** o Acampamento dos Espinhos ficou em ~305 chamadas e ~1,0 milhão de triângulos, como com as formas antigas (340 a 400 chamadas, 0,6 a 1,0 milhão).
  - **Correção no caminho:** na primeira versão os 20 bichos eram desenhados sempre, cerca de 0,3 milhão de triângulos a mais por quadro.
- **Estúdio:** `?studio=enemies` (ou `&only=raposa,chefe`) mostra os bichos com os materiais do jogo, e `__studio.clip('walk')` troca a animação.

### Testes
- **`tests/enemyModels.test.ts` (3 testes):**
  - cada tipo tem modelo no catálogo, com menos de 200 KB;
  - cada arquivo tem esqueleto, as 7 animações, os ossos esperados (sem patas só no espírito) e apenas materiais que o jogo conhece;
  - o estado escolhe a animação certa.
- **`tests/east.test.ts`:** o teste da cópia leve dos moradores deixou de contar os bichos, que não têm cópia leve.
- **No navegador, em jogo:**
  - em 10 amostras, cada estado tocou a animação certa (perseguir → correr, patrulha → andar ou parado, preparo, ataque, tonto, dormir), e todas as animações estavam rodando;
  - nenhum erro no console nas terras selvagens;
  - combate funcionando com os modelos novos.

### Limitações
- **Gemini, Tripo e Mixamo continuam indisponíveis:** os modelos e as animações foram feitos só com o Blender, por código. As animações são de poses-chave calculadas, não captura de movimento.
- **Chefe Espinho:** não aparece num jogo novo antes da parte da história em que surge; foi conferido no estúdio e nas imagens do Blender.

### Ajustes depois da revisão de perto (2026-11-04)
- **Patas, em todos os bichos:**
  - **Antes:** tubos retos em cima de discos achatados, que pareciam pernas de mesa.
  - **Agora:** cada pata é uma forma macia só, com anatomia. As da frente descem de um ombro arredondado, passam pelo cotovelo e chegam ao pulso. As de trás saem de uma coxa cheia, com o joelho para a frente e o jarrete para trás. As patinhas são redondas, e as "meias" escuras continuam.
- **Ouriço:** espinhos mais escuros, com pontas claras só no fim, cobrindo também o alto, perto da cabeça.
- **Raposa:** pelo do peito. **Arqueira:** a aljava inclinada para trás, sobre o ombro.
- **Texugo:** o escudo passou da pata dianteira para o corpo. Preso à pata, ele voava por cima da cabeça no bote e ficava deitado no chão quando o texugo dormia.
- **Conferido:**
  - poses no Blender (parado, andar, ataque, dormir);
  - antes e depois no estúdio, com os materiais do jogo;
  - em jogo, cada estado com a sua animação e sem erros.
- **Detalhe:** bicho além dos 45 m não atualiza a animação (não é desenhado) e retoma ao voltar a ficar perto.
- **Tamanho:** 70 a 126 KB por bicho.

## 22. Acampamento dos Espinhos, chão e paredões de rocha (2026-11-04)

### O que estava feio (capturas em `tools/art-staging/camp_*_before.png`)
- **Chão:** um verde-oliva chapado, sem caminhos, sem marca de fogueira e sem transição com a grama. O chão da região tem um vértice a cada ~1,3 m, grosso demais para trilhas.
- **Barracas:** duas tábuas em "V".
- **Acampamento:** vazio entre as barracas.
- **Paredões (penhasco norte, cânion e ruínas):** apareciam como grandes placas lisas marrom-escuras. O núcleo de cada paredão era uma caixa mais larga e mais alta que as pedras em volta, e nos paredões norte-sul o encolhimento tinha ido para o eixo errado.

### O que mudou
- **Chão do acampamento (`CampGround`):** uma camada de alta resolução (0,25 m) por cima do chão.
  - Terra batida em manchas de tom terroso, com grão fino.
  - Caminhos gastos mais claros (`CAMP_PATHS`): da entrada à fogueira, e da fogueira a cada barraca, ao saque, às jaulas, à terceira jaula e à torre.
  - Cinza escura em volta da fogueira e terra chamuscada em volta da cinza.
  - Borda irregular que se desfaz na grama (transparência por vértice).
- **Barracas de lona:** dois lados que cedem entre as varas e o fundo fechado. As abas da frente ficam presas abertas, com o interior escuro e o colchonete. Bainha, cumeeira, esteios, cordas e estacas. A colisão continua a mesma.
- **Objetos do acampamento (`CAMP_PROPS`):**
  - tripé com caldeirão sobre a fogueira;
  - pilha de lenha;
  - três sacos do saque;
  - monte de pinhas, a munição da arqueira, ao pé da torre;
  - varal com peixes e ervas secando;
  - mesa baixa com o mapa do bando (com o rio e um X vermelho) e dois tocos.
- **Paredões de rocha:**
  - **Núcleo:** agora é uma pedra lascada longa, com a superfície de rocha natural e fina na espessura certa para cada direção de paredão.
  - **Pedras:** mais largas que o núcleo, em duas fileiras desencontradas por camada, com uma camada de pedras com musgo no topo.
  - **No caminho:** a primeira tentativa de cor no núcleo usou a textura "stone", que é de tijolos e virou um muro de tijolos. Foi trocada pela superfície de rocha que as pedras já usam.

### Conferido
- **Capturas antes e depois:** acampamento ao nível do olho e visto de cima, e paredão.
- **Auditoria física:** zero problemas (caminhos, moradores, rondas, bichos, objetos, portas).
  - Os caminhos gastos estão livres, exceto onde terminam na porta das barracas.
  - As três jaulas são alcançáveis por 14 a 16 lados.
  - A mesa do mapa estava em cima do caminho para a barraca do norte e foi tirada dali.
- **Desempenho:** Espinhos ficou em ~240 chamadas e 0,7 milhão de triângulos (antes, ~305 e 1,0 milhão, com a variação entre medições).
- **Testes:** `tests/camp.test.ts` (3 testes):
  - os caminhos ligam a entrada, a fogueira, as barracas, o saque e as jaulas;
  - os objetos ficam fora dos caminhos e dentro da cerca;
  - nenhum objeto no lugar de um bicho do bando, na ronda da doninha ou colado numa jaula.
- **Resultado:** 582 testes passando; nenhum erro no console.

### Fica para depois
A cachoeira ainda é um plano reto com listras (vista nas capturas do paredão norte).

## 23. As cachoeiras (2026-11-05)

### Antes
As três cachoeiras eram planos retos com listras brancas rolando e bolas de espuma em fila:
- a das terras selvagens, com 8 m;
- a do rio da vila, com 4,4 m;
- a do terraço do Templo de Mikage, com 1,6 m.

A rocha da cachoeira da vila era uma caixa marrom lisa.

### Agora: `world/Cascade.tsx`, um componente para as três
- **Lâmina d'água:**
  - curva para fora ao cair e alarga um pouco embaixo;
  - pintada por um shader com duas camadas de fios d'água descendo em velocidades diferentes, que se esticam conforme a água acelera;
  - espuma na borda e no pé, laterais suaves e a neblina da cena.
- **Espuma no pé:** bolhas brancas de tamanhos e lugares variados, fervendo cada uma no seu ritmo. São sem luz própria: iluminadas pelo pôr do sol, viravam "travesseiros" cor-de-rosa.
- **Bruma:** partículas que sobem, se espalham e se desfazem.
- **Anéis:** ondas que se abrem na água ao pé da queda.
- **Custo:** 4 desenhos por cachoeira, qualquer que seja o tamanho.
- **Descartado:** um rolo branco na borda parecia um cano; a faixa de espuma do próprio shader já faz esse papel.
- **Rocha da cachoeira da vila:** uma pedra lascada grande com a superfície de rocha natural, pedras em volta da face e um topo com musgo. A colisão é a mesma de antes.
- **Templo:** a lâmina é fina e transparente, e o nicho com o baú continua visível atrás dela.

### Conferido
- **Capturas:** antes e depois das três cachoeiras, de longe e de perto.
- **Auditoria física:** zero problemas.
- **Console:** sem erros.
- **Testes:** `tests/cascade.test.ts`: a lâmina vai da borda ao pé, abre para fora e alarga embaixo. 583 testes passando.

## 24. Bichos mais vivos: orelhas, deformação e quatro animações novas (2026-11-05)

### No Blender (`tools/blender/build_enemies.py`)
- **Orelhas com osso próprio** (`ear.L` / `ear.R`), em todos os bichos menos no espírito, que não tem orelhas:
  - mexem uma de cada vez quando o bicho está parado;
  - balançam ao andar e deitam para trás ao correr;
  - ficam achatadas e abertas no preparo;
  - ficam em pé quando o bicho está alerta;
  - caem quando ele está tonto ou dormindo.
- **Deformação:** o corpo se encolhe no preparo e se estica no bote. É uma escala no osso do corpo, dada em eixos do mundo e convertida para os eixos de cada osso.
- **Animações novas:**

  | Animação | Quando | O que faz | Quantas vezes |
  |---|---|---|---|
  | alerta | Viu o gato | Na ponta das patas, cabeça alta, cauda dura, orelhas em pé; a pose respira | Em ciclo |
  | golpe | Levou um golpe | Jogado para trás e para cima, achatado, cabeça sacudida | Uma vez |
  | desmaio | Foi derrotado | Tomba de lado com as patas duras, enquanto o jogo o encolhe na fumaça | Uma vez, segurando o último quadro |
  | farejar | Parado ou procurando | Nariz no chão, cheirando | Em ciclo |

- **Total:** 11 animações por bicho. Os arquivos ficaram com 86 a 167 KB, cerca de 1,16 MB os oito.
- **Testado e descartado:** remover quadros redundantes (`resample`) deixou os arquivos maiores, porque o meshopt já comprime melhor animação regular.

### No jogo (`world/EnemyModel.tsx`)
- **Estado → animação:**
  - parado depois de ver o gato (alerta, ou perseguindo mas parado) → alerta;
  - procurando o que ouviu → farejar;
  - derrotado → desmaio (antes era a animação de tonto).
- **Golpe:** quando o brilho branco do golpe acende, o tranco toca por 0,4 s por cima de qualquer animação, menos o desmaio.
- **Parado:** de vez em quando o bicho para e fareja o chão (a primeira vez entre 4 e 10 s, por 1,6 s; depois a cada 6 a 14 s), para que nunca fique como estátua.

### Conferido
- **Poses no Blender:** preparo, ataque, alerta, golpe, desmaio e farejar, na raposa e no javali.
- **Em jogo** (300 quadros, 20 bichos):
  - cada estado tocou a animação certa;
  - o golpe disparou o tranco e a derrota disparou o desmaio;
  - nenhum erro.
- **Testes:**
  - `tests/enemyModels.test.ts`: as 11 animações e os ossos das orelhas em cada arquivo, o novo mapa de estados, o tranco e o farejar de vez em quando;
  - 584 testes passando.

## 25. Otimização: sombra das copas com cópia leve (2026-11-05)

### Medição
Contei, só no modo de desenvolvimento, os triângulos de cada forma de origem do cenário fundido (`window.__mergeStats`, em `StaticMerge.tsx`):
- **Total do cenário:** cerca de 2,2 milhões de triângulos.
- **Copas de árvore** (4 formas de 874 triângulos, verdes e rosa-cerejeira, usadas 1.172 vezes): **1,02 milhão (46%)**. 0,93 milhão disso era desenhado de novo no mapa de sombras.
- **Seguintes**, bem atrás: pedras (≈205 mil) e esferas pequenas de enfeites (≈100 mil).

### O que mudou
A sombra de cada copa agora é desenhada pela versão leve dela, a mesma usada nas moitas: os mesmos tufos, com menos da metade dos triângulos (6 tufos em vez de 8).
- `foliageGeometry.ts`: a copa normal guarda a leve em `userData.shadowLod`.
- `StaticMerge.tsx`: usa essa cópia ao montar as cópias de sombra.
- **Na tela:** a copa continua a mesma.

### Resultado
- **Cópias de sombra do mundo inteiro:** 1,16 milhão → 0,59 milhão de triângulos (**−50%**), numa contagem exata, sem variação entre medições.
- **Aparência:** conferida com capturas lado a lado, de dois ângulos, na praça e na rua do mercado. As sombras das árvores ficaram iguais; só os moradores tinham mudado de lugar.
- **Testes:** `tests/shadowLod.test.ts`. As copas normais têm a cópia leve, com menos de 55% dos triângulos, e ela ocupa quase o mesmo lugar: até ~11% do raio, porque tem 6 tufos em vez de 8.
- **Limite da medição:** o ganho de tempo na GPU não pôde ser medido nesta máquina (mesmo motivo do §19). O número confiável é a contagem de triângulos.

## 26. Terras selvagens no estilo da vila: trilhas, grama, fogueira e barracas (2026-11-05)

### Pedido
"As estradas, pedras, fogo, barraca e grama das terras selvagens ainda estão muito feias e não seguem a estética dos demais cenários do jogo."

### O que estava diferente da vila
- **Trilhas:** faixas planas de cor única, com círculos nas juntas.
- **Chão:** a cor do bioma multiplicava a textura de grama, que deixava tudo verde-oliva e chapado. A textura repetia a cada 4 m, metade da escala da vila.
- **Grama:** 700 tufos de cones simples, espalhados ralos. O meio do acampamento (17 × 18 m) ficava sem nada.
- **Fogo:** um cone liso, sem animação de chama.
- **Barracas:** um prisma de 3 lados.

### O que mudou
- **Chão e trilhas** (`WildScenery.tsx`): o terreno usa o mesmo shader de terra da vila, agora compartilhado em `Ground.tsx` (`DIRT_MIX_GLSL`, `DIRT_GLSL`):
  - borda irregular e úmida, dois tons, centro mais claro, grãos e pedrinhas;
  - textura de grama na escala da vila (~8 m);
  - manchas de claro/escuro e de tom quente na mesma escala da vila.
- **Textura macro:** é uma textura de dados (B = trilha, A = quanto de grama). Ela não pode ser um canvas, que pré-multiplica o alfa e apagaria os outros canais onde não há grama.
  - A distância até as trilhas é calculada só perto de cada trecho: **~10 s → ~0,4 s** para montar (medido na aba oculta).
- **Trilhas:** passam pelas trilhas da região, pelos caminhos do Acampamento dos Espinhos, pelo meio dos dois acampamentos e pelo pátio do posto. As faixas planas antigas (`Trails`) saíram.
- **Grama** (`WildGrass`): os mesmos tufos, capim alto e flores da vila (`Foliage.tsx`), com o mesmo vento, as mesmas manchas e a mesma densidade.
  - Respeita o nível de qualidade (alta 100%, média 60%, baixa 30%).
  - Como na vila, um raio da física de cima para baixo tira a grama de baixo de barracas, caixotes, mesas, troncos e pedras.
  - Não cresce na terra batida, na areia do rio, na caverna nem no posto.
- **Fogueira** (`world/Campfire.tsx`, nova, usada nas 4 fogueiras):
  - anel de pedras de verdade (o shader de rocha);
  - dois troncos cruzados com pontas queimadas e uma pirâmide de gravetos (madeira fundida em 2 malhas);
  - brasas e brilho no chão;
  - 3 camadas de chama macia que balança (shader com gradiente, aditivo) e faíscas subindo;
  - apagada (`lit = false`): madeira carbonizada e cinza. O fogo dos Espinhos apaga quando o chefe é vencido.
  - As pedras da roda de troncos dos Espinhos também viraram rochas.
- **Barracas:** as 6 barracas de prisma viraram a barraca de lona do acampamento (laterais caídas, portas abertas, cordas, estacas). A abandonada usa a variante `torn` (mais baixa e tombada).

### Verificação
- **Capturas** (`tools/art-staging/wild_after_*.png`): acampamento da expedição, fogueira de perto, trilha, Acampamento dos Espinhos e acampamento abandonado, comparadas com a vila (`village_cmp_*.png`) no mesmo horário.
- **Física:** `__audit.run()` sem nenhum problema (caminhos, NPCs, patrulhas, inimigos, objetos e portas).
- **Testes:** `tests/wildGround.test.ts` (4 testes):
  - o meio de toda trilha e caminho é terra;
  - a campina longe das trilhas é grama;
  - rio e caverna sem grama;
  - a textura macro guarda terra e grama nos lugares certos, e o canal de brilho sobrevive onde não há grama.
  - Suíte inteira: 590 testes passando.

### Custo
- **Grama:** contagem exata no jogo carregado.
  - Antes: 700 tufos simples e 420 flores.
  - Agora: 13,6 mil instâncias (≈303 mil triângulos no total), em 32 blocos que somem com a distância.
  - A vila tem 9 mil instâncias (≈230 mil triângulos) numa área menor: densidade parecida.
- **Fogueira acesa:** cerca de 2,9 mil triângulos (antes ~1,5 mil). As partes fixas entram no cenário fundido. Ficam 6 chamadas de desenho animadas (3 chamas, faíscas, brasas, brilho) no lugar de 1.
- **Limite da medição:** a contagem da cena inteira por ponto (`__bench.calls`) variou muito entre duas medições seguidas sem mudança nenhuma (ex.: floresta 326 → 221 chamadas), por causa dos bichos andando e do carregamento dos modelos. Por isso a comparação confiável é a das peças acima, não o total da cena. O tempo de GPU não pôde ser medido nesta máquina (mesmo motivo do §19).

## 27. Cervos refeitos no Blender: modelagem, esqueleto e animação (2026-11-05)

Pedido: "os cervos estão muito feios, refaça a modelagem de forma profissional". Os 12 cervos do jogo (7 na Clareira dos Cervos, 5 na Campina das Ervas) eram montados com esferas e cilindros soltos, com o pescoço e as pernas girando como peças duras.

### O que mudou
- **Modelos novos** feitos por script no Blender 5.2 (`tools/blender/build_fauna.py`), no mesmo processo dos bichos inimigos (`build_enemies.py`, cujas funções foram reaproveitadas):
  - `fauna_cervo.glb`: macho com chifres ramificados (haste, ponta da testa e duas pontas no alto);
  - `fauna_cerva.glb`: fêmea, pescoço mais fino, sem chifres;
  - `fauna_filhote.glb`: filhote com cabeça, olhos e orelhas maiores e mais pintas (feito no tamanho adulto; o jogo reduz pela escala de cada um).
- **Anatomia:** corpo, pescoço e pernas são uma peça só, esculpida (sem emendas). Peito fundo e cintura fina. Pernas com ombro, cotovelo, joelho, canela fina, boleto e casco fendido (dois dedos e as unhas de trás). Atrás: coxa cheia, joelho para a frente e jarrete para trás. Cabeça em cunha com focinho claro, queixo branco, anel claro em volta dos olhos grandes e brilhantes e nariz escuro com narinas. Orelhas grandes em concha.
- **Pelagem de cervo-sika:** risca escura no dorso, fileiras de pintas brancas, barriga creme, garupa branca com borda escura, rabo branco com risca escura e tufo branco na pata traseira.
- **Esqueleto:** corpo, pescoço, cabeça, duas peças por perna (joelho e jarrete dobram de verdade), rabo em duas partes e orelhas.
- **Animações:**
  - parado: respira, olha em volta, mexe a orelha e o rabo;
  - pastando: cabeça na grama, mastigando, patas da frente abertas;
  - andando: passo em quatro tempos;
  - correndo: galope com salto e rabo levantado;
  - alerta: cabeça alta, orelhas para a frente, rabo erguido e uma batida da pata.
- **No jogo** (`world/DeerModel.tsx`):
  - na Clareira, os cervos alternam entre pastar e olhar em volta, e ficam em alerta quando o gato chega perto;
  - na Campina, seguem a lógica de antes (`systems/wildlife.ts`): pastam, andam, ficam em alerta antes de fugir, correm e voltam devagar;
  - os cervos ficaram maiores que o gato (antes tinham quase a altura dele);
  - se os arquivos faltarem, o jogo desenha os cervos antigos.
- **Compressão:** `tools/blender/compress_fauna.sh` (simplificação e meshopt, com o gltf-transform do cache local) deixa cada arquivo entre 130 e 140 KB.

### Verificação
- **Imagens do Blender** (`tools/art-staging/fauna/`): frente, três-quartos, lado, costas e cada animação, revisadas e corrigidas três vezes:
  - pernas que pareciam coladas viraram uma peça só;
  - a cabeça cresceu e o pescoço encurtou;
  - o vinco do pescoço ao pastar foi corrigido;
  - as pernas dobravam demais na corrida;
  - a orelha ficava "de prato" ao pastar.
- **Imagens no jogo** (`tools/art-staging/cervo_*.png`): a Clareira com os cervos pastando e em alerta; a Campina com a manada pastando, em alerta e fugindo do gato.
- **Física:** `__audit.run()` sem nenhum problema.
- **Testes:** `tests/deerModels.test.ts` (4 testes):
  - catálogo e tamanho dos arquivos;
  - esqueleto, as 5 animações e os materiais;
  - só o macho tem chifres;
  - a contagem de filhotes da pergunta da Batedora Kaze não mudou;
  - cada estado escolhe a animação certa.
  - Suíte inteira: 594 testes passando.

### Custo
- **Por cervo:** 12,2 a 13,5 mil triângulos, mais o contorno. Antes era de 2 a 3 mil.
- **Chamadas de desenho:** cerca de 5 por cervo. Antes eram de 15 a 17.
- **Na Clareira (7 cervos):** de cerca de 114 para cerca de 36 chamadas de desenho, mas com mais triângulos (≈150 mil, com contorno).
- **Visibilidade:** os cervos só são desenhados de perto (`DistanceCull` na Clareira; a Campina só existe nas Terras Selvagens).
- O tempo de GPU continua sem medição confiável nesta máquina (§19).

## 28. Auditoria geral de estabilidade (2026-11-05)

Pedido: "PROMPT MESTRE — AUDITORIA GERAL, IDENTIFICAÇÃO E CORREÇÃO DE BUGS". Nenhuma função nova. Os testes rodaram numa aba isolada do navegador interno: o save de lá é só de teste e não é o progresso da criança, que fica no aparelho dela.

### A. Diagnóstico: o que foi examinado e como

| Área | Verificação | Resultado |
|---|---|---|
| **Código** | `tsc` estrito, inclusive variáveis e parâmetros sem uso | 0 erros |
| **Dados** | `__validate()`: toda missão, diálogo, objeto e desafio aponta para algo que existe | 0 referências quebradas |
| **Vazamentos** | Busca por eventos registrados e nunca removidos, e por timers sem limpeza | Os 5 arquivos sem `removeEventListener` instalam uma vez só, com trava (teclado, controle, áudio, instalação do app, service worker). Os `setInterval` têm `clearInterval`. Nenhum vazamento |
| **Console** | Erros durante a volta por toda a vila, os 4 interiores, as Terras Selvagens e as trocas de região | 0 erros |
| **Física** | `__audit.run()`: caminhos, moradores, patrulhas, inimigos, objetos e portas | 0 problemas |
| **Sobreposição de sólidos** | Novo teste ad hoc: cada par de colisores fixos que se atravessam mais de 8 cm (87 pares) | Os maiores, conferidos pela posição, são peças encostadas de propósito: os níveis da colina dos Jizō, os terraços do chá, a cerca sul com o portão e o terraço do Templo de Mikage com as pedras. **Os demais não foram investigados um a um** (pendência) |
| **Visual** | 17 pontos da vila e dos bairros, os 4 interiores e 6 pontos das Terras Selvagens, fotografados e revisados | 2 defeitos reais (abaixo) e 2 falsos alarmes |
| **Interface (celular, 375 × 812, toque)** | HUD, Missões, Mochila, Jornada, Mapa, Ajustes, loja, desafio e diálogo: nada fora da tela e nenhum texto cortado | Os painéis longos rolam dentro do painel, como devem. 1 defeito numa janela estreita sem toque |
| **Salvamento** | Somar moedas, item e flag, conferir o `localStorage`, recarregar a página e conferir de novo | Tudo voltou igual |
| **Primeiro minuto** | `__onb.firstMinute()` (jogador novo simulado) | Objetivo em 0,1 s, pegadas douradas em 1,4 s, morador em 3,1 s, diálogo em 4,2 s, missão aceita em 7,3 s |
| **Desempenho** | `__bench.calls()` | Praça: 560 chamadas e 1,83 milhão de triângulos (antes: 526 e 1,87 milhão); mercado, rio e floresta também dentro da variação de sempre. Nenhuma regressão |
| **Missões** | Testes que já existiam: toda missão pode ser iniciada pelo morador e concluída sem travar; a história inteira rodada com as ações do jogo | Passam |

**Classificação dos problemas encontrados:**
- Crítico: 0.
- Alto: 0.
- Médio: 1 (cerva dentro de pedra, que é um animal em lugar errado).
- Baixo: 2 (barra de habilidades numa janela estreita; nome da barraca do Armazém).

### B. Correções

| # | Gravidade | Problema | Causa | Correção |
|---|---|---|---|---|
| 1 | Médio | Na Clareira dos Cervos, a mãe cerva da família perto do portão estava dentro de uma pedra grande com musgo. Já acontecia antes de os cervos crescerem (§27); ficou mais visível depois | O chão do Bosque Antigo sorteia 22 pedras e 60 samambaias (`ForestFloor`) evitando trilhas, riacho, campina e saliências, mas **não** os cervos, os moradores e os objetos. A primeira correção, que só evitava os cervos, fez o sorteio jogar outra pedra colada na Batedora Kaze | O sorteio (`forestFloorSpots`, agora exportado em `AncientGrove.tsx`) também deixa livre a área de cada cervo (2 m × tamanho), de cada morador e de cada objeto do jogo (2,2 m). Teste novo em `tests/layout.test.ts`, que falha com o código antigo |
| 2 | Baixo | Numa janela estreita sem toque (menos de 400 px), a barra de habilidades saía 27 px pela esquerda e cortava o primeiro botão. **No celular não acontece:** com toque, a barra dá lugar aos botões de toque | A regra "esconder abaixo de 760 px" vinha antes da regra base e por isso nunca valia: era código morto | A regra morta saiu. A barra agora cabe na tela: ocupa no máximo a largura da janela e quebra para uma segunda fileira (`styles.css`). Conferido a 375 px: os 6 botões dentro da tela |

### Falsos alarmes (verificados e mantidos como estão)
- **Caixote em cima do toldo da barraca de frutas:** é o baú secreto da rota pelos caixotes (`CrateSteps`, com brilho dourado). É de propósito.
- **Objetos "acima do chão"** na comparação de alturas: as patinhas douradas e as argolas flutuam de propósito, e cada objeto tem o próprio corpo sólido. A medida não serve para achar defeito e foi descartada.
- **Missão sem caixa de acompanhamento** na simulação do primeiro minuto: a caixa só aparece quando o diálogo fecha, e a medição foi feita com o diálogo ainda aberto.

### C. Testes executados
- Suíte inteira: **595 testes passando** (594 + 1 novo).
- `tsc` sem erros e build de produção sem erros.
- No jogo, numa aba isolada:
  - física (`__audit.run`);
  - console;
  - fotos de todas as regiões;
  - interfaces no tamanho de celular;
  - salvar e recarregar;
  - primeiro minuto;
  - desempenho.
- Cada correção foi conferida no jogo:
  - foto da Clareira depois da correção;
  - recálculo do sorteio: 0 pedras dentro de cervos e 0 coladas em moradores ou objetos;
  - a barra medida a 375 px.

### D. Pendências e limitações
- **Testes de colisão andando** (`__qa.walls`, `bridge` e `camera`): não terminaram. Eles esperam o relógio do navegador, que quase para com o painel escondido. Os mesmos pontos já tinham passado nas etapas anteriores; desta vez não foram repetidos.
- **Partida completa à mão, com toque de verdade e controle físico:** não foi possível aqui. As missões foram verificadas pelos testes automáticos da campanha inteira, não jogadas uma a uma.
- **Tempo de GPU e FPS reais:** sem medição confiável nesta máquina com o painel escondido (§19).
- **Sugestão (não implementada, é mudança de conteúdo):** a barraca do Armazém do Boku usa a placa pintada "Frutas da Vila" e vende frutas no balcão, mas a loja vende equipamento. Trocar o nome ou as mercadorias é decisão de conteúdo.
- **Sons sintetizados:** continuam marcados como provisórios (pendência antiga).
- **Sobreposição de colisores:** dos 87 pares de colisores fixos que se atravessam, só os maiores foram conferidos. O restante fica para uma próxima rodada, com fotos de cada par.

### E. Estado final
O jogo abre, salva, carrega e troca de região sem erros. A física está sem bloqueios.

**Validado nesta rodada:**
- vila, bairros, Bambuzal, Bosque Antigo, Clareira, Templo de Mikage e Templo dos Enigmas;
- os 4 interiores;
- as Terras Selvagens;
- os painéis no celular;
- o salvamento.

**Ainda precisa de teste num aparelho de verdade:** o toque, o controle físico e o FPS.

## 29. Arte nova do menu e das comemorações (Gemini, 2026-11-05)

Pedido: "utilize o Gemini para criar imagens melhores para os menus e comemorações". As 6 imagens antigas eram renders do próprio jogo: pelo granulado, recorte serrilhado e rosto parado.

### Como foram feitas
- **Ferramenta:** Gemini (gemini.google.com), na conta do usuário, aberto no navegador do app. O usuário fez o login, e o download dos 6 arquivos foi autorizado por ele.
- **Pedidos:** em `tools/art-staging/gemini/PROMPTS.md`. Todos na mesma conversa, para o personagem sair igual nas 6:
  - estilo de filme de animação 3D;
  - o Shinichi descrito em detalhe: branco com manchas escuras, olhos verdes, bandana com a placa da **pata**, coleira, bolsa e faixas nos braços;
  - sem texto e sem símbolos de outros animes.
- **A referência visual não foi junto:** o navegador do app não anexa arquivos, então a descrição em texto bastou. O resultado bate com o modelo do jogo.
- **Tratamento:**
  - reduzidas para o tamanho de uso e salvas em WebP;
  - o fundo branco das duas figuras recortadas (correndo e pensando) foi tirado com um preenchimento a partir da borda, com borda suave (`tools/art-staging/gemini/cut.py`), e o pelo branco ficou intacto;
  - nenhuma marca d'água nos cantos.

| Arquivo | Onde aparece | Antes | Agora |
|---|---|---|---|
| `hero-vila.webp` | Fundo do menu inicial | Render 1600 × 900, 183 KB | Ilustração 1920 × 1072, 128 KB |
| `comemoracao.webp` | Missão concluída | Render 600 × 800, 72 KB | 900 × 1205, 83 KB |
| `pausa-cochilo.webp` | Pausa | Render 1200 × 675, 100 KB | 1280 × 714, 68 KB |
| `portrait.webp` | HUD, save e diálogos | Render 512², 53 KB | 512², 24 KB |
| `run-cut.webp` | Tela de carregamento | Recorte 422 × 420, 36 KB | 557 × 560, 52 KB |
| `thinking-cut.webp` | Desafios de matemática | Recorte 525 × 720, 82 KB | 516 × 760, 58 KB |

Somadas, ficaram menores que as antigas: 413 KB contra 526 KB.

### Enquadramento (`styles.css`)
- **Menu:** a imagem fica presa a 72% da largura, para o Shinichi continuar visível em telas mais estreitas que 16:9.
- **Pausa:** `cover` a 75% da altura, para o cochilo e a almofada aparecerem inteiros.
- **Comemoração:** 35% da altura, para pegar o salto inteiro.
- **Desafio:** o desbotado de baixo ficou mais curto (92%), porque agora o gato aparece de corpo inteiro.
- **Conferido:** simulei os recortes nos tamanhos reais (1024 × 768, celular 375 × 812, caixa de pausa 420 × 220, coluna da comemoração e retrato no círculo).
- **Não conferido:** a captura de tela do navegador não funcionou com o painel escondido. Os tamanhos das caixas vieram do CSS.

A arte de aniversário (`birthday.webp`, com o nome da criança) não mudou e continua fora do repositório.

