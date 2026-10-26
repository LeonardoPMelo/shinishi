# Reformulação — diagnóstico e plano

Este documento guia a reformulação do jogo. Ele é atualizado a cada etapa.

## 1. Diagnóstico do projeto atual

### O que funciona e será preservado
| Área | Situação | Decisão |
|---|---|---|
| Arquitetura de dados (`src/data/*`: missões, NPCs, objetos, desafios) | 20 missões completáveis, condições, ações, contadores, rotas de diálogo | **Preservar.** É a espinha dorsal do conteúdo. |
| Store e save (`zustand`, versão de save, nível e XP) | Estável, com migração de versão | **Preservar.** |
| Áudio (diretor musical com prioridades e crossfade, SFX com limite de taxa, volumes por categoria, autoplay respeitado) | Funciona; os sons são sintetizados e **provisórios** | **Preservar o sistema**; trocar os sons provisórios por arquivos licenciados via `AUDIO_FILES`. |
| Controlador físico (raycast de chão, coyote time, buffer de pulo, pulo duplo, degraus, plataformas, câmera anticolisão) | Bom e testado | **Preservar e refinar** (etapa 4). |
| Interface (HUD, diálogos, mochila, mapa, desafios, opções do responsável) | Funcional | **Preservar**; repaginar depois. |
| Cenário recente (telhados, texturas procedurais, grama, água, caminhos, árvores fofas, pós-processamento) | Muito melhor que antes | **Preservar** como base da área demonstrativa. |

### O que está abaixo do padrão desejado
1. **Shinichi (crítico).** O modelo atual é um boneco bípede feito de esferas empilhadas. Não tem pescoço, focinho, patas de gato nem anatomia felina, e não tem esqueleto: a animação só gira e escala peças. As referências 10 e 11, que são a direção oficial, mostram um **gato quadrúpede** de proporções naturais estilizadas, que senta, anda, corre e se agacha como gato. **Conclusão: o modelo deve ser substituído, não maquiado.**
2. **Aldeões.** Também são primitivas montadas. Ficam legíveis, mas longe do padrão de "filme de animação". Eles serão refeitos depois do Shinichi, usando o mesmo pipeline.
3. **Animação.** Não existe sistema de clipes, transições ou expressões; tudo é seno e escala no código.
4. **Materiais.** O toon de 3 faixas resolve o cenário, mas pelo e pele precisam de sombreamento suave (difuso suave, rim de pelo, sombra de contato), como na referência 11.
5. **Iluminação.** Hoje é luz de meio-dia constante. A referência 11 pede luz dourada, céu quente, sombras suaves e profundidade atmosférica.
6. **Escala do mundo.** A vila é plana e compacta. Faltam verticalidade (cachoeiras, encostas, templos no alto) e caminhos alternativos.

### Limitações técnicas reais
- O jogo roda no navegador (WebGL). Qualidade de "filme" em tempo real depende de **assets autorais** (modelos esculpidos, rigs, texturas) e não de código de primitivas. Por isso o ponto central desta reformulação é criar um **pipeline de assets**.
- Pelo de verdade, com fios simulados, é caro demais para o navegador. A solução é pelo **sugerido**: silhueta com tufos, sombreamento suave, rim light e textura de pelagem pintada.
- Unity foi avaliado e descartado. Ele usa C#, exige conta, obrigaria a reescrever todo o conteúdo e tiraria o jogo do navegador.

## 2. Direção de arte (identidade própria)
- **Estilo:** animação 3D estilizada, com formas macias e arredondadas, silhuetas claras, olhos grandes e brilhantes e luz quente. Original: nada de símbolos de outras obras. O emblema da faixa é uma **pata**, não a folha de outra série.
- **Shinichi:** gato tuxedo **quadrúpede**, com cabeça grande em relação ao corpo (cerca de 1/3 da altura), focinho branco, "boné" preto no topo da cabeça com uma mancha branca descendo pela testa, orelhas pretas com interior rosa, olhos verdes grandes, cauda preta longa, manchas pretas nas costas e no quadril, patas brancas. Usa faixa ninja escura com placa de pata e duas pontas soltas, gola escura com placa, faixas pretas nos punhos e bolsa marrom com alça cruzada.
- **Paleta:** creme-branco `#F4EFE6`, preto-azulado `#24212B`, rosa `#F2A7B0`, verde-olho `#5CC65A`, couro `#8A5A34`, metal `#B9BEC8`.
- **Luz-alvo:** fim de tarde dourado como luz principal, preenchimento azulado no lado da sombra, rim quente nas bordas do pelo e névoa atmosférica no fundo.

## 3. Princípios de cada especialidade (convertidos em requisitos)
| Especialidade | Requisito verificável |
|---|---|
| Direção de jogo | Cada área tem um "momento" (vista, segredo, piada) e um objetivo visível. |
| Engenharia | Personagens são **arquivos GLB** com esqueleto e clipes nomeados (`idle`, `walk`, `run`, `jump`, `fall`, `land`, `sit`, `meow`) e shape keys de expressão (`happy`, `surprise`, `focus`, `shy`, `blink`). O código só referencia esses nomes. Um artista humano pode substituir o arquivo sem tocar no código. |
| Gameplay | Animação dirigida pela física, com transições suaves (crossfade de 0,15 a 0,25 s). Nenhum deslize: a cadência da caminhada acompanha a velocidade real. |
| Arte 3D | Malha contínua e suave, sem esferas visivelmente separadas. Ela deve ser validada com uma folha de giro (turnaround) renderizada e comparada à referência 10. |
| Level design | A área demonstrativa terá um caminho principal, um caminho alternativo por cima e um segredo. |
| Narrativa | Missões com começo, complicação, virada e consequência; humor felino. |
| Psicologia infantil (princípios de design, não diagnóstico) | Erro gera pista graduada, nunca humilhação. Há sempre uma segunda tentativa. Emoções nomeadas pelos personagens. A criança escolhe a ordem de exploração. |
| Pedagogia | Matemática e leitura aparecem como ferramenta para resolver algo da história (preço, medida, código, bilhete), com dificuldade crescente e pistas em 3 níveis. |
| Áudio | Miados com identidade (curto curioso, longo frustrado, trinado alegre), passos por superfície e música por área com crossfade. Os sons sintetizados seguem rotulados como provisórios. |
| QA | Testes extremos documentados: pulo junto à parede, borda, porta, área estreita, interação em movimento. |

## 4. Plano por etapas
| Etapa | Entrega verificável |
|---|---|
| 1. Análise e direção | Este documento. |
| 2. Novo Shinichi | GLB gerado por script no Blender (`tools/blender/`), com esqueleto, pesos, clipes e expressões; turnaround renderizado; integrado ao jogo com mixer de animação. |
| 3. Área demonstrativa | Praça e mercado reconstruídos com luz dourada, materiais suaves, verticalidade e um segredo. |
| 4. Movimento e câmera | Física ajustada ao novo corpo quadrúpede, testes extremos e animação sincronizada à velocidade. |
| 5. Interações e NPCs | Aldeões no novo padrão (mesmo pipeline), rotinas e reações animadas. |
| 6. Campanha e educação | Novas missões variadas e sistema de pistas em níveis. |
| 7. Áudio, VFX e animação | Identidade sonora do Shinichi, efeitos de técnicas, poeira, folhas e água. |
| 8. QA e publicação | Testes, otimização e build de produção. |

## 5. Pipeline de personagens (etapa 2)
- `tools/blender/build_shinichi.py` roda no Blender em modo headless e:
  1. modela o corpo com metaballs, converte para malha, suaviza e aplica remesh;
  2. pinta a pelagem por cor de vértice (padrão tuxedo);
  3. modela os acessórios (faixa com placa de pata, gola, punhos, bolsa e alça);
  4. cria o esqueleto (coluna, pescoço, cabeça, orelhas, mandíbula, 4 pernas, cauda em 5 ossos) e aplica pesos automáticos;
  5. cria os clipes de animação e as shape keys de expressão;
  6. exporta `public/assets/characters/shinichi.glb` e renderiza `docs/renders/shinichi_turnaround.png`.
- No jogo, `ShinichiModel` carrega o GLB, toca os clipes conforme o estado físico e mistura as expressões por eventos (descoberta, erro, vitória).
- **Substituição futura:** um artista pode entregar outro GLB com os mesmos nomes de ossos, clipes e shape keys, e ele entra no lugar sem mudança de código.

## 6. Etapa 2: estado atual (novo Shinichi)

**Implementado e funcionando no jogo**
- Gato **quadrúpede** com malha contínua e suave: metaballs, remesh voxel, suavização e decimação, cerca de 16,7 mil triângulos no corpo. Pelagem tuxedo pintada por cor de vértice: rosto branco com mancha descendo pela testa, topo e nuca pretos, manchas nas costas e no quadril, cauda preta.
- Olhos de anime verdes com íris em gradiente, pupila, dois brilhos e pálpebras. Também tem focinho, nariz rosa, boca "w", boca aberta, bigodes e orelhas com interior rosa.
- Acessórios que acompanham a superfície do corpo (raios lançados contra a malha): faixa com placa e emblema de **pata**, nó e duas pontas, gola com placa, faixas nos punhos, alça cruzada e bolsa com fivela.
- Esqueleto com 33 ossos: corpo, 4 pernas, cauda em 5 ossos, orelhas e pontas da faixa. Pesos automáticos em todos os 22 ossos de deformação.
- 8 clipes: `idle`, `walk`, `run`, `jump`, `fall`, `land`, `sit`, `meow`.
- No jogo (`src/game/entities/ShinichiCat.tsx`):
  - os clipes misturam conforme velocidade, chão e ar; pulo e aterrissagem tocam uma vez;
  - depois de 9 s parado, ele senta; o miado (Q) toca `meow` e abre a boca;
  - a velocidade do clipe acompanha a velocidade real;
  - piscar com piscada dupla ocasional e espasmo de orelha;
  - contorno de tinta que acompanha o esqueleto;
  - a cor da faixa segue o item vestido.
- **Expressões:** alegria, curiosidade, surpresa, vergonha, frustração, concentração, medo, orgulho e entusiasmo, combinando pálpebras, pupilas, boca, orelhas, inclinação da cabeça e cauda. Elas são disparadas por eventos reais:

  | Evento | Expressão |
  |---|---|
  | moeda ou item | alegria |
  | desafio certo | orgulho |
  | desafio errado | frustração |
  | missão iniciada | entusiasmo |
  | missão concluída ou subida de nível | orgulho |
  | segredo | surpresa |
  | diálogo | curiosidade |
  | queda no rio | surpresa |

  Em modo de desenvolvimento, `window.__shinichi.feel('joy')` testa cada uma.

**Como regenerar o modelo**
```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python tools/blender/build_shinichi.py -- --stage full
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python tools/blender/build_shinichi.py -- --stage model --engine cycles
python tools/blender/contact_sheet.py shinichi_turn 4
```
- `--stage model` só modela e renderiza prévias.
- `--engine cycles` usa materiais reais (mais lento). O EEVEE não funciona nesta GPU integrada.
- As renderizações ficam em `docs/renders/`. O GLB fica em `public/assets/characters/shinichi.glb`.

**Limitações honestas**
- O modelo é gerado por código e ainda é um **provisório bem construído**, não uma escultura de artista. Faltam pelo texturizado (fios, tufos nas bochechas e no peito), sobrancelhas e formas faciais esculpidas (shape keys) para expressões mais ricas.
- As expressões são sutis à distância da câmera de jogo. Elas ganham força quando houver câmera de diálogo com close.
- As animações são procedurais e "assadas". Funcionam, mas não têm o refinamento de um animador (arcos, overlap, poses-chave).
- Com a velocidade atual do controle (5 m/s caminhando), ele quase sempre galopa. A recalibração de velocidades fica para a etapa 4.
- O exportador do Blender avisa "Mesh body is not valid", mas a malha carrega e deforma corretamente. A investigação fica pendente.

**Estratégia de substituição por um modelo de artista**
Entregar um GLB com os mesmos nomes de ossos, clipes, nós de rosto e materiais da seção 5, e colocá-lo em `public/assets/characters/shinichi.glb`. O código não muda. Se o artista usar shape keys em vez de nós de escala para o rosto, basta adaptar a camada de expressão em `ShinichiCat.tsx` (um único ponto).

## 7. Plano consolidado (após as referências 13 a 19)

**Decisões (recomendações confirmadas pelo usuário em 2026-10-20)**
1. Shinichi é **quadrúpede** na exploração e fica em pé só na comemoração (`victory`). As folhas em pose T (16 e 17) servem como referência de acessórios, não de anatomia.
2. A estrutura atual é mantida (React, R3F, física, missões, save, áudio). Do descritivo entram: gerenciador de GLB com **fallback procedural**, HUD azul-escuro com dourado, habilidades nas teclas 1 a 4 (shuriken em alvos, impulso, poção, visão de rastros), gemas, etiquetas `[E]` e "O Mistério dos 48 Peixes" com divisão 48 ÷ 8.
3. Elenco canônico das folhas 14, 18 e 19:
   - **Mestre Lótus:** sábio idoso, chapéu de palha, quimono e cajado.
   - **Kiko:** inventor laranja de óculos.
   - **Sora:** comerciante tricolor de quimono.
   - **Taro:** rival cinza-escuro de faixa vermelha.
   - **Luna:** curandeira de lilás.
   - **Boku:** comerciante robusto de mochila.
   - **Hana:** cozinheira atrapalhada.
   - **Antagonistas:** General Hissui, Ninja Sombrio, Raposa Ninja e Porco-espinho bandido.

   Os papéis atuais são redistribuídos, mantendo diálogos e missões.
4. Confronto **sem violência**: shuriken acerta alvos e mecanismos; inimigos são vencidos em duelos de agilidade e enigmas, fogem envergonhados ou viram aliados.
5. Emblema de **pata** (nada de símbolos de outras obras).
6. Cerejeiras **fofas**.

**Etapas (cada uma só fecha depois de validada visual e funcionalmente)**
| Etapa | Entrega |
|---|---|
| 2b | Shinichi no nível da ref. 13: proporções, pelo em camadas, olhos e boca com shape keys, patas com almofadas, acessórios maiores, novas animações (`crouch`, `attack`, `victory`) e 9 ou mais expressões. |
| 3 | Gerenciador de assets com fallback, luz de entardecer e área demonstrativa (praça e mercado) com GLBs gerados: casa, ponte vermelha, torii com estátua, mercado, moinho, torre de vigia, lanternas, baú, alavanca. |
| 4 | Física e movimento recalibrados para o quadrúpede (velocidades, passada sem deslizar, câmera) e habilidades 1 a 4. |
| 5 | Elenco novo em GLB (bípedes com roupa) e "48 Peixes" no roteiro novo. |
| 6 | Campanha, gemas, HUD novo, progressão educativa. |
| 7 | Áudio, VFX e polimento de animações. |
| 8 | Revisão completa de código, bugs, desempenho e build. |

## 8. Etapa 2b: Shinichi no padrão da referência 13 (estado em 2026-10-20)

**Modelo (Blender por script; `tools/blender/anatomy.py`, `build_shinichi.py`, `build_rig.py`)**
- Proporções de filhote: cabeça grande e redonda, bochechas cheias, corpo compacto, pernas curtas e patas grandes com **almofadinhas rosa** (5 por pata). Pelagem tuxedo: área dos olhos branca, preto no topo, nuca, orelhas, "sela" nas costas e cauda.
- Olhos grandes com íris em gradiente, pupila redonda, dois brilhos e delineado.
- **Pálpebras com shape keys** (superior e inferior): `blink`, `angry`, `sad`, `happy` (fecha em "^"), `sleepy`.
- **Boca com shape keys**: `smile`, `open` (com presinhas), `oh`, `frown`, `angry`. A boca em repouso é o "ω" de gato.
- Acessórios: faixa larga com placa de metal, emblema de **pata** e parafusos, nó e pontas longas (3 ossos cada, esvoaçam com a velocidade); lenço no pescoço com placa; faixas duplas nas 4 patas; bolsa de couro com aba, duas fivelas e pata gravada, e alça cruzada no peito.
- 11 clipes: `idle`, `walk`, `run`, `jump`, `fall`, `land`, `sit`, `meow`, `crouch` (espreita), `attack` (lançar shuriken), `victory` (em pé com a pata erguida, como "Comemorando").

**No jogo (`ShinichiCat.tsx`)**
- **Pelo em camadas**: shells que seguem o esqueleto, com fios gerados por ruído 3D, penteados para trás. São 10 camadas na qualidade Alta, 5 na Média e nenhuma na Baixa. Custo medido dentro do ruído de medição.
- 14 expressões, combinando pálpebras, boca, pupilas, orelhas, cabeça e cauda: neutro, alegria, curioso, surpreso, tímido, frustrado, concentrado, medo, orgulho, entusiasmo, bravo, triste, engraçado (piscadela) e sonolento.
- Eventos:

  | Evento | Reação |
  |---|---|
  | moeda ou item | alegria |
  | desafio certo | orgulho |
  | desafio errado | frustração |
  | missão iniciada | entusiasmo |
  | missão concluída ou subida de nível | `victory` + alegria |
  | habilidade | `attack` |
  | miado | `meow` |
  | queda no rio | surpresa |

**Validação**: renderizações em `docs/renders/` (`shinichi_model_*`, `expr_*`, `pose_*`); retratos no jogo de 14 expressões, 4 ângulos, andar, correr, pular, atacar, vitória e agachar; NPC interage normalmente; build passa.

