# Shinichi — O Caminho do Gato Ninja · Estado do projeto

## Arquitetura

| Módulo | Pasta | Responsabilidade |
|---|---|---|
| Progressão | `src/systems/progression.ts` | Condições, etapas disponíveis, ações em texto (`START:`, `STEP:`, `GIVE:`…) |
| Eventos | `src/systems/events.ts` | Barramento de eventos: a lógica emite, áudio e UI escutam |
| Estado/salvamento | `src/store/gameStore.ts` | Fases, diálogo, desafios, missões, inventário, flags. Salva `player` + `progress` (versão 2, com migração) |
| Conteúdo | `src/data/` | `missions.ts`, `npcs.ts`, `world.ts`, `challenges.ts`, `items.ts` — tudo por dados |
| Mundo 3D | `src/game/world/` | Vila, rio/ponte/cachoeira, Floresta do Treinamento, Jardim Secreto, arredores |
| Interação | `src/game/systems/interaction.ts` | Registro único de alvos; a tecla E sempre usa o mais próximo |
| Entrada | `src/game/systems/input.ts` | Teclado e toque escrevem no mesmo estado |
| Áudio | `src/audio/` | Motor, música adaptativa, efeitos, ambiente, ponte com os eventos |
| Interface | `src/ui/` | HUD, diálogos, desafios, painéis (missões, mochila, mapa, ajustes), toque |
| Desempenho | `src/game/StaticMerge.tsx` | Funde cenário estático em poucas malhas (≈760 → ≈240 draw calls) |

**Como adicionar uma missão:** acrescente um objeto em `data/missions.ts`, uma rota de diálogo no NPC (`routes` com `when`) e, se precisar, um objeto em `data/world.ts`. Nenhum sistema central precisa mudar.

## Capítulo 1 — implementado (12 missões, todas testadas de ponta a ponta)

| # | Missão | Tipo | Doador |
|---|---|---|---|
| 1 | O Mistério dos 48 Peixes | investigação | Chef Tofu |
| 2 | A Receita Perdida | cômica / planejamento | Chef Tofu |
| 3 | Chuva de Peixes | cômica / divisão | Taro |
| 4 | O Fantasma do Galpão | investigação / pistas ambientais | Guarda Roku |
| 5 | A Coragem da Mei | empatia / escolhas com consequência | Mei |
| 6 | O Caminho das Argolas | treinamento (desbloqueia Salto Duplo) | Mestra Lótus |
| 7 | A Peixomática 3000 | educativa / proporção | Kiko |
| 8 | As Contas do Kenzo | educativa / multiplicação e troco | Kenzo |
| 9 | O Mapa do Tesouro | exploração / leitura | Sora |
| 10 | O Jardim Escondido | principal / padrões | Mestre Kuma |
| 11 | As Patas Douradas | exploração / colecionáveis (8) | — |
| 12 | A Sombra na Floresta | principal (gancho do antagonista) | Mestre Kuma → Kuro |

## Capítulo 2 — "As Lanternas da Vila" (implementado, 8 missões)

| # | Missão | Tipo | Doador | Mecânica nova |
|---|---|---|---|---|
| 13 | Gol de Patinha | treinamento | Taro | bola com física, chute (E), gol |
| 14 | O Festival das Lanternas | secundária | Chef Tofu | coletar e pendurar lanternas, fogos |
| 15 | A Escada do Mirante | educativa / recursos | Vovó Mochi | planejar tábuas × preço, consertar escada, luneta |
| 16 | Folhas ao Vento | treinamento / reflexo | Mestra Lótus | pegar folhas no ar lendo a sombra |
| 17 | O Cofre do Guarda Roku | investigação / lógica | Guarda Roku | 3 pistas → código 853 |
| 18 | Esconde-Esconde dos Filhotes | exploração | Tanuki | risadinhas posicionais + Faro |
| 19 | O Peixe Fujão | cômica | Seu Bigodes | peixe que foge (IA simples) |
| 20 | As Lanternas Apagadas | principal (final) | Chef Tofu → Kuro | diálogo empático, Lanterna da Memória |

Consequências: Kuro vira amigo e passa a aparecer na praça; o Tanuki fala diferente conforme a escolha da missão 1; faixas cosméticas (vermelha/dourada) podem ser usadas pela mochila.

## Física e mundo (desta etapa)

- Controle: tempo de "coiote", buffer de pulo, altura variável, rampas sem escorregar, subida automática de degraus baixos, plataformas móveis (jangadas), cogumelos que impulsionam.
- Objetos com física: caixotes, barris, novelos e bola; NPCs com colisão e rondas (Guarda Roku, Pipo).
- Vida: borboletas, pássaros, peixes saltando no rio, fumaça de chaminé, poeira ao correr/pousar, fogos, vento nas árvores.
- Visual: céu diurno, montanhas e templos ao fundo, luz de contorno estilo anime, brilho (qualidade Alta), qualidade gráfica automática.

## Visual: personagens e cenário (desta etapa)

