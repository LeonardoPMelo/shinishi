# Áudio do Shinichi

**Situação (21/10/2026):** 25 efeitos e as 10 músicas já usam arquivos licenciados CC0 (Kenney e OpenGameArt; veja `CREDITOS.md`). Os demais sons continuam **provisórios**: são sintetizados por código e servem só para testar o jogo.

**Volume:** os arquivos costumam vir mais altos que a mistura do jogo. Depois de trocar um arquivo, ajuste o ganho dele em `src/audio/fileLevels.ts`, para que fique no mesmo volume do som que ele substitui.

Para trocar qualquer um deles por um arquivo de verdade (gravado por você ou com licença que permita o uso):

1. Coloque o arquivo na pasta certa, com o **nome exato** da lista abaixo:
   - efeitos: `public/assets/audio/sfx/<nome>.ogg` (também aceita `.mp3`, `.m4a`, `.wav` e `.webm`)
   - músicas: `public/assets/audio/music/<nome>.ogg` (tocam em loop)
2. Rode `npm run audio:manifest`. Isso atualiza o `manifest.json`. (Nas músicas, o silêncio no começo e no fim é ignorado na hora de repetir.)
3. Recarregue o jogo. O arquivo substitui o som sintetizado, e os sons que não tiverem arquivo continuam sintetizados.

**Licenças:** prefira CC0 (domínio público) ou CC-BY. Com CC-BY, anote o autor e o link em `CREDITOS.md`, nesta mesma pasta.
Não use sons de jogos, filmes ou animes conhecidos.

## Músicas (`music/`)

| Nome | Quando toca |
|---|---|
| `menu` | Tela inicial |
| `village` | Vila durante o dia a dia |
| `forest` | Floresta do Treinamento |
| `training` | Treino com o Mestre Lótus |
| `investigation` | Missões de investigação |
| `puzzle` | Desafios (contas, enigmas) |
| `emotional` | Conversas tristes ou delicadas |
| `festival` | Festival e comemorações |
| `comic` | Missões cômicas |
| `secret` | Jardim secreto e Kuro |

## Efeitos (`sfx/`)

| Grupo | Nomes |
|---|---|
| Shinichi | `step_grass`, `step_stone`, `step_wood`, `jump`, `double_jump`, `land`, `splash`, `player_meow`, `purr`, `dash`, `potion`, `faro`, `shuriken`, `denied` |
| Recompensas | `coin`, `gem`, `item`, `pickup_fish`, `chest`, `challenge_correct`, `challenge_wrong`, `wish` |
| Mundo | `target_hit`, `thwack`, `mechanism`, `temple_bell`, `ring`, `boom`, `poof`, `fizzle`, `boing`, `kick`, `goal`, `flop`, `fireworks`, `firework_pop`, `sizzle` |
| Ambiente | `bird`, `chime`, `chatter`, `giggle` |
| Vozes | `voice_meow`, `voice_meow_low`, `voice_meow_high`, `voice_squeak`, `voice_chitter`, `voice_grunt`, `voice_snore` |
| Interface | `ui_open`, `ui_close`, `ui_select`, `blip` (a "voz" do texto digitando) |

Os passos e as vozes ganham uma pequena variação de tom a cada vez que tocam, para não ficarem repetitivos.
