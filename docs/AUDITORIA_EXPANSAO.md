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
| 16 | Pacote principal: 901 KB (gzip 286 KB) na Etapa 10. Avaliado na Etapa 9: todo esse código é necessário antes do primeiro quadro, então dividir não reduz o que o jogador baixa; só mudaria o cache entre versões. Mantido | — |

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
