# Auditoria técnica — Prompt Mestre Definitivo (2026-10-24)

Fase 1 obrigatória do Prompt Mestre: examinar o projeto real antes de mudar.
- Tudo marcado como **medido** foi executado nesta máquina.
- O que é **inferido** está indicado.
- Capturas em `tools/art-staging/aud_*.png`.

## 1. Stack confirmada

| Item | Versão / estado |
|---|---|
| Renderizador | Three.js 0.160.1 (WebGL2 via ANGLE/D3D11) |
| Camada React | @react-three/fiber 8.18, drei 9.122, React 18.3 |
| Física | @react-three/rapier 1.5 (Rapier WASM) |
| Estado | Zustand 4.5 com `persist` (localStorage) |
| Build / testes | Vite 5.4, TypeScript 5, Vitest 2.1 (205 testes passando) |
| Pós-processamento | EffectComposer próprio (`Effects.tsx`): RenderPass, Bloom, Grade e Upscale com nitidez (CAS) |
| Materiais | `MeshToonMaterial` com rampa suave de 64 tons, rim light e vento em `onBeforeCompile`; texturas procedurais em canvas (`textures.ts`: madeira, tábuas, telhas, pedra, reboco, palha, casca, calçamento) |
| Tone mapping | **nenhum**: o Canvas usa `flat` (NoToneMapping); a cor final sai do passe "Grade" |
| Luz | Sol direcional seguindo o jogador (sombra PCF, mapa 2048), hemisférica, ambiente, luz de preenchimento, névoa linear; presets "entardecer" e "dia" |
| AO / IBL | **não existem** |
| Terreno | plano único de 112 × 112 m; terra das trilhas pintada numa textura macro de **8 px/m**; sem relevo, só estruturas por cima |
| Vegetação | grama e flores instanciadas; árvores com "puffs" (esferas com oclusão nos vértices); copas transparentes para o recorte da câmera |
| Personagens | Shinichi (GLB próprio, pelagem em camadas); 21 moradores em GLB do Blender, com LOD além de 11 m |
| Animais | borboletas (esferas achatadas), pássaros (triângulos girando a 19 m de altura), peixes saltando; nos bairros novos: carpas, patos, garça, libélulas, cervos e coruja. **Não há coelhos.** |
| Controle de versão | **o projeto não está num repositório git** |

## 2. Desempenho medido (AMD Radeon Vega 8 integrada, 8 núcleos, 8 GB, janela de 1366 × 600)

| Medida | Resultado |
|---|---|
| Menu (dev) | 0,9 s |
| Mundo pronto após "Começar" (dev) | ~15 s |
| FPS real na praça (dev, qualidade automática) | **25 fps** (quadro mediano de 33 ms, p95 de 66 ms) |
| FPS real (build de produção) | **18–21 fps**, com a qualidade automática **no degrau mais baixo (6 de 7)** |
| Heap JS | **510–700 MB** (dev e produção) |
| Objetos na cena | 2.014 malhas, 16 instanciadas, **1.597 materiais distintos**, 1.052 geometrias, 133 texturas, 78 programas de shader |
| GPU na praça (timer query, qualidade máxima) | 39 ms no total; copas das árvores **~10,6 ms**; personagens animados **~9,4 ms**; atualização da sombra ~1,5 ms; grama ~0,8 ms |

**Conclusão:** nesta máquina o jogo não chega a 30 fps estáveis, nem com a qualidade automática no mínimo. Antes de acrescentar qualquer coisa visual, é preciso abrir espaço no orçamento.

## 3. Defeitos classificados

### Crítico (desempenho e estabilidade)
1. **Copas transparentes custam ~10 ms.** Causa: para eliminar o granulado do recorte da câmera, toda a folhagem passou para o passe transparente. Isso gera sobreposição de pixels e acaba com a rejeição antecipada por profundidade.
2. **Personagens custam ~9 ms.** Causas prováveis (a confirmar na Etapa 1): camadas de pelagem do Shinichi, contornos (ink) duplicando as malhas e moradores próximos com malha completa.
3. **Memória de 510–700 MB.** Causas prováveis (a confirmar): geometrias de origem mantidas ao lado das versões mescladas, um material por objeto, texturas em canvas duplicadas.
4. **1.597 materiais**: cada `<Toon>` cria um material novo, sem biblioteca compartilhada.

### Alto (visual)
5. **Terra e trilhas:** mancha laranja lisa, com borda borrada e sem microdetalhe (8 px/m). De perto parece tinta sobre a grama (`aud_terra_close.png`, `aud_pedras_close.png`).
6. **Pedras:**
   - pedras de passagem são discos;
   - pedras soltas são dodecaedros sem variação;
   - a textura "pedra" é alvenaria repetida, inclusive onde deveria ser rocha natural;
   - não há sombra de contato com o chão.