**Modelos recebidos (`pacote_modelos_3d_shinichi_glb.zip`)**: avaliados e **não usados**. São modelos de primitivas (Shinichi com 3,6 mil triângulos, preto, sem esqueleto; baú de 3 caixas), abaixo do que o jogo já tem. O gerenciador de assets da etapa 3 aceitará GLBs melhores com esses nomes.

**Limitações**
- Ainda é um modelo procedural. Com um escultor humano, rosto e pelo teriam mais acabamento.
- A velocidade de caminhada do controle (5 m/s) faz o galope dominar; isso será recalibrado na etapa 4.
- A pata erguida da vitória fica na altura do ombro, não acima da cabeça.

## 9. Etapa 3: gerenciador de assets, entardecer e área demonstrativa (2026-10-20)

**Gerenciador de assets com fallback** (`src/game/assets/catalog.ts`, `AssetModel.tsx`)
- Catálogo com os 40 nomes do descritivo (personagens, ambiente, props). Os arquivos vão em `public/assets/models/<pasta>/<nome>.glb`; o guia de nomes está em `public/assets/models/LEIA-ME.md`.
- `<Asset name fallback>` lê os 4 primeiros bytes e confere a assinatura "glTF". Servidores devolvem index.html para arquivos inexistentes, então só checar o status não basta.
- Com o GLB presente: o modelo é carregado, convertido para o material toon do jogo, escalado para a área do objeto e recebe colisão (trimesh ou hull, conforme o catálogo). Sem o GLB: entra a versão procedural.
- Já ligado a casas, barracas do mercado, cerejeiras, torii e ponte vermelha.
- **Testado** com um GLB real: as 7 cerejeiras foram trocadas nas posições certas. O arquivo de teste foi removido depois. `window.__assets()` mostra o que existe (modo dev).

**Entardecer** (`src/game/timeOfDay.ts`)
- Céu de azul-violeta a pêssego e dourado, nuvens rosadas e brilho do sol a oeste.
- Sol baixo e alaranjado, com sombras longas; névoa dourada.
- Luz do céu quente e preenchimento azul.
- Tom âmbar no pós-processamento.
- Opção **Horário da vila** (Entardecer ou Dia) em Ajustes, salva no navegador.
- Luz real saindo das lanternas (3 luzes pontuais, só na qualidade Alta ao entardecer). Custo medido igual ao modo Dia.
- **Bug corrigido:** a curva de contraste do pós-processamento ficava negativa em cores HDR acima de 1,5 e deixava pontos muito brilhantes **verde-neon**. Agora a cor é limitada antes da curva.

**Mercado** (`src/game/world/Market.tsx`)
- Barracas com toldo listrado caído e franja recortada, placas pintadas ("Peixes Frescos", "Frutas da Vila"), lanternas de papel com patinhas acesas, peixes no gelo, cestos de frutas, prateleira, barril, caixote e rolo de corda.
- Carrinho de peixes com rodas raiadas e caixas de peixe no gelo.
- Varal com 8 lanternas sobre a rua do mercado.

**Segredo**
- Escadinha de caixotes (0,6 m e 1,2 m) leva ao toldo da barraca de frutas, onde há um baú com brilho dourado (30 moedas, 15 de XP, evento de segredo).
- Testado com teclas reais (W + Espaço):
  - pulando no tempo médio ou tardio, ele chega ao topo; pulando cedo, cai e tenta de novo (ou usa o pulo duplo);
  - o toldo é plano para ele não escorregar (a primeira versão inclinada o fazia deslizar até a borda);
  - o baú abre e entrega a recompensa.

**Limitações**
- Não há modelos de artista ainda; tudo o que se vê é a versão procedural.
- A praça ganhou luz e vida pela iluminação, mas o varal de lanternas ficou na rua do mercado. As lanternas da praça continuam ligadas à missão do festival, para não estragar a recompensa dela.

## 10. Etapa 4: movimento, câmera e habilidades (2026-10-20)

**Movimento do quadrúpede** (`src/game/entities/Shinichi.tsx`)
- Velocidades recalibradas para o gato de ~1,3 m: **andar 4,2 m/s, correr 7,2 m/s** (antes 5 e 9; as patas deslizavam). Medidas exatas no corpo físico.
- Giro em direção ao movimento independente da taxa de quadros (antes dependia do FPS).
- Peso: o corpo inclina nas curvas em velocidade e abaixa a cabeça no impulso.
- Corpo recentralizado no colisor (deslocado 11 cm para trás), para o focinho não entrar nas paredes.
- **Bug corrigido: "gato suspenso na quina".** A cápsula podia ficar apoiada na quina de um balcão ou caixote enquanto o raio central não via chão, e ele travava no ar na pose de queda. Agora, depois de 0,15 s nessa situação, o jogo sonda os lados e o escorrega para fora. Pousos legítimos não mudam, e a rota dos caixotes até o toldo ficou mais tolerante (6 de 6 tempos de pulo chegam lá; antes, o pulo cedo falhava).

**Câmera** (`ThirdPersonCamera.tsx`, `materials.tsx`)
- Pivô mais baixo, adequado ao gato.
- Recentralização suave atrás do Shinichi quando ninguém mexe na câmera por 1,6 s. Ela não gira se ele corre em direção à câmera.
- **Folhagem transparente:** copas entre a câmera e o gato se dissolvem com pontilhado. As copas não têm colisão, então antes tapavam o personagem.

**Habilidades (teclas 1 a 4; Q e R continuam como atalhos de Faro e Miado; botões de toque incluídos)**

| Tecla | Habilidade | Detalhes |
|---|---|---|
| 1 | **Shuriken de treino** (`systems/shuriken.ts`, `world/Shurikens.tsx`) | Mira assistida de 32° em direção a alvos. Atravessa moradores e objetos leves (sem violência) e crava na parede por 2 s. |
| 2 | **Impulso Ninja** | 13 m/s por 0,2 s (cerca de 2,9 m), uma vez por salto no ar, recarga de 1,1 s. |
| 3 | **Poção de Energia** (item novo) | +30% de velocidade e +12% de pulo por 10 s, com aura de brilho. |
| 4 | **Faro** | Revela segredos e desenha uma **trilha de patinhas douradas flutuantes** até o objetivo da missão marcada (ou da primeira ativa). |

**Alvo dos Números** (`world/TargetRange.tsx`, ao lado do dojô)
- Placar com uma conta e três alvos numerados: 6 × 7, depois 48 ÷ 8, depois 9 + 15.
- Acertar a resposta com a shuriken avança a rodada.
- Errar **não pune**: aparece uma dica que explica o raciocínio (por exemplo, "6 × 7 é 6 grupos de 7…").
- Recompensa: 20 moedas, 20 de XP e 2 Poções de Energia. O baú do toldo também dá 1 poção.

**Testes executados** (teclas reais, física real)

| Teste | Resultado |
|---|---|
| Impulso contra o chafariz | ✅ parou a 1,83 m do centro, sem atravessar |
| Impulso contra a barraca | ✅ parou no balcão |
| Pulo colado no balcão (3 posições) | ✅ termina no chão, sem ficar suspenso |
| Interagir correndo | ✅ o diálogo abre e ele para |
| Alvo dos Números | ✅ erro não avança; 3 acertos dão recompensa e 2 poções |
| Poção | ✅ consumida (2 → 1) |
| Trilha do Faro | ✅ 16 a 18 patinhas até o Chef Tofu |
| Folhagem | ✅ a copa se dissolve sobre o gato |

- O build passa e o console fica sem erros.
- **Problema encontrado e corrigido no caminho:** a lanterna de pedra bloqueava a linha de tiro do alvo da esquerda e a cerejeira escondia o terceiro alvo. A fileira e a árvore foram reposicionadas.

**Limitações**
- O contorno escuro das copas não se dissolve junto, e restam pontinhos escuros onde a folhagem some.
- Os sons novos (shuriken, impulso, alvo, poção) são sintetizados e provisórios, como os demais.
- A habilidade de agachar (clipe `crouch`) ainda não tem tecla.

## 11. Etapa 5: novo elenco e moradores (2026-10-20)

**Gerador de moradores no Blender** (`tools/blender/build_villager.py`)
- Um único script gera os 7 personagens a partir da tabela `CAST` (pelagem, olhos, orelhas, largura, roupa e acessórios).
- Reaproveita o rosto do Shinichi v2: olhos com pálpebras, formas da boca e o mesmo material toon.
- Corpo bípede com dois tipos de roupa:
  - **quimono:** gola em V, obi, avental, mangas largas;
  - **gi:** com calça.
- Acessórios:
  - chapéu de palha, barba, sobrancelhas e cajado (Lótus);
  - óculos de aviador e bolsa de ferramentas (Kiko);
  - lenço e bolsa (Sora);
  - faixa vermelha (Taro);
  - cajado com gema e flor no cabelo (Luna);
  - mochila grande (Boku);
  - chapéu de chef e avental (Hana).
- Esqueleto e 5 animações: `idle`, `walk`, `talk`, `wave` e `cheer`.
  - Os pesos da roupa são feitos à mão: o quimono acompanha o tronco e as mangas acompanham os braços.
  - Antes, com pesos automáticos, o quimono esticava como uma capa quando os braços subiam.
- Saída: `public/assets/models/characters/<nome>.glb`. Os retratos de conferência ficam em `docs/renders/vpose_*`.

**No jogo** (`entities/VillagerModel.tsx`, `entities/NPC.tsx`)
- Cada NPC com modelo no elenco usa o GLB; os outros continuam com o boneco procedural (`Critter`). O boneco também aparece enquanto o modelo carrega ou se o arquivo faltar.
- Os papéis foram redistribuídos sem mudar ids, missões nem progresso salvo:
  - `chef_tofu` → **Hana**
  - `kenzo` → **Boku**
  - `mei` e `mei_floresta` → **Luna**
  - `lotus` → **Mestre Lótus**
  - **Kiko**, **Sora** e **Taro** continuam com seus papéis
- O humor do morador controla a animação, com transição suave:
  - anda na patrulha (suportado, mas hoje nenhum personagem do elenco patrulha, então não foi testado);
  - acena quando o Shinichi chega perto;
  - fala e mexe a boca durante o diálogo;
  - comemora quando o Shinichi mia;
  - pisca sozinho.
- Os moradores começam as animações em pontos diferentes, para não se moverem em sincronia.

**Textos**
- Nomes e concordância de gênero atualizados em todos os diálogos, missões, desafios, itens, placas, HUD e painéis:
  - "a Chef Hana";
  - "o Mestre Lótus", "levemente impressionado".
- Boku deixou de ser cachorro: voz de miado grave.
- Luna ganhou o papel de curandeira tímida.
- No diálogo, a cor e a voz de cada personagem foram ajustadas (Hana mais aguda, Lótus mais grave).
- As cores do boneco reserva acompanham os novos visuais (Taro cinza-escuro, Kiko laranja).

**Desempenho**
- Os GLBs dos moradores foram comprimidos com meshopt (`npx @gltf-transform/cli meshopt`): de 1,5 MB para cerca de 0,36 MB cada, ou seja, de 10,4 MB para 2,5 MB no total.
- O decodificador já vem com o drei, sem CDN.
- **O `shinichi.glb` ficou sem compressão:** a quantização deformou a faixa da cabeça (uma peça rígida ficou gigante). É preciso investigar antes de comprimir.
- Ao regenerar um morador no Blender, rode o meshopt de novo.

**Testes executados no jogo**

| Teste | Resultado |
|---|---|
| 7 modelos carregados nas posições certas | ✅ |
| Retratos de Hana, Boku, Luna, Lótus, Kiko, Sora e Taro | ✅ escala coerente com o Shinichi, contorno e toon iguais |
| Aceno ao se aproximar | ✅ Boku, Luna, Lótus |
| Diálogo com a Sora | ✅ animação `talk` e boca mexendo |
| Miado (R) perto da Sora | ✅ comemora, com olhos felizes |
| Marcador "!" da missão | ✅ na altura certa, acima do chapéu do Lótus |
| Missão "peixes": Hana → Boku | ✅ falas novas ("vi a Chef contar… Ela disse"), etapas `talk_tofu` e `talk_kenzo` registradas |
| Modelos comprimidos | ✅ idênticos aos originais |
| Build e console | ✅ sem erros; save de teste apagado com `resetGame()` |

**Limitações**
- Os antagonistas ainda não têm modelos: General Hissui, ninja sombrio, raposa e porco-espinho estão no catálogo, mas sem modelo.
- Mestre Kuma, Guarda Roku, Dona Neko, Tanuki, Kuro e as crianças continuam com o boneco procedural.
- No entardecer, a pelagem marrom do Boku parece alaranjada.
- Os moradores não desviam do Shinichi na patrulha; isso já era assim antes.


## 12. Etapa 6: campanha, gemas, HUD novo e progressão educativa (2026-10-20)

**Gemas do Saber** (`data/skills.ts`, `store/gameStore.ts`)
- Moeda nova, separada das Moedas de Pata, que se ganha **aprendendo**.
- Fontes de gemas:
  - cada desafio resolvido pela primeira vez dá 15 XP, 5 moedas e 1 gema, ou 2 gemas se for **de primeira**;
  - missões principais e educativas dão de 1 a 3 gemas (por exemplo, os 48 Peixes dão 3);
  - a cada 5 acertos no treino livre, 1 gema.
- A recompensa de um desafio é paga uma única vez (lista `solved`). Repetir o desafio só conta como treino.

**Progressão educativa**
- Cada desafio pertence a uma habilidade: adição, subtração, multiplicação, divisão, padrões, lógica ou leitura.
- O jogo guarda, por habilidade, os acertos, os acertos de primeira e os erros.
- Estrelas (0 a 3): cada acerto vale 1 ponto e acertar de primeira vale mais 1. **Errar nunca tira estrelas**.
- **Treino livre no Alvo dos Números** (`systems/practice.ts`):
  - começa depois das 3 rodadas da história;
  - as contas são geradas e puxam para a habilidade menos treinada (com variação e sem repetir a mesma 3 vezes);
  - o tamanho dos números cresce com as estrelas da habilidade (tabuadas fáceis primeiro);
  - os distratores imitam deslizes reais: errar por um grupo, por 1 ou por 10;
  - o erro mostra uma dica de raciocínio.
- **Teclado numérico na tela** nos desafios, que funciona com mouse, toque e teclado. No toque, não abre o teclado do sistema.
- A tela de acerto mostra as recompensas, a habilidade treinada e o aviso "de primeira!".

**Campanha e Jornada** (painel novo: botão 📖 ou tecla K)
- As missões agora têm capítulo (`chapter`), e os títulos ficam em `data/campaign.ts`.
- **Campanha:** cada capítulo tem uma barra de progresso. As missões ainda não descobertas aparecem como "???".
- **Saberes:** cartões com estrelas e uma barra até a próxima estrela, mais uma sugestão do que treinar e onde.
- **O Mistério dos 48 Peixes**, como no descritivo:
  - etapa nova: investigar o estoque ao lado da cantina (6 caixotes com etiqueta "8 peixes");
  - a investigação abre o desafio 6 × 8 = 48;
  - aparece a pista do pelo listrado;
  - depois vem a divisão 48 ÷ 8 com a Chef Hana;
  - no final, fogos de artifício.

**HUD novo** (azul-escuro translúcido com detalhes dourados)
- Topo esquerdo: avatar com aro dourado, nível e graduação, barra de XP dourada.
- Topo direito:
  - moedas e **gemas**;
  - botões Mochila, Missões, **Jornada**, Mapa, Ajustes e Som;
  - abaixo deles, o painel **"Missões da Vila"** em forma de lista de tarefas (etapas feitas marcadas; as futuras ficam como "+ N etapas a descobrir").
- Rodapé: barra de controles (WASD, Shift, Espaço, E). Ela some em telas estreitas e no toque.
- **Etiqueta flutuante "[E] …"** sobre o morador ou objeto (drei `Html`). Ela acompanha quem anda e pode ser tocada. Substitui o botão fixo do rodapé.
- **Subiu de nível:** faixa grande na tela e espiral de brilhos dourados e azuis em volta do Shinichi, que faz a pose de vitória.
- Os avisos (toasts) seguem a mesma família visual.
- As janelas de leitura (diálogo, desafios, painéis) continuam em papel creme, de propósito: texto escuro sobre claro é mais fácil de ler.

**Save:** versão 4. A migração cria as gemas, o registro de aprendizado e os desafios resolvidos. Quem já tinha passado do enigma dos peixes ganha automaticamente a etapa nova dos caixotes.

**Testes executados no jogo**

| Teste | Resultado |
|---|---|
| HUD em 1280×800 e no celular (375×812) | ✅ sem sobreposição, depois de dois ajustes (a barra de controles colidia com as habilidades; no celular, as moedas cobriam o nível) |
| Etiqueta [E] | ✅ acima da Hana, dos caixotes e do Roku em patrulha |
| Missão 48 Peixes: caixotes → desafio no teclado da tela | ✅ o erro (42) mostra incentivo e o acerto (48) marca a etapa e a pista do pelo |
| Recompensa de desafio | ✅ +15 XP, +5 moedas e +1 gema; de primeira, +2 gemas |
| Fim da missão | ✅ cartão com "+3 gemas" e fogos disparados |
| Jornada (K) | ✅ capítulos 0/12 e 0/8, Saberes com a estrela de Multiplicação |
| Subiu de nível | ✅ faixa "Nv. 3 · Explorador", espiral e pose de vitória |
| Treino livre | ✅ 6 acertos com rodízio entre as 4 operações, gema no 5º acerto, erros registrados sem punição |
| Migração do save v3 → v4 | ✅ |
| Build e console | ✅ sem erros; save de teste apagado |