- **Texturas procedurais** (`src/game/textures.ts`): madeira, tábuas, telhas, pedra, reboco, sapê, casca e calçamento, geradas uma vez em canvas e tingidas pela cor de cada material. O `StaticMerge` projeta UVs em coordenadas do mundo, então as texturas continuam funcionando depois da fusão das malhas.
- **Telhados japoneses** (`src/game/roofGeometry.ts`): telhado de quatro águas com inclinação côncava e cantos levantados. Casas com fundação de pedra, varanda (engawa), lambri de tábuas, vigas, porta corrediça e vasos de planta; cantina e dojô com dois andares de telhado. Pagode com sacadas e pináculo; cabana com sapê.
- **Natureza**: cerca de 6.500 tufos de grama e 600 flores instanciados, que balançam com o vento (`src/game/world/Foliage.tsx`). Não nascem dentro de construções porque o posicionamento consulta a física, nem nos caminhos, na praça, no rio, nos tatames ou no lago das carpas. A densidade cai nas qualidades Média e Baixa. Rio com shader toon (faixas de profundidade, espuma, brilho) e margens de pedra. Cerejeiras com casca texturizada, galhos, 12 cachos de flor e um tapete de pétalas no chão.
- **Novo molde dos aldeões** (`src/game/entities/Critter.tsx`): corpo de quimono em forma de pera, com gola cruzada, obi com laço, mangas largas terminando em patas, pés, cauda por espécie (curva de gato, tanuki listrada, cachorro, coelho), bigodes, boca em "w" e olhos de anime no estilo do Shinichi. Cada personagem tem a própria cor de roupa, acabamento e íris (tabela `OUTFITS`). Os aldeões piscam: as pálpebras só são desenhadas durante a piscada, então piscar não custa draw calls extras.
- **Shinichi**: a faixa ninja agora é uma fatia da esfera da cabeça, inclinada (baixa na testa, alta no nó) e com contorno, em vez de um anel parecido com aba de chapéu.
- **Desempenho**: as mangas dos aldeões são fundidas dentro do próprio grupo animado, e `StaticMerge castAll` junta as partes sólidas de cada personagem num único bucket. Na qualidade Alta, a vista da praça tem cerca de 550 draw calls.

## Visual: luz, terreno e natureza (etapa seguinte)

- **Pós-processamento** (`src/game/Effects.tsx`, qualidades Média e Alta): renderização com antialiasing multisample, que o bloom anterior perdia; gradação de cor com saturação, sombras violeta e luzes douradas; curva de contraste suave e vinheta. O bloom fica só na Alta.
- **Sombras de anime**: no shader toon, as faixas de sombra puxam para azul-violeta e as áreas iluminadas ficam levemente quentes (`enhanceToon` em `materials.tsx`).
- **Terreno**: uma textura grande do mapa inteiro (`useGroundMacro` em `Ground.tsx`) quebra a repetição da grama com manchas claras, escuras e secas, e desenha **caminhos de terra** contínuos ao longo de `PATHS`. As pedras de passo ficaram mais esparsas, sobre a terra. A grama evita os caminhos inteiros (`pathDistance`).
- **Chafariz novo**: bacia de pedra em degraus, água com ondas animadas, quatro carpas soltando jatos d'água e um gato-guardião de pedra (maneki-neko) sobre um pedestal de lótus.
- **Árvores fofas** (`src/game/foliageGeometry.ts`): copas feitas de vários "pufes" fundidos, com normais curvadas para o centro, o que dá silhueta de nuvem e sombreamento suave. Usadas em cerejeiras, pinheiros, fundo, casa da árvore, vasos e sebes do jardim secreto.
- **Arbustos e pedras**: até 160 arbustos (alguns floridos) nascem automaticamente ao pé de muros, varandas e cercas; pedrinhas ficam na beira dos caminhos. A quantidade de arbustos acompanha a qualidade.
- **Unity/Python**: avaliado e não adotado. Unity usa C#, não Python; exige conta e login no Unity Hub; obrigaria a reescrever as 20 missões, o áudio e a interface; e o jogo deixaria de rodar direto no navegador. A diferença visual estava na arte, não no motor.

## Capítulo 3 — ideias (não implementado)

Torneio de Furtividade Barulhento · Ilha do Lago e barcos · Interiores (cantina, dojo) · Ciclo de dia e noite · Treino de técnicas com o Kuro.

## Elenco

Chef Tofu (cozinheiro em situações absurdas), Kenzo (comerciante organizado e ruim de contas), Mei (tímida que supera o medo), Tanuki (fez o errado por um motivo compreensível), Mestre Kuma (sábio misterioso), Mestra Lótus (mestra sarcástica), Taro (rival arrogante que aprende), Kiko (inventor excêntrico), Guarda Roku (guarda atrapalhado), Dona Neko (o "fantasma"), Sora (exploradora), Kuro (antagonista carismático com motivação compreensível).

## Recursos e o que é provisório

| Categoria | Local | Situação |
|---|---|---|
| Referências conceituais | `references/concept/` | Imagens geradas por IA; **não** vão para o jogo publicado |
| Elementos de interface | `public/assets/ui/` | Recortes das referências usados no menu, HUD, desafio e comemoração |
| Modelos 3D | `src/game/entities/`, `src/game/world/` | **Provisórios procedurais** (geometria em código, sombreamento toon) |
| Texturas | geradas em código (canvas) | Grama, praça, listras, madeira, telhas, pedra, reboco, sapê, casca, calçamento; água via shader |
| Música | `src/audio/music.ts` | **Provisória**: 10 temas curtos escritos como padrões e tocados por sintetizador (paleta shakuhachi/shamisen/koto/taiko + "miau"). Não é trilha original gravada |
| Efeitos e ambiente | `src/audio/sfx.ts`, `ambience.ts` | **Provisórios** sintetizados |
| Arquivos de áudio licenciados | `public/assets/audio/music`, `public/assets/audio/sfx` | Vazio. Registre em `AUDIO_FILES` (`src/audio/engine.ts`) com a chave `music:<id>` ou `sfx:<nome>`; se o arquivo falhar, o jogo volta ao som sintetizado |

## Privacidade e opções dos responsáveis

Nome da criança e arte de aniversário ficam **desligados** por padrão e só aparecem se ativados em *Configurações → Para responsáveis*. Tudo é salvo apenas no navegador (`localStorage`: `shinichi-save`, `shinichi-audio`, `shinichi-family`, `shinichi-ui`).
