# Modelos 3D do jogo

Coloque aqui os arquivos `.glb` (glTF 2.0 binário) com **exatamente** estes nomes. O jogo detecta cada arquivo sozinho:
- se ele existir, é usado;
- se não existir, o jogo desenha a versão procedural, sem quebrar nada.

Dicas para exportar do Blender:
- **Escala:** 1 unidade = 1 metro. O jogo ajusta a largura do modelo ao espaço que o objeto ocupa.
- **Base:** o modelo deve ficar apoiado no chão (z = 0 no Blender), com a frente virada para -Y.
- **Materiais:** use cor (Base Color) e textura. O jogo converte tudo para o visual toon.
- **O Shinichi não fica aqui:** ele usa `public/assets/characters/shinichi.glb`, com esqueleto e expressões. O contrato está em `docs/REFORMULACAO.md`.

| Pasta | Arquivo | O que é |
|---|---|---|
| `characters/` | `mestre_lotus.glb` | Mentor: sábio idoso, chapéu de palha, quimono e cajado |
| `characters/` | `kiko.glb` | Inventor laranja com óculos de aviador |
| `characters/` | `sora.glb` | Comerciante tricolor de quimono |
| `characters/` | `taro.glb` | Rival cinza-escuro de faixa vermelha |
| `characters/` | `luna.glb` | Curandeira de traje lilás e cajado |
| `characters/` | `boku.glb` | Comerciante robusto com mochila grande |
| `characters/` | `general_hissui.glb` | Antagonista de armadura samurai |
| `characters/` | `ninja_sombrio.glb` | Inimigo ninja |
| `characters/` | `raposa_ninja.glb` | Inimiga raposa ninja |
| `characters/` | `porco_espinho.glb` | Porco-espinho bandido |
| `environment/` | `casa_vila.glb` | Casa tradicional com lanternas de pata |
| `environment/` | `templo_principal.glb` | Templo principal |
| `environment/` | `templo_enigmas.glb` | Torii com estátua de gato |
| `environment/` | `ponte_vermelha.glb` | Ponte arqueada vermelha |
| `environment/` | `ponte_madeira.glb` | Ponte de madeira |
| `environment/` | `dojo_treino.glb` | Dojô de obstáculos |
| `environment/` | `moinho_agua.glb` | Moinho com roda d’água |
| `environment/` | `torre_vigia.glb` | Torre de vigia com sino |
| `environment/` | `mercado_vila.glb` | Barraca de feira com toldo |
| `environment/` | `taverna.glb` | Cantina de peixes |
| `environment/` | `sakura_tree.glb` | Cerejeira |
| `environment/` | `cerca_madeira.glb` | Cerca modular |
| `props/` | `bau_tesouro.glb` | Baú de tesouro |
| `props/` | `alavanca_ferro.glb` | Alavanca |
| `props/` | `placa_missao.glb` | Placa de missões |
| `props/` | `mecanismo_elevador.glb` | Elevador de corda |
| `props/` | `alvo_treino.glb` | Alvo de treino |
| `props/` | `carrinho_peixes.glb` | Carrinho de peixes |
| `props/` | `lanterna_papel.glb` | Lanterna de papel com pata |
| `props/` | `moeda_pata.glb` | Moeda de pata |
| `props/` | `gema_azul.glb` | Gema azul |
| `props/` | `peixe_azul.glb` | Peixe |
| `props/` | `pocao_cura.glb` | Poção vermelha |
| `props/` | `pocao_energia.glb` | Poção azul |
| `props/` | `pergaminho.glb` | Pergaminho |
| `props/` | `shuriken.glb` | Shuriken de treino |
| `props/` | `chave_ouro.glb` | Chave de ouro |
| `props/` | `mapa_tesouro.glb` | Mapa do tesouro |
| `props/` | `vara_pesca.glb` | Vara de pesca |
| `props/` | `bomba_treino.glb` | Bomba de treino |