**Problemas encontrados e corrigidos no caminho**
- O cartão de recompensa de gema usava a classe `gem`, que também é a do ícone de losango, e encolhia. A classe foi renomeada.
- O atalho K não abria o painel: era o HMR desatualizado do App. Com a página recarregada, funcionou.

**Limitações**
- As gemas ainda não têm onde ser gastas. A proposta é uma lojinha de cosméticos (faixas e lanternas) com o Boku numa próxima etapa.
- A arte 2D antiga da comemoração e da pausa mostra uma plaquinha metálica na coleira que lembra o símbolo que combinamos evitar. Ela deve ser trocada na etapa 7 (polimento).
- A habilidade Leitura só é treinada na receita. Faltam desafios de leitura.
- Os fogos acontecem no céu da praça e foram confirmados pelo sistema de partículas. A câmera do gato não alcança o céu para uma foto.


## 13. Etapa 7: áudio, VFX e polimento de animações (2026-10-20)

**Arte da interface refeita com o Shinichi 3D**
- As 6 imagens 2D antigas foram substituídas: menu, pausa, comemoração, retrato do HUD e do diálogo, "pensando" dos desafios e "correndo" do carregamento.
- Motivos:
  - eram de outro desenho de personagem;
  - mostravam a plaquinha de folha na coleira, o símbolo que combinamos evitar;
  - o menu tinha rostos esculpidos como os da animação.
- As novas são **renderizadas pelo próprio jogo**, com os mesmos materiais (toon, pelo em camadas, contorno) e o emblema de pata:
  - **Recortes com fundo transparente:** vêm do **estúdio de retratos** (`?studio`, só em desenvolvimento: `src/game/Studio.tsx`). As poses e expressões são controladas pelo console (`__shinichi.pose('sit', 0.5, 'curious')`, `__studio.camera(...)`, `__studio.save('nome')`).
  - **Cenas na vila ao entardecer:** menu, pausa (Shinichi cochilando) e comemoração (pose de vitória com o torii) foram capturadas com uma câmera manual de desenvolvimento (`__camManual`, `__player.playerFacing.force`).
- As capturas vão para `tools/art-staging/` por um endpoint que só existe no servidor de desenvolvimento (`/__studio/save`, em `vite.config.ts`).
- O estúdio não entra no build de produção (verificado).
- As imagens antigas estão guardadas em `tools/art-archive/`, sem uso. A arte de aniversário (opcional, ativada pelos responsáveis) ficou como estava.

**Bugs encontrados pelo estúdio e corrigidos**
- **Cabeça girando sem parar:** o clipe `sit` (e outros) não anima a cabeça, as orelhas e a cauda, então a inclinação de emoção somava a cada quadro. Se o Shinichi ficasse sentado e "curioso", a cabeça dava voltas.
  - Correção: esses ossos voltam à pose de repouso antes do mixer, a cada quadro.
  - O mesmo cuidado foi aplicado ao olhar dos moradores.

**VFX**
- **Anéis de energia** (`game/systems/vfx.tsx`): um único instanced mesh com brilho aditivo. Aparecem em:
  - acerto no alvo;
  - shuriken na parede;
  - pouso forte;
  - impulso (o anel fica para trás, em pé);
  - coleta de patas, peixes e lanternas;
  - subida de nível (anel duplo dourado e azul).
- **Rastro da shuriken:** brilhos azulados que ficam no caminho.
- **Recompensas voando:** moedas e gemas saem do meio da tela, onde fica o Shinichi, e voam até o contador do HUD, que dá um "pulinho".

**Animação**
- **Moradores olham para o Shinichi:**
  - a cabeça vira primeiro (pescoço com 40% do giro, cabeça com 60%) e o corpo acompanha mais devagar;
  - a cabeça se inclina para baixo para olhar o gato, que é menor;
  - sozinhos, os moradores dão olhadas de lado de vez em quando.
- **Agachar (C ou Ctrl):**
  - anda devagar (1,9 m/s, medido) e **sem som de passos**;
  - usa o clipe `crouch` misturado com um pouco da caminhada, para as patas se moverem.
- **Ocioso:** depois de cerca de 24 s parado (já sentado e ronronando), os olhos começam a pesar (expressão "sono").

**Áudio**
- **Arquivos licenciados sem mexer no código:**
  - coloque o arquivo em `public/assets/audio/sfx/` ou `music/` com o nome do som;
  - rode `npm run audio:manifest`;
  - o jogo carrega o `manifest.json` e troca o som sintetizado pelo arquivo.
- A lista completa de nomes e as regras de licença estão em `public/assets/audio/LEIA-ME.md`.
- **Sons novos (provisórios):**
  - `gem`: arpejo de cristal, toca logo depois da moeda quando se ganha gema;
  - teclado numérico: já usa o clique de interface.
- As dicas de controle foram atualizadas no menu, na barra do HUD e nos Ajustes: 1-4, C, K.

**Testes executados**

| Teste | Resultado |
|---|---|
| Menu, pausa, desafio, comemoração, HUD | ✅ arte nova no lugar; pausa e comemoração ajustadas (zoom e corte) |
| Estúdio | ✅ poses idle, sit, run e victory e expressões; bug da cabeça corrigido e conferido |
| Anel no alvo | ✅ visível no acerto, com a shuriken cravada |
| Moedas e gemas voando | ✅ 3 ícones voando; os contadores foram para 5 moedas e 2 gemas |
| Moradores olhando | ✅ a Luna vira para o Shinichi, sem deformar o pescoço |
| Agachar | ✅ 1,9 m/s, 0 passos; ao soltar C volta a andar com passos |
| Áudio por arquivo | ✅ arquivo de teste nosso (WAV) → manifesto → `sfx:coin` mapeado → decodificado (0,25 s); depois removido |
| Build | ✅ sem o estúdio no pacote; console limpo após recarregar; save de teste apagado |

**Limitações**
- **Os sons e as músicas continuam sintetizados e provisórios.** O caminho para arquivos licenciados está pronto e testado, mas ainda não há arquivos. Não baixei sons da internet sem a sua aprovação.
- O agachar não tem botão nos controles de toque.
- Ao agachar, a cápsula física continua do mesmo tamanho: ainda não dá para passar por baixo de obstáculos.
- A pose de vitória isolada (sem cenário) não ficou boa como recorte, por isso a comemoração usa a cena na vila.
- O pelo em camadas aparece como pontilhado nos retratos grandes. É o mesmo visual do jogo, só que ampliado.


## 14. Etapa 8: revisão de código, bugs, desempenho e build (2026-10-21)

**Integridade dos dados** (`src/systems/validateData.ts`)
- Validador novo que roda sozinho em desenvolvimento (avisa no console) e também por `__validate()`.
- Ele cruza todas as referências:
  - missões, etapas, `after`, quem dá a missão;
  - alvos (NPC e objeto), itens, desafios, técnicas, capítulos e habilidades;
  - nós de diálogo e as condições e ações de cada opção.
- Também confere se **toda etapa tem um jeito de ser concluída** (ação `STEP`, contador ou código do mundo).
- Resultado: **0 problemas** em 20 missões, 11 desafios, 18 NPCs, 71 objetos, 127 diálogos e 296 ações.

**Campanha inteira simulada**
- Partindo de um save novo:
  - cada missão começa quando a condição da oferta do NPC é verdadeira;
  - cada etapa é concluída pela mesma ação de dados que o jogo usa.
- **20 de 20 missões concluídas, sem travamentos.**
- Estado final: nível 6 (Guardião), 18 insígnias, 459 moedas e 19 gemas. Os desafios rendem de 11 a 22 gemas a mais, que a simulação não conta.

**Revisão de código**
- O TypeScript agora acusa código e parâmetros sem uso (`noUnusedLocals` e `noUnusedParameters`). Nenhum arquivo órfão e nenhum `console.log`, TODO ou `debugger`.
- **Bug: pinça para zoom no celular.** A distância entre os dedos era medida, mas nunca usada. Agora a pinça aproxima e afasta, com os mesmos limites da roda do mouse.
- **Bug: botão de pulo no toque** podia ficar "preso" se o dedo escorregasse para fora. Agora ele solta também em `pointercancel` e `pointerleave`.
- **Bug no build de produção:** o `index.html` pré-carregava a arte antiga do menu, que não existe mais. Corrigido.
- **Agachar no toque:** botão novo 🐾, que liga e desliga (no celular um polegar já está no joystick). Medido: 1,9 m/s ligado e 4,2 m/s desligado.

**Desempenho**

Medido com `gl.finish()`, em 1024×768, na GPU integrada deste computador:
- **Gargalo encontrado:** os moradores custavam **6,2 de 20 ms** por quadro.
  - Malhas simplificadas com meshoptimizer: tronco e quimono −60%. As formas do rosto (piscar, sorrir) foram conferidas: continuam intactas.
  - Moradores fora da tela não são desenhados nem animados. Os distantes (mais de 16 m) animam em meio ritmo, e os de mais de 42 m somem.
  - Só peças maiores que cerca de 10 cm projetam sombra (antes eram 84 peças, incluindo olhos e botões).
  - Resultado: os moradores custam **cerca de 1 ms**. Triângulos −27%, e os GLBs dos moradores passaram de 10,4 MB para **1,7 MB**.
- **Quadro típico:** cerca de 11 ms em Baixa, 16 a 19 ms em Média e 20 a 23 ms em Alta. A variação entre sessões nesta máquina é de ±3 ms.
- O modo Automático já reduz a qualidade se o jogo ficar abaixo de 40 FPS.

**Build de produção** (`npm run build`, teste com `vite preview` na configuração "shinichi-producao")
- Nenhuma ferramenta de desenvolvimento vai para o pacote: estúdio, endpoint de captura, `__gameStore`, `__validate` e companhia.
- Testado no navegador:
  - o menu aparece com a arte nova;
  - "Começar aventura" funciona;
  - o andar com teclas reais funciona, com câmera e folhagem;
  - console limpo e servidor sem erros.
- Tamanho: o código tem 1,6 MB comprimido (gzip), sendo 0,8 MB do motor de física. Os modelos somam 3,1 MB.

**Limitações conhecidas (para o futuro)**
- Os sons e as músicas ainda são sintetizados. O caminho para arquivos licenciados está pronto (`public/assets/audio/LEIA-ME.md`).
- As gemas ainda não têm onde ser gastas (sugestão: uma lojinha de cosméticos do Boku).
- O contorno escuro das copas não some junto com as folhas, porque o shader de contorno do drei não tem o efeito de transparência.
- Ainda não há modelos 3D para os antagonistas nem para Kuma, Roku, Neko, Tanuki, Kuro e as crianças, que usam o boneco procedural.
- A habilidade Leitura tem só um desafio.

## 15. Resumo da reformulação (etapas 1 a 8)

| Etapa | Entrega principal |
|---|---|
| 1 | Diagnóstico e plano |
| 2 e 2b | Shinichi quadrúpede gerado no Blender: 11 animações, 14 expressões, pelo em camadas e emblema de pata |
| 3 | Gerenciador de assets com reserva procedural, entardecer e área do mercado |
| 4 | Movimento recalibrado, câmera e habilidades 1 a 4 (shuriken, impulso, poção, faro) e Alvo dos Números |
| 5 | Elenco novo em GLB (Lótus, Kiko, Sora, Taro, Luna, Boku, Hana), com papéis e textos redistribuídos |
| 6 | Gemas do Saber, progressão por habilidade, treino adaptativo, Jornada, HUD azul e dourado e 48 Peixes conforme o descritivo |
| 7 | Arte da interface renderizada pelo jogo, efeitos visuais, olhar dos moradores, agachar e áudio por arquivo |
| 8 | Validação de dados, campanha simulada, bugs, desempenho e build de produção |

## 16. Correções pedidas depois da entrega (2026-10-21)

- **A fonte da praça estava sem água.** O disco de água ficava em y = 0,49, mas o topo da bacia de pedra (um cilindro maciço) fica em y = 0,51, então a água estava escondida dentro da pedra. A água subiu para y = 0,56, logo abaixo da borda, junto com as ondinhas e o ponto onde caem os jatos das carpas.
- **Uma Pata Dourada estava alta demais.** Medimos as 8 patas (superfície embaixo de cada uma × alcance real do pulo). Só a da **Pedra Alta** era problema:
  - a pedra tinha 2,3 m (2,4 m visíveis);
  - o salto duplo chega a no máximo 2,8 m, e só quando dado exatamente no topo do primeiro pulo.
  - A pedra baixou para **1,8 m**:
    - o pulo simples (1,53 m) continua não alcançando, então ela segue como o teste do Salto Duplo do Mestre Lótus;
    - o salto duplo alcança dado no topo, cedo, bem cedo, tarde, de longe, de perto e encostado na pedra.
- **A Pata Dourada do canto da floresta não dava para pegar** (posição antiga [17.5, 0.5, 38.8]). Algo no canto mantinha o gato a cerca de 1 m dela, e o raio de coleta era de 0,95 m. Ela foi para [16.2, 0.5, 37.0], no gramado aberto atrás da Pedra Alta. O gato chega até ela vindo de qualquer direção.
- **Coletáveis mais fáceis de pegar** (patas, peixes, lanternas):
  - o raio de coleta passou de 0,95 m para 1,1 m;
  - a 1,8 m o item **voa até o gato**, mas só quando ele está em pé no mesmo nível do item;
  - pular de baixo não puxa a pata de cima da Pedra Alta. Testado: 3 pulos simples não pegaram, e o salto duplo pegou;
  - quando o gato se afasta, o item volta ao seu lugar.

## 17. Auditoria do "Prompt Mestre" (2026-10-21)

Legenda: [E] confirmado executando o jogo · [C] confirmado lendo o código · [P] depende de validação manual.

**Ferramentas novas de QA**
- `src/dev/qa.ts` (só em desenvolvimento, `__qa`): conduz o **controle real** pelo analógico, como o joystick de toque, e mede paredes, ponte, câmera e queda de FPS.
- `npm test` (Vitest + happy-dom), com **76 testes**:
  - todas as respostas recalculadas de forma independente;
  - o gerador de treino rodado 24 mil vezes;
  - recompensas e ajudas no store;
  - migração do save;
  - integridade dos dados;
  - campanha completa 20/20.
- Teste de mutação: uma resposta errada inserida de propósito (troco = 9) foi pega por 2 testes. [E]

**Resultados da auditoria**

| Área | Resultado |
|---|---|
| Inicialização, build, console | ✅ sem erros [E] |
| Paredes | ✅ 8 casas × 4 lados: o gato para 0,48 m antes da parede, sem atravessar nem prender [E] |
| Ponte | ✅ atravessa andando e correndo; os corrimãos seguram o gato; 0 quedas no rio [E] |
| Rio | ✅ cair volta ao último chão seco [C] |
| Limites do mundo e queda | ✅ redes de segurança [C] |
| Câmera junto a paredes | ✅ via o gato em 23 de 24 quadros [E] |
| Travada de 1,5 s (FPS baixo) | ✅ não atravessa o chão [E] |
| Dados, missões, save | ✅ 0 referências quebradas, 20/20 missões, migração ok [E] |
| Diálogos e painéis fecham com Esc | ✅ [C] |

**Problemas por prioridade**
- **P0:** nenhum encontrado.
- **P1 (pedagogia):**
  - as respostas não tinham testes automatizados → **corrigido**;
  - havia só uma dica, depois de 2 erros → **corrigido**: ajuda em 3 passos (observar → dica → exemplo parecido), botão "Pedir ajuda" que não conta como erro, e reconhecimento do esforço ao acertar.
- **P1 (currículo do 6º ano):** faltam frações, proporções, resto da divisão, ângulos, geometria e medidas. Hoje são 20 missões; a meta é 27.
- **P2 (visual):** 11 moradores (Kuma, Roku, Neko, Tanuki, Kuro, Mochi, Bigodes, crianças…) ainda usam o boneco procedural, inconsistente com o elenco em GLB.
- **P2 (mundo):** as regiões novas do briefing (Templo dos Enigmas, Lago, Montanhas…) ainda não existem, e as gemas ainda não têm onde ser gastas.
- **P2 (áudio):** os sons ainda são sintetizados (o caminho para arquivos licenciados está pronto).
- **P3:** o contorno das copas não some junto com as folhas; a câmera é bloqueada em 1 de 24 quadros entre as casas do oeste.

**Bugs achados e corrigidos nesta etapa**

| Bug | Correção |
|---|---|
| O "exemplo parecido" das tábuas dava o mesmo resultado (12) que o desafio | Exemplo trocado (5 × 3 = 15) [E, teste] |
| Pedir ajuda e depois errar não avançava o cartão | Cada erro agora abre o próximo cartão [E, teste de regressão] |
| Desafio alto cortava o topo da caixa sem dar para rolar | A caixa agora rola e o topo fica acessível [E] |
| O roteiro de QA errava a direção do analógico | Corrigido e validado nas 4 direções antes de usar [E] |