7. **Iluminação:**
   - sem tone mapping;
   - sem oclusão de ambiente; objetos não "assentam" no chão;
   - sombras de contato só onde o mapa de sombra alcança;
   - um único clima (pôr do sol).
8. **Animais da vila:** as borboletas não têm asas e os pássaros são triângulos girando no céu. Faltam coelhos, pássaros pousando e comportamentos.

### Médio
9. **Câmera apertada:** fica comprimida junto às varandas e beirais (`aud_trilha.png`).
10. **Terreno sem relevo:** todo o mundo é plano; relevo só existe como blocos.
11. **Repetição de vegetação:** tufos e arbustos iguais; densidade quase uniforme na vila.
12. **Personagens:** não verifiquei deslizamento de pés nem transições de animação. Ficam para a Etapa 5.

### Baixo
13. Menu e HUD não foram avaliados em resoluções de celular nesta auditoria.
14. A primeira experiência (os 2 primeiros minutos) ainda não foi desenhada como vitrine.

### Funcional (o que está bem)
- 31 missões; as 8 mais recentes foram jogadas do início ao fim.
- 205 testes, `tsc` e build passam.
- Nenhum erro no console durante a sessão.

## 4. Plano priorizado (uma etapa por vez, com aprovação entre elas)

| Etapa | Foco | Critério de aceitação verificável |
|---|---|---|
| **0. Segurança** | Criar repositório git com o estado atual como base. Criar script de medição reprodutível (FPS, GPU, memória, chamadas de desenho) em câmeras fixas. | O commit base existe e o script gera uma tabela comparável |
| **1. Orçamento de desempenho** | Copas opacas, com transparência só na árvore que fica entre a câmera e o gato. Biblioteca de materiais compartilhados. Investigar e reduzir o custo dos personagens e a memória. | ≥ 45 fps estáveis na praça nesta máquina com qualidade automática ≤ degrau 2; heap < 350 MB; materiais < 300; nenhuma perda visual nas capturas fixas |
| **2. Superfícies** | Terra com microdetalhe procedural (pedrinhas, folhas, variação de tom, borda irregular, transição com grama e pedra). Gerador de rochas com silhueta irregular, erosão e cor variada. Pedras de passagem e calçamento refeitos. Sombra de contato. | Close-ups em câmeras fixas sem mancha lisa, sem tiling visível e sem pedra "plástica"; GPU dentro do orçamento da Etapa 1 |
| **3. Luz e render** | Tone mapping calibrado com o toon. Luz ambiente vinda do céu (IBL leve). Avaliar SSAO/GTAO contra oclusão assada, considerando o custo nesta GPU. Contato com o chão. Revisão dos presets dia e entardecer. | Detalhe preservado nas luzes e nas sombras; personagens legíveis; custo de cada efeito medido e justificado |
| **4. Fauna** | Coelhos (andar, farejar, descansar, orelhas, saltos curtos, reação ao gato). Pássaros que pousam em cercas e telhados, saltitam e voam entre pontos. Borboletas com asas, atraídas por flores. Máquinas de estado leves. | Animais no chão sem atravessar objetos; custo total < 1,5 ms de GPU |
| **5. Personagens e animação** | Deslizamento de pés, transições, sombras de contato, legibilidade a distância. | Comparação quadro a quadro sem deslizamento visível |
| **6. Vegetação e composição** | Zonas de densidade, variedade, os três planos (primeiro plano, intermediário, fundo) e câmera nas áreas apertadas. | Capturas de percurso aprovadas |
| **7. Experiência inicial e UX** | Os 2 primeiros minutos como vitrine; configurações de acessibilidade (áudio, movimento reduzido, controles); rota de demonstração. | Um novo jogador entende o objetivo em menos de 1 minuto, sem tutorial longo |
| **8. QA final e relatório** | Percurso completo, medições antes e depois, relatório no formato do item 20. | Diferença clara entre implementado, testado e planejado |

**Por que o desempenho vem antes da arte:** as Etapas 2 a 4 acrescentam custo. Sem a Etapa 1, cada melhoria visual empurraria o jogo para ainda menos fps, e a qualidade automática reduziria a resolução, apagando o próprio ganho visual.

## 5. Limitações desta auditoria
- **Uma única máquina:** as medidas são de uma GPU integrada. Uma máquina de avaliação de competição tende a ser mais forte, mas o público infantil frequentemente usa máquinas como esta.
- **Celular e WebGPU:** não testados. O navegador expõe `navigator.gpu`, mas o projeto é WebGL. Migrar não se justifica agora: o gargalo atual é de conteúdo, não de API.
- **Concurso:** nenhum regulamento foi informado; os critérios da Etapa 7 devem ser revistos quando houver um alvo.
