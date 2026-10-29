import { asset } from '../../assetPath';
import MODEL_FILES from 'virtual:model-files';
/**
 * Every 3D asset the game knows by name. Files live in public/assets/models/<folder>/<name>.glb.
 * When a file is missing (or is not a valid GLB), the game draws its procedural version instead,
 * so new models can be dropped in one at a time without touching code.
 *
 * Names follow the Blender naming in the design brief (docs/REFORMULACAO.md).
 */
export type AssetFolder = 'characters' | 'environment' | 'props';

export interface AssetEntry {
  folder: AssetFolder;
  /** Physics for a loaded GLB: 'trimesh' for buildings, 'hull' for solid props, 'none' for decoration. */
  collider: 'trimesh' | 'hull' | 'none';
  description: string;
}

export const ASSETS = {
  // characters (Shinichi has its own rigged pipeline: public/assets/characters/shinichi.glb)
  mestre_lotus: { folder: 'characters', collider: 'none', description: 'Mentor: sábio idoso, chapéu de palha, quimono e cajado' },
  kiko: { folder: 'characters', collider: 'none', description: 'Inventor laranja com óculos de aviador' },
  sora: { folder: 'characters', collider: 'none', description: 'Comerciante tricolor de quimono' },
  taro: { folder: 'characters', collider: 'none', description: 'Rival cinza-escuro de faixa vermelha' },
  luna: { folder: 'characters', collider: 'none', description: 'Curandeira de traje lilás e cajado' },
  boku: { folder: 'characters', collider: 'none', description: 'Comerciante robusto com mochila grande' },
  hana: { folder: 'characters', collider: 'none', description: 'Cozinheira atrapalhada (chapéu de chef e avental)' },
  mestre_kuma: { folder: 'characters', collider: 'none', description: 'Urso monge: manto açafrão, faixa e contas' },
  roku: { folder: 'characters', collider: 'none', description: 'Guarda com armadura de lâminas, chapéu jingasa e lança de treino' },
  neko: { folder: 'characters', collider: 'none', description: 'Vizinha dorminhoca: pijama de bolinhas, touca e travesseiro' },
  tanuki: { folder: 'characters', collider: 'none', description: 'Tanuki com máscara, cauda listrada, folha e trouxa' },
  kuro: { folder: 'characters', collider: 'none', description: 'Gato preto misterioso de capuz e lenço roxo' },
  mochi: { folder: 'characters', collider: 'none', description: 'Vovó curvada com xale de tricô, óculos e bengala' },
  bigodes: { folder: 'characters', collider: 'none', description: 'Peixeiro de bigodão, bandana torcida e avental' },
  pipo: { folder: 'characters', collider: 'none', description: 'Filhote tricolor com cata-vento' },
  mimi: { folder: 'characters', collider: 'none', description: 'Ajudante da cantina: gata laranja de quimono azul e avental' },
  liria: { folder: 'characters', collider: 'none', description: 'Inventora cuidadosa: lenço, óculos, avental e prancheta' },
  kaito: { folder: 'characters', collider: 'none', description: 'Parkour: pelagem de pontas escuras, cachecol longo e faixas' },
  tsubaki: { folder: 'characters', collider: 'none', description: 'Guardiã do templo: hakama vermelha, camélia e naginata de madeira' },
  goro: { folder: 'characters', collider: 'none', description: 'Urso da fonte termal: casaco happi azul-petróleo, faixa na testa e bigode' },
  hinoki: { folder: 'characters', collider: 'none', description: 'Guardiã do Bosque Antigo: tigrada marrom, manto musgo, sobrancelhas e cajado' },
  fuji: { folder: 'characters', collider: 'none', description: 'Jardineira das glicínias: tigrada cinza, quimono lilás, avental e chapéu de palha' },
  general_hissui: { folder: 'characters', collider: 'none', description: 'Antagonista de armadura samurai' },
  ninja_sombrio: { folder: 'characters', collider: 'none', description: 'Inimigo ninja' },
  raposa_ninja: { folder: 'characters', collider: 'none', description: 'Inimiga raposa ninja' },
  porco_espinho: { folder: 'characters', collider: 'none', description: 'Porco-espinho bandido' },
  // environment
  casa_vila: { folder: 'environment', collider: 'trimesh', description: 'Casa tradicional com lanternas de pata' },
  templo_principal: { folder: 'environment', collider: 'trimesh', description: 'Templo principal' },
  templo_enigmas: { folder: 'environment', collider: 'trimesh', description: 'Torii com estátua de gato' },
  ponte_vermelha: { folder: 'environment', collider: 'trimesh', description: 'Ponte arqueada vermelha' },
  ponte_madeira: { folder: 'environment', collider: 'trimesh', description: 'Ponte de madeira' },
  dojo_treino: { folder: 'environment', collider: 'trimesh', description: 'Dojô de obstáculos' },
  moinho_agua: { folder: 'environment', collider: 'trimesh', description: 'Moinho com roda d’água' },
  torre_vigia: { folder: 'environment', collider: 'trimesh', description: 'Torre de vigia com sino' },
  mercado_vila: { folder: 'environment', collider: 'trimesh', description: 'Barraca de feira com toldo' },
  taverna: { folder: 'environment', collider: 'trimesh', description: 'Cantina de peixes' },
  sakura_tree: { folder: 'environment', collider: 'hull', description: 'Cerejeira' },
  cerca_madeira: { folder: 'environment', collider: 'hull', description: 'Cerca modular' },
  // props
  bau_tesouro: { folder: 'props', collider: 'none', description: 'Baú de tesouro' },
  alavanca_ferro: { folder: 'props', collider: 'none', description: 'Alavanca' },
  placa_missao: { folder: 'props', collider: 'none', description: 'Placa de missões' },
  mecanismo_elevador: { folder: 'props', collider: 'none', description: 'Elevador de corda' },
  alvo_treino: { folder: 'props', collider: 'none', description: 'Alvo de treino' },
  carrinho_peixes: { folder: 'props', collider: 'hull', description: 'Carrinho de peixes' },
  lanterna_papel: { folder: 'props', collider: 'none', description: 'Lanterna de papel com pata' },
  moeda_pata: { folder: 'props', collider: 'none', description: 'Moeda de pata' },
  gema_azul: { folder: 'props', collider: 'none', description: 'Gema azul' },
  peixe_azul: { folder: 'props', collider: 'none', description: 'Peixe' },
  pocao_cura: { folder: 'props', collider: 'none', description: 'Poção vermelha' },
  pocao_energia: { folder: 'props', collider: 'none', description: 'Poção azul' },
  pergaminho: { folder: 'props', collider: 'none', description: 'Pergaminho' },
  shuriken: { folder: 'props', collider: 'none', description: 'Shuriken de treino' },
  chave_ouro: { folder: 'props', collider: 'none', description: 'Chave de ouro' },
  mapa_tesouro: { folder: 'props', collider: 'none', description: 'Mapa do tesouro' },
  vara_pesca: { folder: 'props', collider: 'none', description: 'Vara de pesca' },
  bomba_treino: { folder: 'props', collider: 'none', description: 'Bomba de treino' },
} satisfies Record<string, AssetEntry>;

export type AssetName = keyof typeof ASSETS;

export function assetUrl(name: AssetName) {
  return asset(`assets/models/${ASSETS[name].folder}/${name}.glb`);
}

const PRESENT = new Set(MODEL_FILES);

/** Whether the model's file ships with the game (known when it was built: no request needed). */
export function assetFileExists(name: AssetName) {
  return PRESENT.has(`${ASSETS[name].folder}/${name}.glb`);
}