**Plano das próximas etapas** (ordem da seção 18 do briefing; cada uma fecha com testes e validação no navegador)
1. **Currículo do 6º ano em missões novas** (20 → 27): o Banquete dos Bigodes (divisão com resto), a Poção da Luna (proporções), a Máquina Desgovernada do Kiko (ângulos), o Festival (frações e medidas) e o Rival que Precisava de Ajuda (empatia). Aceite: respostas testadas, ajuda em 3 passos, estados e save testados, campanha simulada 27/27.
2. **Modelos dos 11 moradores restantes** no gerador do Blender (silhuetas e trajes próprios), mais NPCs novos (Liria, Kaito, Tsubaki). Aceite: retratos no estúdio e no jogo, custo de quadro medido.
3. **Templo dos Enigmas** como região navegável, com mecanismos 3D. Aceite: enigmas manipuláveis, testados ponta a ponta.
4. Lojinha para as gemas, áudio licenciado e polimento.

## 18. Capítulo 3: "Os Saberes da Vila" (6º ano) (2026-10-21)

Sete missões novas (a campanha passou de 20 para 27). Os dados ficam em `src/data/chapter3.ts` e os cenários 3D em `src/game/world/Chapter3Props.tsx`.

| Missão | Quem pede | Conteúdo | Interação 3D |
|---|---|---|---|
| O Banquete dos Bigodes | Bigodes | divisão com resto (50 ÷ 8 = 6, resto 2) | entregar as sobras à Dona Neko |
| A Poção da Luna | Mei | proporções (3:2 → 9:6 → 12:8) | colher 3 flores de camomila na floresta |
| A Máquina Desgovernada | Kiko | ângulos (30° → 45°, 3 cliques de 5°) | lançador com transferidor; o braço gira e o peixe voa até a cesta |
| As Fatias da Torta | Chef Tofu | frações (5/8; metade = 4/8) | torta de 8 fatias; um pano cobre a metade guardada |
| A Horta da Mochi | Mochi | perímetro 20 m e área 24 m² | canteiro 6 × 4 com grade de 1 m; a cerca e as 24 mudas aparecem |
| A Balança do Templo | Mestre Kuma | álgebra (3p + 4 = 19; 2n + 3 = 11) | balança com pedras e o peso "4"; as pedras ganham o rótulo "5" |
| O Rival que Precisava de Ajuda | Taro | empatia (escolhas no diálogo) | caminho de desculpas quando a provocação é escolhida |

Os 12 desafios novos têm ajuda em 3 passos (observar → dica → exemplo). Os testes recalculam cada resposta a partir dos números da história.

**Confirmado por execução**
- `npm test`: 121 testes passando, incluindo a campanha simulada 27/27.
- `tsc` sem erros.
- O build não leva código de desenvolvimento (`__qa`, `__validate`, `__studio`).
- No navegador:
  - A Máquina foi jogada do começo ao fim (aceitar, os dois desafios, o lançamento e a volta ao Kiko). A celebração mostrou o título "Engenheiro de Ângulos".
  - Os cenários aparecem conforme o passo da missão: a cerca e as mudas da horta, os rótulos da balança e o pano da torta.
  - Pegar uma flor soma 1 em `flores_luna` e põe a flor na mochila.

**Pendente** (não jogado de ponta a ponta no navegador; coberto só pela campanha simulada nos testes)
- As entregas para a Neko e o Roku.
- Os caminhos de diálogo do Taro.
- As outras seis missões jogadas com o teclado.

## 19. Elenco completo em 3D: moradores restantes e NPCs novos (2026-10-21)

Todos os 21 NPCs do jogo agora usam modelo próprio. Ninguém mais usa o boneco procedural, que continua só como reserva enquanto o arquivo carrega. São 11 modelos novos, gerados por `tools/blender/build_villager.py`.

| Personagem | Silhueta e corpo | Roupa e acessórios | Postura própria |
|---|---|---|---|
| Mestre Kuma | **urso**: orelhas redondas, focinho largo, cauda curta, barriga | manto açafrão com faixa de monge e contas | mãos atrás das costas, aceno calmo de cabeça |
| Guarda Roku | gato largo | armadura de lâminas, ombreiras, chapéu jingasa, lança de treino | em sentido, com uma "tremidinha" atrapalhada a cada ciclo |
| Dona Neko | redonda | pijama de bolinhas, touca com pompom, travesseiro | cochila em pé: cabeça cai e volta, pálpebras sonolentas no jogo |
| Tanuki | **tanuki**: máscara escura, orelhas redondas, cauda listrada | folha na cabeça, trouxa nas costas | mãos na barriga, batendo de leve |
| Kuro | gato preto | capuz fundo, lenço roxo | braços cruzados, ponta da cauda balançando |
| Vovó Mochi | curvada | xale de tricô, óculos redondos, bengala | costas curvadas; no jogo, olhos fechados sorrindo |
| Seu Bigodes | largo, rajado | bigodão, bandana torcida, avental, peixe na mão | peito estufado, punho na cintura |
| Pipo | filhote (cabeça 22% maior no jogo) | quimono curto, cata-vento | não para quieto: pulinhos |
| **Liria** (nova) | gato azul-acinzentado | lenço, óculos, avental com bolsos, prancheta | lê as anotações com a cabeça inclinada |
| **Kaito** (novo) | magro, pelagem de pontas escuras | cachecol longo, faixas nos braços, curativo no nariz | base atlética, joelhos dobrados |
| **Tsubaki** (nova) | tartaruga (escaminha) | blusa branca, hakama vermelha, camélia, naginata de madeira | ereta, punho na cintura |

**O que mudou no gerador**
- Suporte a espécies: orelhas redondas, focinho de urso, sem bigodes de gato, cauda curta ou peluda.
- Pelagens novas: máscara, anéis na cauda, pontas escuras e manchas livres.
- Roupas novas: hakama, faixa de monge, bolinhas, avental-babador com bolsos e mangas justas.
- Cerca de 25 acessórios novos.
- Posturas por personagem sobre as 5 animações (`idle`, `walk`, `talk`, `wave`, `cheer`):
  - na `idle`, os dois braços seguem a postura do personagem;
  - na `talk` e no aceno, só o braço esquerdo; o direito continua gesticulando.
- Retratos de conferência:
  - `docs/renders/vpose_<nome>_*.png`;
  - `docs/renders/elenco_novo_sheet.png`;
  - no estúdio do jogo, `docs/renders/estudio_elenco_novo_a.png` e `_b.png`.
- Novo modo do estúdio de desenvolvimento: `?studio=cast&only=a,b`.
- Os GLBs foram simplificados (40%) e comprimidos com meshopt: de cerca de 1,5 MB para **cerca de 250 KB** cada.

**NPCs novos, com função no jogo**
- **Liria** fica ao lado do Kiko. Durante "A Máquina Desgovernada", ela dá a dica de medir antes de girar e de quantos "5" cabem nos graus.
- **Kaito** fica perto da pedra alta. Ele ensina o tempo certo do salto duplo para pegar a Pata Dourada; sem a habilidade, manda o jogador ao Mestre Lótus.
- **Tsubaki** fica no templo. Durante "A Balança do Templo", ela dá a dica de tirar o mesmo peso dos dois lados.

**Confirmado por execução**
- `npm test`: **124 testes**. O novo `tests/cast.test.ts` verifica:
  - todo NPC tem modelo;
  - todo arquivo existe e tem menos de 400 KB;
  - as dicas dos NPCs novos apontam para missões e passos reais.
- `tsc` sem erros; build sem código de desenvolvimento; validador de dados sem erros (21 NPCs, 27 missões).
- Os 18 GLBs carregam no jogo (200 OK). As posições dos 3 NPCs novos estão livres de colisão.
- A conversa com o Kaito abre a rota certa para um save novo.

**Desempenho** (medição A/B/A com `gl.finish()`, vista da praça, 1024×768)
- Desenhar o elenco custa **cerca de 3,6 ms**: 15,2 ms com os moradores e 11,6 ms sem eles. Antes eram cerca de 1 ms, com 7 modelos.
  - Cada modelo tem cerca de 20 mil triângulos, como os antigos. O custo subiu porque há mais moradores em GLB na tela.
- Medida tomada: o contorno de tinta, que duplica corpo e roupa, é desligado nos moradores a mais de 14 m. Na vista da praça, 34 de 85 contornos ficam desligados.
- **Pendente:** o ganho dessa medida não foi medido de forma confiável. Na segunda sessão, os tempos variaram ±4 ms e a máquina estava cerca de 2× mais lenta. É preciso refazer a medição com o painel do navegador visível e estável.

**Limitações**
- As cores por vértice ficam um pouco manchadas nas bordas: a simplificação junta vértices de cores diferentes. A faixa do monge e o avental mostram "degraus".
- Na animação `cheer`, a gola das roupas levanta junto com os braços. Isso já acontecia no elenco anterior.
- As posturas foram conferidas nos retratos, não em uma animação jogada quadro a quadro.

## 20. Capítulo 4: O Templo dos Enigmas (2026-10-21)

É a primeira região nova do briefing. Fica num pátio murado de 26 × 18 m ao norte da vila. A entrada é um portão na cerca, à esquerda do pagode, e quem destranca é a Tsubaki, depois de "A Balança do Templo".

**Arquivos**
- `src/systems/temple.ts`: regras puras dos enigmas, testáveis.
- `src/data/temple.ts`: a missão `templo`, as placas de ajuda, o altar e o item.
- `src/game/world/TempleOfRiddles.tsx`: a região em 3D.

**Os três enigmas, jogados com o corpo e não em menus**

| Enigma | Conteúdo | Como se joga | Regra testada |
|---|---|---|---|
| Espelhos da Luz | ângulos (45°, 90°, 135°) | tecla E gira cada estátua 45°; o raio da lanterna é traçado em tempo real | das 64 combinações, só uma leva a luz ao cristal; em cada espelho da solução o raio vira 90° |
| Porta das Frações | frações equivalentes | o gato pisa em placas ½, ¼, ⅛ e ⅜, o disco de 8 fatias acende e a alavanca confere | 2 rodadas (¾ e ⅝), cada uma com mais de um jeito certo; passar ou faltar não abre |
| Gongos da Sequência | padrões numéricos | tecla E toca os gongos com os próximos números da tábua | 2, 5, 8, 11 → 14, 17 e 1, 2, 4, 8 → 16; tocar fora de ordem recomeça |

- Cada enigma tem uma placa com as 3 ajudas (👀 observar → 💡 dica → 📝 exemplo), sem entregar a resposta.
- Os erros dão uma explicação, sem castigo. Por exemplo: "O disco tem 6/8 acesos. A porta pede ⅝, que é 5/8: passou um pouco".
- Resolver um enigma registra a prática no painel Saberes, pela ação nova `SKILL:<habilidade>`.
- Com os três resolvidos, as portas do santuário se abrem e o altar guarda o Pergaminho dos Enigmas.
- A Tsubaki encerra a missão com o título "Mestre dos Enigmas".

**Confirmado por execução** (jogado no navegador com teclado, cliques e andando com o controle real, a partir de um save novo)
- Com o portão trancado, o gato para na passagem e aparece "Portão do templo (trancado)". A Tsubaki oferece a missão, e aceitar destranca o portão.
- O gato atravessa o portão andando. Os muros seguram nas três direções (oeste −12,3, leste 12,3, norte −36,3).
- **Espelhos:** uma tentativa errada, depois a solução. O raio chega ao cristal e a etapa é registrada.
- **Frações:** a rodada 1 com ½ + ¼; um erro de propósito na rodada 2; depois ½ + ⅛. A porta abre.
- **Gongos:** o 15 errado recomeça a sequência; depois 14, 17 e 16.
- O gato passa pelo vão entre os gongos, sobe no santuário e pega o pergaminho.
- A Tsubaki conclui a missão: celebração, +120 XP, +5 gemas e título. Geometria, Frações e Padrões ganham +1 cada.
- Testes:
  - `npm test`: **138 testes**, com o novo `tests/temple.test.ts` (16 testes);
  - a campanha simulada conclui as 28 missões;
  - mutação: uma resposta errada nos gongos é pega por 2 testes.
- `tsc` sem erros; build sem código de desenvolvimento.
- Custo da vista do templo: **644 chamadas de desenho e 902 mil triângulos**, contando sombras e contornos. Na mesma medição, a praça da vila dá 843 chamadas e 857 mil triângulos. O tempo de quadro não foi medido, porque o painel do navegador estava instável.

**Problemas encontrados e corrigidos durante o teste**
- O `StaticMerge` (que funde objetos estáticos) "congelava" portas, espelhos e o telhado do santuário. Agora as partes que se movem ficam marcadas como `dynamic`; muros, chão e decoração continuam fundidos.
- Os rótulos das interações guardavam o estado antigo ("portão fechado") e nenhuma interação aparecia. Agora leem sempre o estado atual.
- Os gongos formavam uma barreira e o gato ficava entalado: o arco foi alargado, com vãos de cerca de 1 m.
- O embalo ao parar na borda de uma placa a alternava duas vezes. A margem de saída passou de 0,7 m para 0,9 m.
- Dentro do santuário, a câmera ficava acima do telhado. Agora o telhado some enquanto o gato está lá dentro.

**Limitações**
- O estado de um enigma pela metade não fica salvo: ao recarregar o jogo, ele recomeça. Os enigmas resolvidos ficam salvos.
- O enigma dos espelhos aceita só uma solução. É de propósito, para ensinar o ângulo exato.
- Os retratos ficam em `docs/renders/templo_*.png`.

## 21. Lojinha de gemas, mapa do templo e áudio (2026-10-21)

**Sacola da Sora (loja de gemas)**: arquivos `src/data/shop.ts`, `buyOffer` no store e o painel `Shop` em `ui/Panels.tsx`.
- As gemas só se ganham jogando (desafios e missões). A loja não tem dinheiro real nem anúncios.
- **Onde:** na conversa do dia a dia, a Sora oferece "🎒 Ver os achados da Sora". A ação nova `SHOP` abre o painel.
- **Catálogo:**
  - 4 faixas cosméticas: Azul do Rio, Verde da Floresta, Rosa Sakura e Roxa do Templo, de 4 a 6 gemas. Cada uma é comprada uma vez só e vestida pela mochila (o sistema `veste_*` que já existia).
  - Poção de Energia: 1 por 2 gemas, ou um pacote de 3 por 5 gemas.
- **Toque educativo:** a "Pergunta da Sora" pede para comparar o preço por poção. A resposta mostra a conta (5 ÷ 3 ≈ 1,67 gemas por poção) e lembra que o pacote só vale a pena se você for usar as 3. A resposta conta como prática de Proporções no Saberes.
- **Proteções:** sem gemas suficientes, nada muda e a loja diz quantas faltam. O saldo nunca fica negativo. Uma faixa já comprada aparece como "✓ Já é sua".
- **Confirmado por execução no navegador:**
  - abri a loja pela conversa com a Sora;
  - comprei a faixa roxa e o pacote de 3 poções (12 → 1 gema);
  - a tentativa sem saldo mostrou "Faltam 4";
  - acertei a pergunta (Proporções +1);
  - vesti a faixa roxa pela mochila e ela aparece no Shinichi (`docs/renders/loja_faixa_roxa.png`).
- **Testes:** `tests/shop.test.ts`, com 6 testes.

**Mapa**
- O mapa e o minimapa agora chegam ao Templo dos Enigmas (`MAP_BOUNDS.minZ = −38`).
- O pátio aparece em pedra, com o portão em vermelho, o santuário e o rótulo. Conferido no painel do mapa.

**Áudio licenciado: pesquisa feita, download pendente de autorização**
- Fontes encontradas, todas **CC0** (domínio público, sem exigência de crédito):
  - Kenney: RPG Audio (passos e tecido), Interface Sounds, Impact Sounds e Music Jingles. São 4 arquivos zip, cerca de 3,7 MB.
  - OpenGameArt, para as músicas em loop:
    - "Hot Springs Town" (Kistol), para a vila;
    - "Tyhosiasian" (Tozan), para o menu;
    - "kawaii 8bit" (haruta), para as missões cômicas;
    - "Menu Music" (wipics), para os desafios.
    - São cerca de 8,2 MB.
- Nada foi baixado: os sons continuam sintetizados e marcados como provisórios. A troca acontece pelo fluxo de `public/assets/audio/LEIA-ME.md`, assim que os downloads forem aprovados.

**Validação final**
- `npm test`: 144 testes; `tsc` sem erros; build sem código de desenvolvimento.
- O save de teste foi apagado com `resetGame()`.

## 22. Áudio licenciado (2026-10-21)

Os downloads foram autorizados pelo usuário. Foram baixados 8 arquivos, todos **CC0**:
- 4 pacotes do Kenney: Impact Sounds, RPG Audio, Interface Sounds e Music Jingles;
- 4 faixas do OpenGameArt.

Os zips foram extraídos numa pasta isolada, fora do projeto. Só os arquivos escolhidos foram copiados para `public/assets/audio`. Origem e autor de cada arquivo estão em `public/assets/audio/CREDITOS.md`.

**Agora licenciados:**
- **25 efeitos:**
  - passos (grama, pedra, madeira) e aterrissagem;
  - pulo;
  - moeda, item, gema, argola e sininho;
  - baú, mecanismo e sino do templo;
  - alvo, pancadas, chute e "flop";
  - sons de interface e o "blip" do texto;
  - acerto, erro e "negado";
  - desejo (jingle).
- **4 músicas:**
  - vila: "Hot Springs Town" (Kistol);
  - menu: "Tyhosiasian" (Tozan);
  - missões cômicas: "kawaii 8bit" (haruta);
  - desafios: "Menu Music" (wipics).

**Continuam sintetizados (provisórios):** vozes, miado e ronronar, salto duplo, poção, splash, fogos, ambiente e as músicas de floresta, treino, investigação, emoção, festival e segredo.

**Como cada som foi escolhido sem ouvir**
- Não havia como ouvir os arquivos daqui. A escolha usou o nome, a descrição e **medições** feitas com `decodeAudioData` no navegador: duração, pico, volume médio (RMS) e frequência aproximada.
  - Exemplos: um clique curto e suave para o "blip" do texto, que toca o tempo todo; um sino longo para o templo.
- Os pacotes vêm muito mais altos que a mistura do jogo. Por isso cada arquivo tem um ganho em `src/audio/fileLevels.ts`:
  - **efeitos:** o RMS do arquivo é igualado ao RMS do som sintetizado que ele substitui (medido renderizando a receita offline), com o pico limitado a 1,25× o original;
  - **músicas:** o alvo é o nível da música sintetizada da vila (RMS 0,056).
- **Pendente:** ninguém ouviu o resultado ainda. Vale uma escuta e trocar o que não agradar (o caminho está no `LEIA-ME.md`).

**Confirmado por execução**
- No jogo, os arquivos carregam (200 OK) e substituem os sons sintetizados.
- Níveis medidos ao vivo:
  - músicas: menu 0,058 e vila 0,053 de RMS, para um alvo de 0,056;
  - picos dos efeitos próximos aos originais (exemplo: moeda 0,105 contra 0,107);
  - o "acerto" foi levemente reforçado.
- O build de produção (`vite preview`) carrega o manifest e a música, sem erros no console.
- `tests/audio.test.ts`, com 4 testes, verifica:
  - todo arquivo do manifest existe;
  - cada um substitui um som ou música que o jogo realmente usa;
  - cada um tem um nível medido;
  - cada um está citado nos créditos.
- No total: 148 testes, `tsc` sem erros e build sem código de desenvolvimento. O áudio ocupa 8,5 MB no pacote.

### 22.1 As 6 músicas que faltavam (2026-10-21, à tarde)

Os downloads foram autorizados pelo usuário: 6 faixas CC0 do OpenGameArt.

| Trilha | Faixa (autor) | Arquivo no jogo |
|---|---|---|
| floresta | Beautiful Forest [Orchestra] (nene) | `forest.ogg` |
| treino | Bamboo Blitz (Tsorthan Grove) | `training.webm` |
| investigação | Trouble in the Garden (HaelDB; licença dupla, usada sob CC0) | `investigation.ogg` |
| emoção | Snowfall, versão em loop (Kistol) | `emotional.ogg` |
| festival | Happy Loop (wipics) | `festival.mp3` |
| segredo | Shrine (yd) | `secret.ogg` |

- **Critério de escolha:** nada com clima de terror (tags como horror, creepy, dark), preferência por faixas que repetem sem corte, e um mistério engraçado para as investigações do detetive.
- **Bamboo Blitz:** só existia em FLAC de 24 bits (11,8 MB). Foi convertido no navegador para Opus a 160 kbps, via `MediaRecorder`, que roda em tempo real: ficou com **1,5 MB**. A duração é igual à do original (76,8 s).
  - **Limitação:** WebM com Opus não decodifica em navegadores Safari antigos. Nesses casos, o jogo volta automaticamente para a música sintetizada daquele trilho.
- **Loop sem emenda:** o tocador de música passou a ignorar o silêncio no começo e no fim de cada arquivo (`loopBounds` em `music.ts`, só quando o silêncio passa de 5 ms). Exemplos medidos: "investigation" começa em 0,158 s; "festival" termina em 19,64 s em vez de 20,87 s; o "menu" pula 0,466 s de silêncio inicial.
- **Volume:** o alvo continua sendo a música sintetizada da vila.
  - "investigation" e "secret" são naturalmente baixas; o ganho ficou limitado a 1, abaixo da vila, de propósito.
  - "emotional" ficou um pouco mais suave que o medido, porque toca embaixo de conversas tristes.

**Confirmado por execução:** no jogo, as 6 tocam a partir dos arquivos, com os pontos de loop acima; os 148 testes e o `tsc` passam; o build fica sem código de desenvolvimento. Agora **todas as 10 músicas** são licenciadas.

**Pendente:**
- uma escuta humana (ninguém ouviu as faixas);
- o build de produção não foi reaberto depois desta leva (a primeira leva foi conferida lá);
- o áudio subiu para **18 MB** no pacote: as maiores são `village.ogg` (4,4 MB) e `forest.ogg` (3,8 MB). Se pesar no celular, dá para reconverter para Opus.

## 23. Desempenho: o fim da "travada" e da luz que se apagava (2026-10-23)

**Relato do usuário:** depois de um tempo jogando, o jogo travava e a iluminação e as sombras eram desligadas. A captura enviada mostrava a vila chapada, sem sombras.

**Causa (confirmada por medição)**
- O modo "Automático" media o FPS a cada 3 s. Abaixo de 40 FPS, em duas janelas seguidas, ele descia um nível (Alta → Média → Baixa) e **nunca voltava a subir**.
- Na resolução da janela do usuário (1366×768, GPU integrada), a "Alta" custava **cerca de 40 ms por quadro (~24 FPS)**. Então, em poucos segundos, a qualidade caía.
- **A travada:** ligar ou desligar sombras recompila os shaders de todos os materiais. Um único quadro medido levou **167 ms**. Remontar a cadeia de pós-processamento e recriar a grama somavam mais engasgos.
- **A luz "apagada":** o nível "Baixa" desliga as sombras, o bloom e a gradação de cor (o tom quente e as sombras violetas). É exatamente a imagem chapada da captura.
- **Não era vazamento:** em 3 voltas pela vila, geometrias, texturas e programas de shader ficaram estáveis depois da primeira volta, e o heap ficou entre 259 e 269 MB.
- **Onde está o custo:** o JavaScript (lógica, física, animação) gasta só **1,7 ms** por quadro. O resto é GPU, e a GPU está limitada por quantidade de pixels.

**O que mudou**
- **O "Automático" nunca mais desliga luz, sombras ou gradação.** Ele percorre uma escada de 7 degraus (`AUTO_LADDER` em `uiSettings.ts`) e mexe só em coisas baratas de trocar:
  - bloom;
  - resolução interna (de 100% até 60%);
  - MSAA (4× → 2×);
  - tamanho do mapa de sombras (2048 → 1024);
  - frequência da sombra (60 → 30 Hz).
  - Nenhuma dessas trocas recompila shaders. Na escada inteira, o número de programas ficou fixo em 66 e o primeiro quadro após cada troca levou de 26 a 39 ms.
- **Ele também sobe:** desce depois de 2 janelas abaixo de 45 FPS e sobe depois de 3 janelas acima de 56 FPS. Uma subida que não se sustenta só é tentada de novo depois de 90 s, o que evita ficar oscilando. O degrau é lembrado entre sessões.
- **Antialiasing duplicado removido:** o canvas tinha MSAA na tela e a cadeia de pós-processamento tinha o seu próprio. Tirar o da tela levou a "Alta" de cerca de **40 para 27 ms**.
- **Sombra real só de quem está perto:** moradores a mais de 12 m deixam de projetar sombra (antes, cada um era animado e desenhado de novo no mapa de sombras). De longe fica a sombra-bolha que já existia.
- **Pré-compilação dos shaders** 1,5 s e 8 s depois de carregar, para o alvo de render que a cena usa de verdade. Entrar pela primeira vez no templo, na floresta, na oficina ou no rio não criou nenhum programa novo, e o primeiro quadro em cada lugar levou de 11 a 31 ms.
- O compositor de pós-processamento agora acompanha a resolução adaptativa; antes ele ignorava mudanças de escala.
- Nos Ajustes, "Automática" mostra a resolução em uso, por exemplo "(resolução 80%)".
- As qualidades manuais continuam iguais. Só a "Baixa", escolhida à mão, desliga sombras e pós-processamento.

**Medido** (vista da praça, 1366×768, nesta máquina; os tempos variam ±3 ms)

| Degrau | Resolução | ms por quadro |
|---|---|---|
| 0 (visual completo) | 100% | 27 |
| 2 | 90% | 24 |
| 4 | 72% (sombra a 30 Hz) | 21 |
| 5 | 66% | 18 |

Antes da mudança, a "Alta" custava cerca de 40 ms.

A comparação visual dos degraus 0, 4 e 6 está em `docs/renders/qualidade_automatica_niveis.png`. Nos três, as sombras e o tom de entardecer continuam.

**Testes:** o novo `tests/quality.test.ts` (5 testes) verifica que:
- nenhum degrau desliga sombras ou pós-processamento;
- cada degrau é igual ou mais leve que o anterior;
- o último degrau mantém antialiasing e pelo menos 60% de resolução;
- um nível antigo fora da escada cai no degrau válido mais próximo.

No total: 153 testes, `tsc` sem erros e build sem código de desenvolvimento.

**Limitações**
- As medições foram feitas com o painel do navegador oculto e forçando a GPU a terminar cada quadro. São comparações válidas entre si, mas o FPS absoluto no jogo normal tende a ser maior.
- A sessão longa de jogo real (vários minutos com a janela visível) foi substituída por uma simulação de 40 s. Nela, o controlador desceu degrau a degrau, sem oscilar e sem engasgos.
- Numa GPU fraca como a desta máquina, o "Automático" deve parar entre 66% e 72% de resolução. Quem preferir nitidez máxima pode escolher "Alta" nos Ajustes, aceitando menos FPS.

## 24. Direção de arte, etapa 1: o ambiente (2026-10-23)

**Pedido:** reformular a direção de arte rumo a um padrão profissional, inspirado em animação 3D cinematográfica, e revisar todas as missões.

**Auditoria** (capturas em 1366×768, qualidade máxima: `tools/art-staging/aud_*.png`). O que dava o aspecto amador:

| Área | Problema |
|---|---|
| Copas (cerejeira, pinheiro, arbustos) | esferas facetadas com contorno preto grosso, aspecto de plástico |
| Sombreamento | rampa de 3 faixas duras em todo o jogo, cara de recorte |
| Grama | tufos espetados e iguais, base muito escura: "estrelas" sobre o gramado |
| Chão sob as cerejeiras | disco rosa sólido, como um adesivo |
| Pedras da trilha | octógonos chatos, como fichas |
| Rio | 3 faixas de azul saturado, espuma pesada |
| Lanternas de pedra | blocos com um cubo amarelo brilhante |
| Cofre do Guarda Roku | cubo quase preto (material metálico PBR sem mapa de ambiente) |
| Canteiros da praça | "flores" que eram esferas soltas |

**Padrão adotado**
- Sombreamento suave e pintado: sombra e luz separadas, mas com transição macia, como em filmes animados.
- Vegetação sem contorno de tinta. O contorno fica para personagens e construções, onde ajuda a leitura.
- Volume por oclusão "assada" em cor por vértice (sem passada de oclusão em tempo real, que pesaria na GPU integrada).
- Nada de formas primitivas soltas: cada objeto tem uma silhueta reconhecível.
- Variação natural de cor e tamanho em tudo o que se repete.
- O desempenho não pode piorar.

**O que mudou**
- `materials.tsx`:
  - a rampa de tons passou de 3 faixas duras para uma curva suave de 64 tons;
  - `Toon` aceita `vertexColors`;
  - `Ink` aceita uma cor.
- `foliageGeometry.ts`: copas mais lisas, com oclusão por vértice (fendas e base mais escuras, topo mais claro, sombra levemente fria). Há dois níveis de detalhe: alto para árvores e baixo para arbustos instanciados e morros distantes.
- Árvores (cerejeira, pinheiro, árvore do mirante): sem contorno, com oclusão. O tapete de pétalas virou uma textura de pétalas espalhadas com borda que esmaece.
- Grama: 5 lâminas curvas e afinadas por tufo, base da cor do chão e manchas de tom entre seco e viçoso.
- Pedras da trilha: contorno irregular arredondado, topo abaulado e borda escura onde tocam a terra.
- Rio: degradê suave (raso turquesa → canal azul profundo), brilho de cáusticas no raso e espuma mais leve.
- Lanterna de pedra no formato *tōrō*: base sextavada, coluna, plataforma, caixa de luz com janelas de papel, telhado com aba e remate.
- Cofre do Roku: baú de madeira com cintas de ferro, pés, placa de latão, 3 discos de código e o emblema da pata.
- Canteiros: flores com caule, folhas, 5 pétalas e miolo.
- `StaticMerge`: ao fundir objetos, agora preserva a cor por vértice de quem a usa. Antes, a oclusão das copas se perderia.

**Antes e depois:** `docs/renders/arte_etapa1_praca.png`, `arte_etapa1_cantina.png` e `arte_etapa1_rio.png`.

**Desempenho** (cronômetro da GPU, `EXT_disjoint_timer_query`, na mesma sessão, vista da praça)
- Quadro completo: cerca de 26 ms, contra cerca de 27 ms antes desta etapa.
- Triângulos: 1,52 milhão, contra 1,47 milhão.
- A grama nova custa cerca de 1 ms; as copas, cerca de 3 ms.
- No meio do caminho, as copas em detalhe máximo chegaram a 2,1 milhões de triângulos. Por isso o detalhe foi reduzido e o contorno da vegetação saiu.

**Missões: revisão técnica e espacial das 28**
- Foi feito um cruzamento automático entre o alvo de cada etapa (para onde o rastreador e o mapa apontam) e o lugar onde a etapa realmente se conclui.
  - Resultado: nenhuma etapa aponta para o lugar errado.
  - As etapas sem alvo único são coletas, contadores e enigmas do templo, de propósito.
- Os textos foram conferidos contra as posições reais.
  - Corrigido: a horta "depois da casa do Kiko" passou a ser "no canteiro de terra perto do rio, ao lado da Sora" (fica a 4 m da Sora), na descrição, na etapa e na fala da Vovó Mochi.
  - Conferidos e coerentes: a cerejeira perto do templo, o estoque da cantina, o galpão velho, a lápide e o cofre perto da cantina, a escada e a luneta do Mirante, o lançador do Kiko e a balança do templo.
- Missões ralas, para a próxima etapa:
  - "A Coragem da Luna": duas conversas, nenhuma atividade no cenário;
  - "As Contas do Boku": duas conversas no mercado, sem usar a banca de frutas que está ali;
  - "A Sombra na Floresta": uma etapa só.

**Confirmado:** 153 testes, `tsc` sem erros e build sem código de desenvolvimento. O save de teste foi apagado.

**Próximas etapas propostas**
1. **Personagens**: Shinichi e os 18 moradores.
   - Cores mais limpas: a simplificação dos modelos deixou manchas.
   - Olhos e expressões mais vivos.
   - Roupas com dobras e tecido.
   - Animações próprias.
2. **Construções e objetos**:
   - paredes com madeira e reboco detalhados, telhados com telhas em relevo;
   - bandeirinhas de tecido, barris e caixotes melhores;
   - tatames e placas.
3. **Atmosfera**: céu e névoa de profundidade, raios de luz no entardecer, partículas (vaga-lumes, pétalas) e um fundo com mais camadas.
4. **Missões ralas**: atividades no cenário para as três missões acima, e uma revisão de diálogos e progressão de dificuldade.

## 25. Auditoria visual, correções e Bairro das Glicínias (2026-10-24)

Pedido: auditoria visual com 4 capturas do jogo (ruído gráfico, personagens ruins, cenário pequeno). Ciclo: diagnosticar → corrigir → expandir → refinar → validar.

### Problemas encontrados e corrigidos na origem
| Problema | Causa | Correção |
|---|---|---|
| Granulado nas copas (captura 2) | o "atravessar a copa" da câmera usava descarte com ruído (dither) por pixel, pior ainda com a resolução reduzida | transparência suave (`fadeAlpha` em `materials.tsx`) |
| Imagem borrada em qualidade automática baixa | o navegador ampliava a tela com filtro bilinear | escala interna do compositor + passe `UpscaleShader` com nitidez (CAS) |
| Câmera dentro dos telhados | o telhado não tinha colisor | colisor-sensor no telhado das casas; os raios do gato ignoram sensores |
| Roupas "manchadas" (Hana, Kiko, Kuma) | a simplificação de malha (gltf-transform `simplify 0.4`) afundava a roupa e o pelo do corpo atravessava o tecido | GLB completo só com `meshopt`, sem simplificar; cópia leve (`characters/lod/`) usada além de 11 m, **com a roupa sempre inteira**; a cópia leve é convertida para o espaço de quantização do modelo completo (`VillagerModel.lowToFull`) |
| Sebe do Jardim Secreto parecia um caixote pintado | caixa verde lisa | sebe de tufos sobrepostos nas duas faces e no topo |

Pipeline novo dos moradores: `tools/blender/compress_cast.sh <pasta com as exportações do Blender>`. Os originais sem compressão ficaram no rascunho da sessão; podem ser regerados com `build_villager.py`.

Custo medido (GPU, timer query, praça, nível automático 0): modelos completos sem LOD 36,6 ms / 1,77 M triângulos; com LOD 26,7 ms / 1,22 M (igual à linha de base anterior).

### Bairro das Glicínias (área nova, a leste)
- Acesso: portão na cerca leste da vila (z = 2), com caminho traçado sobre a grade de ocupação da física (nada em cima dele).
- Conteúdo: pracinha com hokora e bancos; túnel de glicínias sobre a rua; 5 casas (a casa de chá da Dona Fuji é a maior); lago de carpas com pedras para atravessar, vitórias-régias, 12 carpas e uma família de patos; terraços de chá em 3 degraus de 0,5 m; crista rochosa ao sul (prolonga a cascata e esconde o fim do rio) com mirante e sino de vento; varais, caixas de correio, canteiros; bordos vermelhos e verdes (`MapleTree`, novo), sakuras, pinheiros e bambus posicionados à mão.
- Limites: `EAST` em `data/east.ts`; `Shinichi.tsx` aceita o bairro e o mirante; cerca e colisores próprios; chão estendido até x = 56; colinas de fundo empurradas para além do bairro; mapa e minimapa desenham o bairro.
- Moradora nova: **Dona Fuji** (modelo Blender novo, `fuji`), jardineira, com patrulha curta.
- Missão nova `glicinias` (cap. 2, exploração; oferecida depois de "O Mistério dos 48 Peixes"): conhecer a Fuji → contar as carpas e achar a fração das brancas (3/12 = 1/4) → contar os pés de chá (3 degraus × 14 = 42) → subir ao mirante e tocar o sino → voltar. As contas saem das mesmas constantes que desenham a cena.
- O lago tem o mesmo "splash" amigável do rio.

### Testes
- `tests/east.test.ts`: árvores fora de caminhos/casas/lago/praça/terraços, caminhos fora de casas e da água, degraus de 0,5 m, contas dos desafios = cena, missão e alvos válidos, LOD para todo morador.
- Total: 168 testes passando; `tsc` e `npm run build` ok.
- No navegador: caminhada real do gato da vila, pelo portão, rua, lago (pelas pedras), terraços e mirante; missão `glicinias` jogada do início ao fim com a tecla E (estado de teste apagado com `resetGame()`).
- GPU depois da expansão: praça 21–22 ms, bairro 23 ms, lago 19 ms, rua 15 ms.

### Pendente
- Expandir as outras áreas (oeste, floresta, margem do rio) no mesmo padrão.
- Missões ralas (`mei_coragem`, `contas`, `kuro`) ainda sem redesenho.
- A porta de pedra do Jardim Secreto continua um bloco simples.
- Medidas de GPU feitas nesta máquina, com o painel do navegador visível; não testado em celular.

## 26. Expansão: Bambuzal das Águas Quentes (oeste) e Bosque Antigo (sul) (2026-10-24)

Mesmo padrão do §25: área nova fora da cerca, sem mover nenhuma coordenada de missão antiga; as contas dos desafios saem das mesmas constantes que desenham a cena.

### Bambuzal das Águas Quentes (`data/west.ts`, `world/WestDistrict.tsx`)
- Portão na cerca oeste (z = 6), clareira com bacia de pedra (tsukubai) e banco.
- Trilha sinuosa por um bambuzal (moitas espalhadas por código, sempre a mais de 2 m da trilha) até a **Colina dos Jizō**: 3 terraços de 0,5 m com degraus; cinco estátuas Jizō com montinhos de 1, 3, 6 e 10 pedrinhas (o quinto aparece com 15 quando o enigma é resolvido).
- **Fonte termal** com borda de pedras, bica de bambu, baldes, biombo de bambu, vapor animado e casa de banho; entrar na água quente dá um "splash" amigável ("Ai, quente!").
- **Margem do rio**: passarela com lanternas, píer sobre a água (sem splash), barco balançando, garça bicando a água, taboas e juncos, libélulas; árvores na outra margem. O rio foi estendido para oeste.
- Morador novo: **Seu Goro** (urso, modelo Blender `goro`). Missão `aguas` (cap. 2, depois de "receita"): proporção 2 quentes : 3 frias numa banheira de 15 baldes → 6; padrão 1, 3, 6, 10 → 15.

### Bosque Antigo (`data/south.ts`, `world/AncientGrove.tsx`)
- Portão na cerca sul (x = −2), atrás da Floresta do Treinamento.
- Cedros (sugi) em instâncias: 2 chamadas de desenho para a floresta inteira; pedras com musgo e samambaias.
- **Riacho** de leste a oeste com ponte de tronco e duas pedras; pisar na água devolve o gato à margem.
- **Árvore Anciã** num monte de dois degraus, com corda sagrada (shimenawa), papéis, lanternas, torii e uma coruja que vira a cabeça e pisca.
- **Clareira dos Cervos** com círculo de cogumelos e uma família de cervos pastando; vaga-lumes.
- **Pedras do leste**: 4 afloramentos, cada um um pulo acima do outro (até 2,7 m).
- Moradora nova: **Sábia Hinoki** (modelo Blender `hinoki`). Missão `arvore` (cap. 2, depois de "treino"): divisão 18 passos ÷ 2 por gato = 9; achar 3 musgos-estrela (clareira, atrás da árvore, topo das pedras).

### Integração
- `data/regions.ts`: onde o gato pode andar é uma união de retângulos (vila + 3 áreas + terraço/mirante). Isso substitui os casos especiais em `Shinichi.tsx`.
- Cerca da vila com portões leste, oeste e sul; chão de 112 × 112 m; colinas de fundo afastadas das três áreas; grama por área (o bosque recebe metade); mapa e minimapa desenham tudo.
- Bambus ganharam folhas (valem também para os da vila).
- Peças compartilhadas em `world/districtParts.tsx`; o shader de água parada é o mesmo para o lago de carpas, a fonte termal e o riacho.

### Testes e medidas
- `tests/districts.test.ts`:
  - portões dentro das regiões;
  - vegetação fora de trilhas, casas e água;
  - degraus de 0,5 m e pedras alcançáveis;
  - contas = cena;
  - missões, alvos e patrulhas válidos.
- Resultado: 189 testes, `tsc` e build ok.
- Caminhada real no navegador:
  - portão oeste → trilha → topo da colina;
  - fonte (splash quente);
  - passarela e píer;
  - portão sul → tronco → monte;
  - pedras do riacho → clareira;
  - escalada das 4 pedras com pulos.
- As missões `aguas` e `arvore` foram jogadas do início ao fim com a tecla E (estado de teste apagado com `resetGame()`).
- GPU (nível automático 0), em ms:

| Área | GPU |
|---|---|
| Praça | 22 |
| Clareira | 24 |
| Bambuzal | 22 |
| Onsen | 28 (antes de reduzir o vapor de 14 para 9 nuvens) |
| Margem | 14 |
| Bosque | 11 |
| Árvore Anciã | 13 |

### Pendente
- Missões ralas (`mei_coragem`, `contas`, `kuro`).
- Os Jizō têm forma simples (estilo "boneco").
- Não testado em celular.

## 27. Polimento visual das áreas novas (2026-10-24)

Avaliado com a câmera real do jogo (o que a criança vê), não com vistas livres.

| Antes | Depois |
|---|---|
| Árvore Anciã parecia um poste: tronco liso e copa fora da vista | tronco em torno (lathe) torcido e irregular, base larga, sulcos escuros na casca, 7 raízes, galhos baixos e copa ampla a partir de ~3 m, oco no tronco, musgo, papéis em zigue-zague |
| Cedros como "árvores de Natal", tronco avermelhado | 5 camadas desalinhadas com borda irregular e levemente caída; tronco mais fino e marrom; mais tons de verde |
| Pedras do bosque e da escalada pareciam tocos | blocos facetados empilhados (colisor inalterado), musgo só no topo, pedregulhos na base |
| Cervos com pernas finas e corpo pequeno | corpo maior, pernas mais curtas e grossas |
| Jizō pareciam bonecos de neve | corpo de manto em torno, cabeça careca com orelhas longas, mãos unidas, babador e touca vermelhos, rosto sereno |
| Colina dos Jizō como escada de blocos | azaleias e arbustos nas bordas e na frente de cada degrau (degraus livres), pedras nos cantos |
| Barco era uma prancha | casco de barco extrudado, interior escuro, dois bancos, remo e corda até o píer |
| Outra margem do rio: fileira reta de árvores | duas fileiras desencontradas, arbustos e juncos na beira |
| Na rua do Bairro das Glicínias, a folhagem da pérgola escondia o gato | a folhagem usa o material que fica transparente entre a câmera e o gato |

Conferido em captura: `tools/art-staging/polido_*.png`, `pe_*.png`.
GPU (nível automático 0): praça 23–24 ms, bairro leste 26–28, clareira 26, onsen 27, colina dos Jizō 24, bosque 15, Árvore Anciã 15. Há variação de ±2 ms entre medições (NPCs se movendo). Os valores ficam dentro do que a qualidade automática absorve. Esconder o bambuzal inteiro economiza só ~1,4 ms.
Testes: 189 passando; `tsc` e build ok; estado de teste apagado.

## 28. Redesenho das missões ralas: Coragem da Luna, Contas do Boku, Sombra na Floresta (2026-10-24)

Antes, as três eram só conversa (1 a 2 passos). Agora cada uma tem atividade no mundo, e os números do desafio saem da própria cena (`src/data/redesign.ts`). Os ids de passo antigos foram mantidos, então os saves continuam válidos.

| Missão | Antes | Agora |
|---|---|---|
| **A Coragem da Luna** (`mei_coragem`) | conversar → falar com a Luna na floresta | conversar (escolhas de empatia mantidas) → encontrar a Luna **nos pilares de pedra** → **desafio de padrão**: quanto cada pilar sobe (0,6 m: "o último não é um pulo gigante, é o mesmo pulo quatro vezes") → **subir os 4 pilares** e tocar o sino na borda do mais alto → a Luna sobe também e dá a Fita da Coragem (fala diferente se o jogador foi grosseiro antes) |
| **As Contas do Boku** (`contas`) | 2 contas na barraca | preço (3 × 4) → **levar a sacola de maçãs** até a Dona Neko, do outro lado da vila (item `sacola_macas`) → ela paga com uma nota de 20 (item `moedas_neko`) → troco (20 − 12) → **promoção "leve 3, pague 2"** no quadro de giz: 6 maçãs = 2 grupos, 4 pagas × 4 = 16 |
| **A Sombra na Floresta** (`kuro`) | uma conversa com o Kuro | **3 pistas** na floresta (pegadas, fio do cachecol, pena com seta), contador `kuro_pistas` → **pedra entalhada com código** 13·5·19·20·18·5 (A = 1) = MESTRE → só então o Kuro aparece (`visibleWhen` exige o código) → contar ao Mestre Kuma, que liga a história ao festival |

- Objetos novos (`world/RedesignProps.tsx`): sino de bambu no topo do pilar, pedra entalhada com o código (face voltada para onde as pistas levam) e quadro de giz com caixote de maçãs.
- A Luna da floresta agora espera ao pé do primeiro pilar.
- Desafios novos com Observar / Dica / Exemplo: `luna_pilares` (padrões), `kenzo_promocao` (multiplicação), `kuro_codigo` (padrões).

### Testes
- `tests/redesign.test.ts`:
  - passos antigos preservados e passos novos com alvo;
  - pilares do jogo = alturas do desafio, com o sino no topo do mais alto;
  - contas do Boku: 12, 8 e 16;
  - código = MESTRE;
  - Kuro escondido até o código;
  - 3 pistas = meta do contador.
- Total: 205 testes; `tsc` e build ok.
- No navegador, as três missões foram jogadas do início ao fim com a tecla E, incluindo:
  - escalada dos pilares com pulos;
  - caminhada real do mercado até a Dona Neko;
  - um erro proposital em cada desafio para conferir as ajudas;
  - Kuro invisível antes do código e visível depois.
- O estado de teste foi apagado com `resetGame()`.

### Observação
Numa sessão de teste, o Mestre Kuma não respondia porque "lanternas" estava ativa sem terminar. Isso não acontece no jogo: a missão do Kuro só começa quando "lanternas" termina.

## 29. Prompt Mestre: Etapa 0 (segurança) e Etapa 1 (desempenho) (2026-10-24)

Contexto: ver `docs/AUDITORIA_PROMPT_MESTRE.md`. Nesta máquina (AMD Vega 8 integrada) o jogo rodava a 18–34 fps.

### Etapa 0
- Repositório git criado. Commit base `9e8049a`. Capturas e renders do Blender ficam fora do versionamento (`.gitignore`), mas continuam no disco.
- `src/dev/bench.ts` (`__bench.start()` / `__bench.last`) mede GPU (timer query), triângulos e chamadas de desenho em 8 câmeras fixas, com quadros avançados de forma síncrona. Os temporizadores do navegador ficam limitados a 1 s quando a janela não está visível.

### O que a investigação mostrou (medido)
- **Copas transparentes:** ~10,6 ms. Estavam todas no passe transparente desde a correção do granulado.
- **Custo não ligado à resolução:** a ¼ da resolução e sem sombra o quadro ainda levava ~26 ms. O custo acompanha o **número de chamadas de desenho** (~10–30 µs cada no ANGLE/D3D11 desta GPU), e não a resolução nem a contagem de vértices.
- **Custos isolados na praça** (¼ da resolução, sem sombra):

| Item | Custo |
|---|---|
| Pós-processamento | 6,3 ms |
| Cena estática mesclada (88 blocos) | apenas 1,4 ms |
| Personagens | 7,9 ms |
| Objetos soltos (~660 peças) | 6,7 ms |
| Vegetação instanciada | 3,5 ms |
| Decoração animada | 3,1 ms |

- Sombra ~6 ms e bloom ~6 ms (na resolução cheia).

### O que mudou

| Mudança | Efeito medido |
|---|---|
| Copas opacas, mescladas no material compartilhado; gêmeo transparente só nos blocos entre a câmera e o gato (`FoliageFade`) | copas ~10,6 → ~1 ms |
| Arrays da CPU liberados após o upload + geometria mesclada indexada (`StaticMerge`); tufos de folhagem soldados | heap 508 → ~300 MB |
| Arbustos com tufo `tiny` (~430 triângulos); árvores com `low` | praça 2,49 → ~2,0 M triângulos |
| Moradores: LOD a 7 m (corpo e cabeça), contorno até 7 m, sombra real até 8 m, ocultos além de 32 m | personagens ~7,5 → ~5 ms (estimado pelas isolações) |
| `DistanceCull`: decoração animada (templo, cervos, carpas, patos, vapor, garça, varais, sino, coruja) e objetos do mundo além de 38 m | chamadas na praça 1.424 → ~1.120 |
| Vegetação instanciada em blocos de 30 m com recorte pela câmera | o campo atrás da câmera deixa de ser desenhado |
| `ShadowBudget`: peças com raio < 35 cm não projetam sombra | menos chamadas na passada de sombra |
| Peças rígidas dos personagens fundidas por osso e material | ganho pequeno: as peças usam materiais diferentes |

### GPU por ponto (degrau 0 = qualidade máxima), melhor medida de cada um

| Ponto | Base | Depois |
|---|---|---|
| Praça | 40,6 | 38,6 |
| Mercado | 67,1 | 36,0 |
| Rio | 42,6 | 25,3 |
| Floresta | 38,3 | 24,2 |
| Bairro leste | 72,2 | 38,0 |
| Bambuzal | 51,9 | 38,2 |
| Bosque | 21,3 | 18,4 |
| Templo | 23,9 | 21,0 |

**Limitação honesta:** a GPU aqueceu durante a sessão. O quadro vazio (controle) foi de 6,3–7,2 ms para 9,1 ms, então as últimas rodadas estão infladas em ~30%. O FPS real não pôde ser medido no fim: com a janela do app em segundo plano, o navegador limita o desenho a 0,5 quadro por segundo. **A meta de ≥ 45 fps nesta máquina ainda não foi verificada e, pelas medidas de GPU, provavelmente não foi atingida na praça.**

### Lição registrada
O quimono LOD manchado é **mistura de cores na simplificação**, não o pelo atravessando o tecido. Testei inflar o quimono leve e as manchas continuaram, então o diagnóstico do §25 foi corrigido: o quimono fica sempre inteiro.

Testes: 205 passando; `tsc` e build ok. Commit `ff5c0e4`.

## 30. Etapa 1b: chamadas de desenho e FPS real medido (2026-10-24)

### O que mudou (commit `05c515f`)
- Objetos do mundo estáticos mesclados (`StaticMerge` por objeto, refeito quando o estado da missão muda) e ocultos além de 38 m.
- Moradores: peças rígidas fundidas por osso e material, materiais e contornos compartilhados entre todos (`sharedCharacterMaterials`, `sharedInk`).
- Degraus baixos da qualidade automática: fator `detail` (0,65–1,0) encurta as distâncias de recorte; sombra atualizada a cada 3–4 quadros; bloom desligado nos últimos degraus.

| Ponto (degrau 0) | Chamadas antes | Depois |
|---|---|---|
| Praça | 1.424 | 1.049 |
| Bairro leste | 1.615 | 842 |
| Bambuzal | 1.663 | 786 |

Materiais distintos: 1.597 → 1.154.

### FPS real (build de produção, janela visível, 1366 × 700, começando no degrau 0)
Medido em janelas de 5–8 s após "Começar aventura", parado no ponto inicial:

| Tempo | FPS | Quadro p50 | p95 | Degrau |
|---|---|---|---|---|
| 19 s | 21 | – | – | 2 |
| 29 s | 26 | – | – | 3 |
| 39 s | 38 | 33 ms | 50 ms | 4 |
| 49 s | 32 | 33 ms | 50–67 ms | 6 |
| 83–107 s | 30–40 | 17–33 ms | 50–67 ms | 6 |

- Heap JS: 230–490 MB (oscila com a coleta de lixo).
- **Antes da Etapa 1:** 18–21 fps no degrau 6.
- **Agora:** 30–40 fps no degrau 6.

O quadro alterna entre 16,7 e 33 ms: o tempo de quadro fica perto de 16,7 ms, e o vsync a 60 Hz arredonda cada quadro para um ou dois intervalos.

**Resultado honesto:** a meta da Etapa 1 (≥ 45 fps estáveis com degrau ≤ 2) **não foi atingida**. O jogo dobrou de fluidez, mas só se sustenta no degrau mais baixo.
- O gargalo restante continua sendo o número de chamadas: cerca de 800–1.000 por quadro, mais a passada de sombra.
- O heap continua acima da meta de 350 MB nos picos.

## 31. Etapa 1c: menos chamadas, sombra barata e a CPU como novo limite (2026-10-24)

### O que mudou
| Mudança | Efeito medido (ponto inicial, degrau 0) |
|---|---|
| **Moradores fundidos** (`foldCharacter`): corpo, quimono, mangas e todas as peças rígidas viram uma malha com pele por material; o LOD continua (cada malha tem geometria cheia e leve). Pálpebras e boca, que têm formas, continuam separadas | personagens: 182 → 126 chamadas na cena; 37 → 25 na sombra |
| **Cor nos vértices também nas peças texturizadas** (`StaticMerge`): peças com a mesma textura e tons diferentes viram um bloco só | blocos mesclados na cena: 227 → ~185 |
| **Malhas só de sombra** (`StaticMerge`): todo o cenário que projeta sombra numa célula vira uma malha só de posições, vista apenas pela câmera do sol (camada ligada só durante a passada de sombra) | passada de sombra: 281 → ~110 chamadas |
| **Recorte por tamanho na tela** (`SmallCull`): peças soltas menores que ~10 px saem do desenho, com margem de 25% para não piscar; o limite cresce nos degraus baratos | peças pequenas a 20–30 m deixam de custar |
| **Corpos fixos dormindo** (`SleepFixedBodies`): ~290 paredes e cercas deixam de ser sincronizadas a cada quadro | física: 3,5 → 2,5 ms de CPU por quadro |

**Bench** (8 pontos fixos, degrau 0, chamadas totais de um quadro):

| Ponto | Antes | Depois |
|---|---|---|
| Praça | 1.049 | 614 |
| Bairro leste | 842 | 570 |
| Bambuzal | 786 | 540 |

### FPS real (build de produção, janela visível, 1366 × 700, começando no degrau 0)
| Momento | FPS | p50 | p95 | Degrau |
|---|---|---|---|---|
| §30 (antes) | 30–40 | 17–33 ms | 50–67 ms | 6 |
| Agora, 19–34 s | 31–37 | 33 ms | 33–50 ms | 2–4 |
| Agora, 47–75 s | **42–47** | **16,7 ms** | 33 ms | 5–6 |
| Qualidade fixa "alta" | 25 | 33 ms | 50–67 ms | – |

- O quadro mediano agora é 16,7 ms (60 Hz).
- Os travões de 50–67 ms sumiram do p95.
- A meta de "perto de 45 fps" foi atingida no ponto inicial, mas **só nos degraus 5–6** (resolução de 66–72%). Não foi atingida com degrau ≤ 2.

### O que a medição mostrou
- **A CPU virou o limite.** O JavaScript ocupa ~95% de cada segundo:
  - ~14 ms por quadro dentro do `gl.render`: ~17 µs de CPU por chamada, mais 3–4 ms recalculando as matrizes de 4.350 objetos;
  - 2,5 ms de física.
- A GPU ainda pesa nos degraus altos: com "alta", 25 fps.
- **Testei e desfiz** esconder os ~1.900 grupos vazios que sobram da mesclagem. Não houve ganho: o three.js força a atualização de matrizes a partir da raiz.
- Também tentei um acessor em `visible`, que deixou o desenho **2× mais lento** (V8 polimórfico). Nada disso ficou no código.

### Pontos em aberto
- O heap JS oscilou entre 280 e 760 MB nas medições. O coletor do Chrome age tarde, e não separei com precisão o que é retenção real.
- O recorte por tamanho pode fazer peças pequenas surgirem ao se aproximar (~10 px). Na captura da praça não notei falta de nada, mas não fiz um percurso dedicado a isso.
- Próximos passos de CPU: menos objetos na cena (instanciar peças repetidas), congelar matrizes de ramos estáticos e reduzir os ~330 corpos de física.

Testes: 207 passando (2 novos: moradores fundidos seguem o osso em outra pose; o LOD sobrevive). `tsc` e build ok.

## 32. Etapa 2: superfícies — terra, rochas, pedras de passagem, calçamento e contato (2026-10-25)

Capturas em câmeras fixas (`__bench.shots(prefixo)`, 6 pontos, 1366 × 700, degrau 0):
- `tools/art-staging/e2_antes_*.png` e `e2_depois_*.png`;
- comparações lado a lado: `e2_cmp_*.png`.

### O que mudou
| Antes | Agora | Onde |
|---|---|---|
| Terra: mancha laranja lisa, borda borrada (máscara de 8 px/m) | Shader em coordenadas de mundo, sem repetição: borda recortada por ruído, faixa de grama úmida e mais escura em volta, dois níveis de variação de tom, centro batido mais claro, pedrinhas (padrão celular: topo claro, aro escuro, sombrinha em volta) e grãos finos. Os detalhes somem com a distância (`fwidth`), sem cintilar | `Ground.tsx` |
| Rochas: o mesmo dodecaedro em todo o mapa | Gerador `rockGeometry` com 4 tipos (bloco, chata, laje, seixo): esfera irregular lascada por planos, normais com quebra de aresta, cor assada nos vértices (base escura, faces voltadas ao céu mais claras, tom por face, matiz quente ou frio por variante, musgo opcional). Material de pedra com manchas, pintinhas e aresta lascada clara | `rockGeometry.ts`, `world/Rock.tsx`, `enhanceRock` |
| Pedras de passagem: discos | Lajes lascadas com topo plano, ~3 cm acima da terra | `Ground.tsx` |
| Calçamento: anéis de cor chapada | Textura de 1024 px: rejunte com musgo, tom por pedra, centro gasto, bordas escuras, grãos e cantos lascados (praça e pracinha do bairro leste) | `usePlazaTexture` |
| Sem sombra de contato fora do mapa de sombra | Mapa de contato (4 px/m) em que rochas e pedras carimbam uma mancha suave; o chão multiplica | `groundContact.ts` |

Substituídos 15 usos de dodecaedro (bosque, riacho, pilares, bambuzal, lago leste, rochas do bairro, floresta, pedra entalhada, rochas instanciadas). Ficaram os do prato da balança (Cap. 3) e as partículas.

### Custo medido (dev, praça, degrau 0, 1366 × 700, GPU por timer query, mínimo de 4 repetições intercaladas)
- Quadro total: ~26,4 ms. Sem o chão: 23,7 ms. O chão inteiro custa ~2,7 ms, dos quais o detalhe novo responde por cerca de 1,5 ms (**estimado**: não medi o chão antigo isolado).
- Rochas: diferença não mensurável.
- Chamadas na praça: 692 → 698.
- **Limitação:** a GPU desta máquina varia muito com o aquecimento (mesma cena: 27 a 47 ms). Uma rodada única deu 60,9 ms e era ruído. Por isso reporto apenas o mínimo das repetições.
- **FPS real em produção** (medido depois, com o painel visível; 1366 × 700, começando no degrau 0):

  | Tempo | FPS | p50 | p95 | Degrau |
  |---|---|---|---|---|
  | 20–46 s | 34–38 | 33 ms | 33–50 ms | 1–5 |
  | 53–109 s | **35–48** (quase sempre 38–44) | 16,7–33 ms | 33–50 ms | 6 |

  - Na Etapa 1c eram 42–47 fps no degrau 5–6. Há uma **queda pequena, de ~3–5 fps**.
  - É compatível com o custo do chão novo, mas está perto da variação por aquecimento; não separei as duas causas.
  - Heap: 284–496 MB.

### Pendências
- Folhas secas e gravetos na terra (citados no Prompt Mestre) não foram feitos.
- Contato com o chão só para rochas e pedras, ainda não para casas e cercas.
- Relevo do terreno continua plano (Etapa 6).
- O contorno de tinta das rochas que já o tinham ficou mais fino nas faces lisas.

Testes: 211 passando (4 novos do gerador de rochas: tamanho, cache e variação, laje com topo plano, base escura e musgo). `tsc` e build ok.

## 33. Terra mais barata nos degraus baixos e comparação A/B (2026-10-25)

- As pedrinhas da terra (a parte mais cara do shader do chão) **saem a partir do degrau 4** da qualidade automática e na qualidade Baixa (`RenderProfile.pebbles`).
- A troca é um uniform, sem recompilar shader.
- Teste novo garante a regra na escada.

### Medição honesta
- **Timer de GPU (dev, degraus 0 e 4, pedrinhas ligadas, desligadas e sem o chão):** os resultados se contradizem. Sem o chão saiu igual a com o chão. O custo do chão inteiro está abaixo do ruído desta GPU, que oscila 1–3 ms.
- **FPS real em produção, A/B nas mesmas condições:** 1366 × 700, ~2 min de resfriamento antes de cada rodada, janela de 50–90 s, degrau 6:

  | Versão | Amostras (fps) | Média |
  |---|---|---|
  | A: Etapa 2 sem a troca | 31, 32, 50, 46, 36, 39 | ~39 |
  | B: com a troca | 39, 44, 42, 40, 36, 31 | ~38,7 |

**Conclusão:**
- A troca não muda o FPS de forma mensurável. Fica por ser barata e não ter custo visual nos degraus em que a resolução já é baixa.
- A oscilação de 30–50 fps dentro de uma mesma rodada vem do aquecimento da máquina.
- A "queda de 3–5 fps" da Etapa 2 em relação à 1c (§32) **não se confirma** como efeito do código. Foi medida sem A/B e com a máquina quente; o mais provável é que fosse aquecimento.
- Daqui em diante, comparações de FPS só com A/B e resfriamento.

Testes: 212 passando.

## 34. Etapa 3: luz e render — tone mapping, luz do céu, contato e presets (2026-10-25)

Comparações lado a lado em `docs/etapa3/comparacao_entardecer.jpg` e `comparacao_dia.jpg`. Capturas: `tools/art-staging/e3a_*` (antes) e `e3g_*` (depois); a câmera nova `gato_perto` foi incluída para a leitura dos personagens.

### O que mudou
| Item | Antes | Agora |
|---|---|---|
| Tone mapping | Corte seco em 1: o lado iluminado de tudo que é quente perdia matiz e detalhe | Curva própria para o toon: tudo abaixo de 0,8 fica intacto (as faixas e as cores pintadas), e acima disso cada canal desce num ombro suave que nunca chega a 1. A saturação entra antes da curva |
| Luz do céu | Hemisférica + ambiente: só "céu em cima, chão embaixo" | Sonda de luz (harmônicos esféricos) gerada das cores do domo do céu, puxada 50% para a luz de céu do preset e calibrada para a mesma luz média de antes. A sombra voltada para o sol recebe o horizonte quente; a oposta, o céu frio |
| Oclusão | Vértices das copas e rochas; contato só de rochas e pedras | Também os objetos estáticos que tocam o chão (casas, postes, barris, cercas) carimbam sombra de contato durante a mesclagem, uma única vez por peça |
| Bloom | Limiar 0,9: pelo branco ao sol brilhava | Limiar 1,05: só luzes brilham (lanternas, janelas, emissivos) |
| Presets | Saturação 1,12 nos dois | Entardecer 1,1; dia 1,0 (a grama do meio-dia estava neon) |

**Tentativas descartadas, com o motivo:**
- **Ombro sobre a luminância com o excesso empurrado para o branco:** deixava flores amarelas e janelas acesas cor creme.
- **Sonda pura do domo:** sombra cinza e fria no entardecer.
- **Calibrar a sonda só pela face voltada para cima:** paredes e personagens claros demais.

### Detalhe nas luzes (capturas 1366 × 700, % de pixels com algum canal ≥ 250, sem a faixa do HUD)
| Captura | Entardecer antes → depois | Dia antes → depois |
|---|---|---|
| Gato de perto | 3,9 → 1,5 | 4,2 → 0,8 |
| Pedras de passagem | 5,0 → 1,7 | 2,3 → 0,5 |
| Praça | 8,2 → 5,1 | 6,3 → 2,5 |
| Lago | 3,2 → 0,9 | 1,3 → 0,2 |
| Borda da trilha | 1,6 → 0,8 | 2,1 → 0,4 |

- O brilho médio ficou praticamente igual (variação de 1 a 3 níveis).
- Nenhuma captura tem sombra esmagada (0% abaixo de 12).

### SSAO/GTAO: avaliado e não adotado
- As versões do three.js (SAO, SSAO, GTAO) redesenham a cena para obter normais.
- Com ~17 µs de CPU por chamada medidos na Etapa 1c e ~500 chamadas por quadro, isso somaria **~8–9 ms de CPU por quadro** (estimado a partir dessas medidas, não medido diretamente), num jogo já limitado pela CPU.
- A oclusão ficou assada: vértices e mapa de contato, sem custo por quadro.

### Custo (A/B em produção, 1366 × 700, ~2 min de resfriamento antes de cada rodada, 50–90 s, degrau 6)
| Versão | Amostras (fps) | Média |
|---|---|---|
| A: Etapa 2 | 37, 41, 41, 42, 39, 31 | ~38,5 |
| B: Etapa 3 | 42, 36, 42, 39, 37, 36 | ~38,7 |

O custo não é mensurável:
- a curva são algumas operações num passe que já existia;
- a sonda são 9 coeficientes no lugar de duas luzes;
- os carimbos de contato rodam uma vez, no carregamento.

### Correção
Erro em produção, "Cannot read properties of null" no contorno de malhas com pele (16 vezes ao carregar). Os moradores fundidos descartam os arrays depois do envio à GPU, e o three ainda calculava o contorno deles a partir dos arrays. Agora o contorno é definido na criação de cada malha fundida e de cada contorno de tinta, e as cópias o herdam. Conferido: 0 erros no build de produção.

### Pendências
- O bloom ainda é forte nos emissivos no degrau 0.
- Revisar as capturas noturnas: não há preset noturno.

Testes: 219 passando (7 novos da luz do céu: calibração, lado do sol, céu acima do chão, sombra quente no entardecer).

## 35. Etapa 4: fauna — coelhos, pássaros que pousam, borboletas com asas (2026-10-25)

Imagens em `docs/etapa4/fauna.jpg`.

### O que existe agora
| Animal | Antes | Agora |
|---|---|---|
| Coelhos | não havia | 8 em quatro tocas (prado sul, gramados oeste e sul da vila, bambuzal). Farejam (nariz e orelhas tremendo), saltam em arcos curtos com esticada no ar, descansam deitados de orelhas para trás, se limpam com a cabeça baixa |
| Reação ao gato | — | O coelho foge em 4–6 saltos longos para longe do gato e depois senta em alerta, de orelhas em pé. **Agachado (C), o gato chega bem mais perto**, a ~1,2 m em vez de 3,2 m; correndo, o coelho foge de mais longe. Isso ensina a se aproximar devagar |
| Pássaros | triângulos girando a 19 m de altura | 9 pássaros que pousam nos postes da cerca e ciscam nas duas praças: bicam, dão pulinhos e viram a cabeça. Voam em arco entre pontos, batendo as asas e recolhendo ao pousar; fogem do gato para um ponto a mais de 6 m dele; dois nunca dividem o mesmo pouso. Um bando de 5 ainda circula alto, alternando planeio e batidas |
| Borboletas | esferas achatadas pulsando | 15 borboletas com dois pares de asas articuladas, voo errático. Vão de flor em flor (as flores reais da folhagem), pousam com as asas abrindo e fechando devagar e levantam voo quando o gato chega |

### Como funciona
- **Comportamento** (`fauna/brains.ts`): máquinas de estado puras e determinísticas, testadas sem o jogo.
- **Mundo** (`world/Fauna.tsx`):
  - toda decisão de destino é validada com raios do Rapier contra as colisões fixas, só no momento da escolha;
  - a água (rio, riacho, lago, onsen) e as regiões andáveis vêm dos dados.
- **Desenho** (`fauna/models.ts`):
  - uma InstancedMesh por espécie, com cada vértice marcado pela parte do corpo;
  - orelhas, cabeça, postura e asas são animadas no shader, a partir de 4 números por animal.
- Os bichos ficam um pouco maiores que o natural (pássaro 1,6×, borboleta 1,7×, coelho ~1,2×), para serem lidos ao lado do gato estilizado.

### Verificado
- **Testes:** 8 novos de comportamento. 227 testes passando, `tsc` e build ok.
  - Coelhos: passeiam, descansam e se limpam; fogem do gato andando; deixam o agachado chegar perto; nunca atravessam parede nem param na água, mesmo perseguidos por 5 min simulados.
  - Pássaros: fogem para longe e pousam no destino; nunca dividem pouso.
  - Borboletas: pousam em flores; levantam voo com o gato.
- **No jogo, com o Rapier real:** 32 s de perseguição com 15 fugas forçadas e 868 verificações, sem nenhum bicho dentro de colisão ou na água.
- **Build de produção:** 0 erros no console.

### Custo
| Medida | Valor |
|---|---|
| CPU por quadro (todos os bichos) | 0,07 ms (pico 0,10 ms) |
| Chamadas de desenho | 3 na cena + 1 na sombra dos coelhos; antes eram 2 |
| Triângulos | ~12 mil, contra ~2 milhões da cena |
| GPU (timer, ligado/desligado, mínimo de 5) | 13,1 / 15,3 ms: **abaixo do ruído** de 2–3 ms desta GPU |

Pelo tamanho, o custo de GPU fica muito abaixo da meta de 1,5 ms.

### Pendências
- A sombra dos coelhos usa a pose de repouso.
- Os pássaros não pousam nos telhados, só nas cercas e no chão das praças.
- Não há sons dos animais. Ficam para quando houver áudio licenciado ou próprio, e não sintetizado como definitivo.

### Correção nesta etapa
Os arbustos estavam com o material de pedra desde a Etapa 2: a substituição pegou dois blocos de código idênticos. Commit separado: `c4c529f`.

## 36. Etapa 5: personagens e animação — pés presos ao chão, transições, sombra de contato (2026-10-25)

Tiras de quadros: `docs/etapa5/passadas.jpg` (gato agachado e correndo, câmera lateral).

### O que estava errado (medido)
A ferramenta nova `src/dev/gait.ts` toca cada clipe sozinho e mede a velocidade com que o pé apoiado corre para trás. Essa é a velocidade de chão natural do clipe.
- **Moradores:** caminhada de 0,42 unidade/s por modelo (0,55 m/s na escala do jogo). Andavam a 1,3 m/s com o clipe a ~1×: **o corpo andava mais que o dobro do que os pés empurravam** (~58% de deslizamento).
- **Gato:** as passadas eram estimadas à mão, 16–30% fora do real: corrida 1,57 m/s, caminhada 0,32 m/s. A corrida era limitada a 3,4×, o que dava ~26% de deslizamento a 7,2 m/s.
- **Gato agachado:** o clipe de agachar é uma pose quase parada (0,03 m/s), misturado com 40% da caminhada. Agachado, **o gato andava a 1,9 m/s com as patas quase paradas** (~78%).
- **Partida e parada:** os moradores começavam e paravam instantaneamente em velocidade cheia.

### O que mudou
| Mudança | Onde |
|---|---|
| Passada natural e ganho do alongamento medidos no carregamento, por modelo (`measureGait`), no lugar de constantes | `entities/gait.ts` |
| Cada clipe toca exatamente em velocidade ÷ passada. Acima de um ritmo agradável, a **passada se alonga** (coxas e braços giram mais) em vez de acelerar mais. O ganho real do alongamento é medido por clipe: gato caminhada 0,53, corrida 0,82, moradores ~1,65 | `gaitFor`, `stretchStride` |
| Agachar virou uma **pose aditiva** por cima da caminhada inteira: as patas andam de verdade | `ShinichiCat.tsx` |
| A troca caminhada → corrida do gato passou para 0,8–1,6 m/s (a caminhada dele é um passeio lento) | `ShinichiCat.tsx` |
| Moradores aceleram e desaceleram (~0,3 s) em vez de partir e parar em velocidade cheia | `NPC.tsx` |
| **Sombra de contato suave** no gato: segue o chão por raio, encolhe e enfraquece com a altura do pulo e marca o ponto de pouso. Nos moradores, troca o disco preto de borda dura | `contactBlob.ts`, `Shinichi.tsx`, `NPC.tsx` |

### Resultado (lido do jogo: velocidade real, tempo do clipe e alongamento aplicados)
| Situação | Antes | Agora |
|---|---|---|
| Gato correndo, 7,2 m/s | ~26% | **0%** (clipe 3,6×, passada +33%) |
| Gato rápido, 4,2 m/s | ~13% | **0%** |
| Gato agachado, 1,9 m/s | ~78% | **5%** |
| Gato devagar, ~1,3 m/s | ~24% | **1%** |
| Moradores andando (0,7–1,3 m/s) | ~58% | **0%** |
| Pipo (filhote, 3,4 m/s) | ~82% | 27% |

- "Antes" foi calculado com as passadas medidas e as fórmulas antigas.
- A medição quadro a quadro dos pés no jogo foi tentada e **não serviu**: a ~30 quadros/s, o apoio de uma pata na corrida dura menos de um quadro. Os números acima vêm da medição de alta resolução dos clipes (240 amostras por ciclo) combinada com o que o jogo aplica.

### Bug encontrado e corrigido no caminho
**O gato encolhia até sumir.** O GLB guarda uma única vez os arrays de keyframes iguais, e os clipes os compartilham. Tornar o `crouch` aditivo no lugar subtraiu a referência dentro do array compartilhado e zerou a escala do `idle`. Agora o aditivo é feito num clone. Há um teste de regressão.

### Pendências
- **Pipo:** ainda desliza 27%. Precisa de um clipe de corrida para os moradores.
- **Ritmo no limite:** correndo, o gato fica no ritmo máximo (3,6×, ~6 ciclos/s). Para ritmos mais naturais, as opções são:
  - refazer os clipes no Blender (`tools/blender/build_rig.py`) com passadas mais longas;
  - reduzir as velocidades de jogo.

  As duas são decisões de design.
- **Legibilidade a distância:** só avaliada nas capturas; não houve trabalho específico.
- **Carregamento:** medir as passadas custa ~10 ms por modelo, uma vez (estimado; não medi o tempo total).

Testes: 237 passando (10 novos: tempo da passada, passada medida num rig sintético com resposta analítica, ganho do alongamento, sombra pela altura e regressão do clipe compartilhado). `tsc` e build ok; 0 erros no console de produção.


## 37. Etapa 6: vegetação e composição — manchas de densidade, três planos, câmera nos lugares apertados (2026-10-25)

### O que estava ruim
- **Grama uniforme:** a mesma densidade e altura em todo o gramado, como um tapete.
- **Arbustos repetidos:** um único formato em todo o mapa.
- **Sem plano médio:** com a câmera alta, além das cercas dos bairros aparecia o chão vazio e a borda do terreno antes dos morros.
- **Câmera espremida:** atrás de casas, sob beirais e nas varandas, ela encostava no gato. Na varanda da casa sul ficava a 1,3 m, 100% do tempo.

### O que mudou
| Mudança | Onde |
|---|---|
| **Campo de densidade** (`lushness`, ruído de 2 oitavas): manchas ralas e viçosas. A grama é rejeitada nas manchas ralas, fica maior nas viçosas e muda de tom entre elas | `Foliage.tsx` |
| **Touceiras altas** com espigas (malha nova, 7 folhas): na beira das trilhas, ao longo das cercas, ao pé das paredes e no miolo das manchas viçosas | `Foliage.tsx` |
| **Arbustos em 3 formatos** (3 malhas instanciadas com o mesmo material) | `Foliage.tsx` |
| **Linha de mata** entre as cercas e os morros: ~320 árvores (coníferas e copas redondas, paletas variadas), a ≥ 4 m de qualquer lugar onde o gato anda, mais densa junto à borda. **2 chamadas de desenho** no total | `TreeLine.tsx` |
| **Câmera que procura vista:** quando o espaço atrás do gato cai abaixo de 72% da distância desejada, ela testa 11 direções próximas (girar ±0,35/0,7/1,1 rad, subir 0,22/0,42) por raio de física. Escolhe a vista com mais espaço e menos desvio, preferindo girar a subir, e com tolerância para não trocar de vista à toa. A transição é suave, e o jogador arrastando a câmera tem prioridade | `cameraProbe.ts`, `ThirdPersonCamera.tsx` |

Os três planos agora leem em todas as vistas do percurso: a vila e a vegetação perto, uma parede de árvores no meio, os morros e as montanhas atrás.

### Câmera nas áreas apertadas (medido: `__compo.camera()`, o gato caminhando por 6 trechos, 110 quadros cada)
| Trecho | Distância média antes → agora | Quadros espremidos (< 2,2 m) antes → agora |
|---|---|---|
| Varanda da casa sul | 1,31 m → 6,66 m | 100% → 4% |
| Atrás da cantina | — → 7,58 m | 42% → 0% |
| Beco do bairro leste | — → 6,53 m | 23% → 4% |
| Beco do mercado, entre as casas oeste, varanda leste | → 7,4–7,5 m | → 0% |
| **Total** | | **27,4% → 1,2%** |

A visão bloqueada (raio da câmera até o gato) passou de 2,6% para **0%**. O "antes" de cada trecho veio da mesma medição feita antes da mudança; os traços indicam números não anotados naquela rodada.

### Percurso (capturas antes/depois, 9 paradas)
`docs/etapa6/percurso_1.jpg` e `percurso_2.jpg`; `varanda_camera.jpg` mostra a câmera na varanda.

### Custo
- **Linha de mata:** ligá-la e desligá-la deu diferença dentro do ruído da contagem (±15 chamadas, porque a sombra é redesenhada a cada 2 quadros). Pelo código, são 2 chamadas, sem sombra projetada.
- **Grama alta e 3 formatos de arbusto:** entram nos mesmos blocos espaciais da grama (`chunkInstanced`). Não medi o acréscimo isolado.
- **FPS em produção: não medido.** O A/B foi montado (build da Etapa 5 contra o da Etapa 6), mas no meio da rodada A a janela do app foi para segundo plano e o navegador passou a desenhar a ~0,6 quadro/s. Os primeiros 20 s deram 37–39 fps, em linha com as etapas anteriores, mas isso não é uma comparação. **Falta repetir o A/B com a janela em primeiro plano.**

### Pendências
- **Bambuzal:** na entrada, o telhado do portal esconde o gato (antes e depois). O telhado não tem colisor, então a câmera não o enxerga como obstáculo. Opções: um colisor só para a câmera ou deixar o telhado transparente quando cobre o gato.
- **Grama alta do bambuzal:** ficou um pouco desgrenhada nas capturas.

Testes: 244 passando (7 novos: escolha de vista da câmera, linha de mata fora das áreas andáveis e dentro do terreno, faixa do campo de densidade). `tsc` e build ok; 0 erros no console de produção (menu).

## 38. Etapa 7: experiência inicial e UX — objetivo em uma linha, patinhas guia, acessibilidade, passeio (2026-10-25)

### O que um jogador novo encontrava (diagnóstico no jogo, jogo novo)
- **Nenhum objetivo na tela.** O HUD só mostrava missões já *ativas*, e num jogo novo nenhuma está.
- **O faro (tecla 4) não fazia nada** sem missão ativa, justamente quando o jogador mais precisa dele.
- **O "!" da Chef Hana sumia:** 0,36 m de altura, amarelo, na frente das janelas amarelas iluminadas da cantina (captura de início).
- **O menu listava 11 teclas** de uma vez.
- **Sem acessibilidade:** não havia movimento reduzido, tamanho de texto nem câmera invertida.
- **Sem rota de demonstração.**

### O que mudou
| Mudança | Onde |
|---|---|
| **Próximo objetivo em uma linha**, calculado num só lugar: com missão ativa, a etapa aberta mais próxima; sem missão, a primeira pessoa com um pedido, na ordem da campanha | `systems/objective.ts` |
| **Cartão "Seu primeiro passo / Próximo passo"** no HUD quando nenhuma missão está sendo seguida, com "siga as patinhas" e "aperte E" (ou os botões de toque) | `HUD.tsx` (`NextObjective`) |
| **Patinhas guia automáticas:** até a primeira missão, as patinhas douradas do faro aparecem sozinhas a cada 9 s, por 4,5 s, apontando o objetivo. Param de vez quando uma missão começa | `systems/FirstSteps.tsx` |
| **O faro sempre aponta algo:** usa o mesmo objetivo, então funciona também sem missão ativa | `Shinichi.tsx` |
| **"!" ~1,6× maior, sobre um selo escuro com aro** (dourado para pedido, azul para etapa), sempre virado para a câmera | `NPC.tsx` (`Marker`) |
| **Menu enxuto:** só as 4 teclas do primeiro minuto. O resto fica em Configurações | `MainMenu.tsx` |
| **Acessibilidade** (Ajustes > Acessibilidade, salvo no navegador). Movimento reduzido segue o sistema por padrão: corta as animações da interface e os fogos, reduz as faíscas e deixa a câmera do passeio parada. Também há tamanho do texto (normal, grande, muito grande) e câmera invertida (cima/baixo) | `uiSettings.ts`, `App.tsx` (`A11yBridge`), `particles.tsx`, `Panels.tsx`, `ThirdPersonCamera.tsx` |
| **"🎬 Passeio pela vila"** no menu: 7 paradas com título e uma linha de legenda, câmera girando devagar, botões "Próximo" e "Voltar ao menu" (Esc). Não salva nada; o gato acompanha (sombra, grama e detalhe seguem a cena) e volta ao início | `systems/tour.tsx`, `ui/TourOverlay.tsx` |

Os ângulos do passeio foram escolhidos testando 8 vistas por parada (Ponte, Bosque e Bairro tinham telhado ou copa na frente da câmera). Capturas: `docs/etapa7/passeio.jpg`.

### Primeiro minuto (medido: `__onb.firstMinute()`, jogador simulado, jogo novo)
O jogador simulado espera as patinhas aparecerem, anda na direção delas, aperta E ao chegar perto e clica no diálogo.

| Momento | Antes | Agora |
|---|---|---|
| Objetivo escrito na tela | nunca (até aceitar uma missão) | **0,1 s** |
| Caminho indicado | só o "!" pequeno | **2,7 s** (patinhas) |
| Chega à Chef Hana | — | **4,1 s** |
| Missão "O Mistério dos 48 Peixes" ativa | — | **5,2 s**, depois de 2 telas de diálogo (29 palavras) |

**Limite honesto do critério de aceitação** ("um novo jogador entende o objetivo em menos de 1 minuto"):
- A medição é de um jogador simulado que já faz o que as patinhas mostram e clica rápido no diálogo.
- Ela prova que o caminho existe, está sinalizado desde 0,1 s e cabe com folga em 1 minuto.
- Ela **não prova** que uma criança entende. Isso só um teste com uma criança que nunca jogou confirma; o pedido é observar sem ajudar e anotar o tempo até ela falar com a Chef Hana.

### Bug encontrado e corrigido no caminho
**O gato podia ficar travado depois do "Começar".** O laço do gato lia a fase do jogo do último render do React. Com a janela em segundo plano, o React não renderizava, e o gato continuava "no menu" e ignorava os controles. Agora a fase é lida da store a cada quadro. Isso também evita um quadro de atraso ao abrir e fechar diálogos.

### Custo
- **Patinhas guia e objetivo:** uma verificação por quadro, sem desenho novo (reusam a trilha do faro).
- **Selo do "!":** +2 malhas por marcador. No início há 2 marcadores (Hana e Lótus): ~4 chamadas de desenho, estimado e não medido.
- **Passeio:** só roda quando aberto, a partir do menu.

### Pendências
- **Tamanho do texto:** só afeta o que é medido em `rem`. Parte do HUD usa `px` e não cresce; precisa de revisão.
- **Não feito:** remapear teclas e modo para daltonismo. Legendas para sons ficam para quando houver áudio definitivo (o atual é provisório).
- **HUD em tela de celular, durante o jogo:** não foi conferido nesta etapa (o menu foi, a 510 px).
- **A/B de FPS em produção** (pendente da Etapa 6): continua por fazer, com a janela em primeiro plano.

Testes: 251 passando (7 novos: objetivo num jogo novo, com missão e entre missões; paradas do passeio em chão andável e com legenda curta; câmera parada com movimento reduzido; faixa do tamanho de texto). `tsc` e build ok; 0 erros no console de produção (menu e passeio).

## 39. Etapa 8: QA final e relatório (2026-10-26)

Relatório completo no formato do item 20 do Prompt Mestre: `docs/RELATORIO_FINAL.md`. Comparações finais: `docs/relatorio_final/`.

### Medido nesta etapa
- **FPS em produção, A/B Etapa 5 × final:** degrau 6, 1366 × 700, ~2 min de resfriamento antes de cada rodada, 7 janelas de 10 s. Média ~42 × ~41 fps: as Etapas 6 e 7 não têm custo mensurável. Fecha a pendência da §37.
- **Bench nas 8 câmeras fixas, degrau 0, dev:** praça 15,0 ms de GPU, 706 chamadas, 2,11 M triângulos (auditoria: 40,6 ms, 1.424 chamadas, 2,49 M). Cena: 1.522 malhas, 881 materiais. Heap: 314 MB após coleta, picos de ~650 MB.
- **Colisões:** 8 casas × 4 faces sem atravessar nem travar.
- **Ponte:** atravessada nos 4 casos.
- **Câmera nos trechos apertados:** 1,2–6,2% do tempo espremida em 5 rodadas (antes 27,4%); visão bloqueada 0%. O beco do bairro leste é o ponto mais fraco.
- **Primeiro minuto:** missão iniciada em 5,2–8,2 s pelo jogador simulado.
- **HUD em celular emulado (375 px):** ok.
- **Testes:** 251 passando; `tsc` e build ok; 0 erros no console de produção.
