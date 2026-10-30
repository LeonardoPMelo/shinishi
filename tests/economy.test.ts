import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHOPS, SHOPS_BY_ID, ALL_OFFERS, ECONOMY_ITEMS, RABBIT_FRIENDS } from '../src/data/shops';
import { ITEMS } from '../src/data/items';
import { MISSIONS } from '../src/data/missions';
import { NPCS_BY_ID, resolveDialogue, availableOffer } from '../src/data/npcs';
import { OBJECTS_BY_ID, TALL_ROCK } from '../src/data/world';
import { useGameStore, REPEAT_BUY_MS } from '../src/store/gameStore';
import { sanitizeSave } from '../src/store/saveSanitize';
import { faroTimes, jumpMultiplier, nearestPaw, screenBearing, FARO, FARO_LONG, SALTO_JUMP, BOOST_JUMP } from '../src/systems/gear';
import { canFeed, feedRabbit, makeRabbit, FEED, rabbitStep, threatRadius, RABBIT, type Cat } from '../src/game/fauna/brains';
import { applyItemEffect } from '../src/game/systems/itemEffects';
import { abilityState, now } from '../src/game/systems/playerState';
import { emptyProgress } from '../src/systems/progression';
import type { DialogueTree } from '../src/types';

/** Etapa 6 da expansão: shops, items and the economy. */

const st = () => useGameStore.getState();
const give = (coins: number, gems = 0) => useGameStore.setState((s) => ({ player: { ...s.player, coins, gems } }));
const done = (...ids: string[]) =>
  useGameStore.setState((s) => ({
    progress: { ...s.progress, missions: { ...s.progress.missions, ...Object.fromEntries(ids.map((id) => [id, { status: 'done' as const, steps: MISSIONS[id].steps.map((x) => x.id) }])) } },
  }));
/** performance.now() moves on by `ms` (the double-click guard reads it). */
let clock = 1000;
const later = (ms = REPEAT_BUY_MS + 1) => (clock += ms);

beforeEach(() => {
  st().resetGame();
  useGameStore.setState({ phase: 'playing', celebrations: [] });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  later();
});

describe('catálogo', () => {
  it('cada item novo tem uma função clara: se usa, se veste, ou alimenta os coelhos', () => {
    for (const it of ECONOMY_ITEMS) {
      expect(it.effectText, it.id).toBeTruthy();
      expect(!!it.use || !!it.slot || it.id === 'petisco_atum', it.id).toBe(true);
      expect(it.sellPrice, it.id).toBeGreaterThan(0);
    }
  });

  it('cada loja tem especialidade, moeda e ofertas de itens que existem; ids não se repetem', () => {
    expect(SHOPS.map((s) => s.id)).toEqual(['peixaria', 'armazem', 'sora']);
    const ids = SHOPS.flatMap((s) => s.offers.map((o) => o.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SHOPS) for (const o of s.offers) expect(ITEMS[o.item], o.id).toBeDefined();
    expect(SHOPS_BY_ID.peixaria.currency).toBe('coins');
    expect(SHOPS_BY_ID.sora.currency).toBe('gems');
  });

  it('não dá para ganhar dinheiro comprando e vendendo de volta', () => {
    for (const o of Object.values(ALL_OFFERS).filter((x) => x.currency === 'coins')) {
      expect((ITEMS[o.item].sellPrice ?? 0) * o.qty, o.id).toBeLessThan(o.price);
    }
  });

  it('o pacote de petiscos sai mais barato por unidade (vale a pena só se usar todos)', () => {
    const one = ALL_OFFERS.pex_petisco_1;
    const pack = ALL_OFFERS.pex_petisco_3;
    expect(pack.price / pack.qty).toBeLessThan(one.price / one.qty);
  });

  it('cada loja tem um balcão na vila que a abre', () => {
    expect(OBJECTS_BY_ID.balcao_peixaria.actions).toBe('SHOP:peixaria');
    expect(OBJECTS_BY_ID.balcao_armazem.actions).toBe('SHOP:armazem');
    st().runActions('SHOP:armazem');
    expect(st().shopId).toBe('armazem');
    expect(st().panel).toBe('shop');
  });
});

describe('comprar', () => {
  it('com saldo: tira o dinheiro certo e põe na mochila; sem saldo: nada muda', () => {
    give(10);
    expect(st().buyOffer('pex_petisco_3')).toBe('ok');
    expect(st().player.coins).toBe(5);
    expect(st().progress.inventory.petisco_atum).toBe(3);
    later();
    give(4);
    expect(st().buyOffer('pex_petisco_3')).toBe('poor');
    expect(st().player.coins).toBe(4);
    expect(st().progress.inventory.petisco_atum).toBe(3);
  });

  it('um clique duplo compra uma vez só; um segundo clique de verdade compra de novo', () => {
    give(20);
    expect(st().buyOffer('pex_onigiri')).toBe('ok');
    expect(st().buyOffer('pex_onigiri')).toBe('busy');
    expect(st().progress.inventory.onigiri).toBe(1);
    expect(st().player.coins).toBe(17);
    later();
    expect(st().buyOffer('pex_onigiri')).toBe('ok');
    expect(st().progress.inventory.onigiri).toBe(2);
  });

  it('o que é liberado pela história fica trancado antes (e não cobra nada)', () => {
    give(100);
    expect(st().buyOffer('arm_mochila')).toBe('locked');
    expect(st().buyOffer('pex_peixe')).toBe('locked');
    expect(st().player.coins).toBe(100);
    done('mapa');
    expect(st().buyOffer('arm_mochila')).toBe('ok');
    later();
    // equipment is bought once
    expect(st().buyOffer('arm_mochila')).toBe('owned');
    expect(st().player.coins).toBe(65);
  });

  it('a Sacola da Sora cobra em gemas, não em moedas', () => {
    give(50, 4);
    expect(st().buyOffer('sora_sininho')).toBe('ok');
    expect(st().player.gems).toBe(0);
    expect(st().player.coins).toBe(50);
  });
});

describe('vender', () => {
  it('o Boku compra equipamento e comida, mas não colecionáveis nem itens de missão; o Bigodes só comida', () => {
    const boku = SHOPS_BY_ID.armazem.buys!;
    const bigodes = SHOPS_BY_ID.peixaria.buys!;
    expect(boku(ITEMS.coleira_faro)).toBe(true);
    expect(boku(ITEMS.onigiri)).toBe(true);
    expect(boku(ITEMS.pata_dourada)).toBe(false);
    expect(boku(ITEMS.pergaminho_fundacao)).toBe(false);
    expect(bigodes(ITEMS.petisco_atum)).toBe(true);
    expect(bigodes(ITEMS.coleira_faro)).toBe(false);
    expect(SHOPS_BY_ID.sora.buys).toBeUndefined();
  });

  it('vender paga o preço de venda; o item vestido não se vende sem tirar', () => {
    give(0);
    st().addItem('coleira_faro', 1);
    expect(st().equipItem('coleira_faro')).toBe('ok');
    expect(st().sellItem('coleira_faro')).toBe('worn');
    st().unequipSlot('coleira');
    expect(st().sellItem('coleira_faro')).toBe('ok');
    expect(st().player.coins).toBe(ITEMS.coleira_faro.sellPrice);
    expect(st().progress.inventory.coleira_faro ?? 0).toBe(0);
  });
});

describe('o que os itens fazem', () => {
  it('Coleira do Faro: faro mais longo e recarga mais curta só enquanto vestida', () => {
    const p = emptyProgress();
    expect(faroTimes(p)).toEqual(FARO);
    const worn = { ...p, inventory: { coleira_faro: 1 }, equipped: { coleira: 'coleira_faro' } };
    expect(faroTimes(worn)).toEqual(FARO_LONG);
    expect(FARO_LONG.duration).toBeGreaterThan(FARO.duration);
    expect(FARO_LONG.cooldown).toBeLessThan(FARO.cooldown);
    // the bell collar is only for show
    expect(faroTimes({ ...p, inventory: { coleira_sininho: 1 }, equipped: { coleira: 'coleira_sininho' } })).toEqual(FARO);
  });

  it('Peixe Grelhado e Poção: as molas não se somam, vale a maior', () => {
    expect(jumpMultiplier(false, false)).toBe(1);
    expect(jumpMultiplier(false, true)).toBe(SALTO_JUMP);
    expect(jumpMultiplier(true, false)).toBe(BOOST_JUMP);
    expect(jumpMultiplier(true, true)).toBe(Math.max(SALTO_JUMP, BOOST_JUMP));
  });

  it('nenhuma comida ou poção sobe a pedra alta sem o salto duplo (o portão da Etapa 3 continua valendo)', () => {
    // single jump measured: 1.51 m at the top; the jump force squares into height; the capsule rides up ~0.38 m
    const apex = (k: number) => 1.51 * k * k + 0.38;
    expect(apex(SALTO_JUMP)).toBeLessThan(TALL_ROCK.h);
    expect(apex(BOOST_JUMP)).toBeLessThan(TALL_ROCK.h);
  });

  it('comer ou beber gasta um e liga o efeito (pulo por 20 s; faro na hora)', () => {
    st().addItem('peixe_grelhado', 1);
    const r = st().useItem('peixe_grelhado');
    expect(r.result).toBe('ok');
    applyItemEffect(r.effect!, 'peixe_grelhado');
    expect(abilityState.jumpUntil).toBeGreaterThan(now() + 19);
    expect(st().progress.inventory.peixe_grelhado ?? 0).toBe(0);
    st().addItem('cha_erva', 1);
    const t = st().useItem('cha_erva');
    applyItemEffect(t.effect!, 'cha_erva');
    expect(abilityState.faroRequest).toBe(14);
    abilityState.faroRequest = 0;
  });

  it('a bússola da mochila aponta a Pata Dourada mais perto que falta e esquece as já achadas', () => {
    const p = emptyProgress();
    const first = nearestPaw(p, 0, 0)!;
    expect(first).not.toBeNull();
    const found = { ...p, flags: { [`got_${first.id.replace('paw_', 'paw_')}`]: true } };
    const next = nearestPaw(found, 0, 0)!;
    expect(next.id).not.toBe(first.id);
    const all = { ...p, flags: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`got_paw_${i}`, true])) };
    expect(nearestPaw(all, 0, 0)).toBeNull();
  });

  it('a seta da bússola: com a câmera olhando para o norte, norte é para cima e leste é para a direita', () => {
    expect(screenBearing(0, -5, 0)).toBeCloseTo(0);
    expect(screenBearing(5, 0, 0)).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(screenBearing(0, 5, 0))).toBeCloseTo(Math.PI);
  });

  it('petisco: perto e sem correr, o coelho come e confia por um minuto (até em pé)', () => {
    const rng = () => 0.5;
    const r = makeRabbit(0, 0, { x: 0, z: 0, r: 3 }, rng);
    const standing: Cat = { x: 1.8, z: 0, crouch: false, speed: 0 };
    expect(canFeed(r, standing)).toBe(true);
    expect(canFeed(r, { ...standing, speed: 6 })).toBe(false);
    expect(canFeed(r, { ...standing, x: FEED.reach + 0.5 })).toBe(false);
    feedRabbit(r);
    expect(r.trust).toBe(FEED.trust);
    // the same rabbit cannot be fed again while it trusts the cat (seen in play: one rabbit counted twice)
    r.mode = 'sniff';
    expect(canFeed(r, standing)).toBe(false);
    // with a treat in the bag, a walking cat can come within feeding reach without scaring a rabbit
    const calm = makeRabbit(0, 0, { x: 0, z: 0, r: 3 }, rng);
    const env0 = { ground: () => true, free: () => true };
    for (let i = 0; i < 30; i++) rabbitStep(calm, 0.1, { x: 2.0, z: 0, crouch: false, speed: 2, treat: true }, env0, rng);
    expect(calm.fleeing).toBe(false);
    expect(FEED.reach).toBeGreaterThan(threatRadius(RABBIT.threat, { x: 0, z: 0, crouch: false, speed: 2, treat: true }));
    // without one, the same walk at 2 m scares it
    const shy = makeRabbit(0, 0, { x: 0, z: 0, r: 3 }, rng);
    for (let i = 0; i < 30; i++) rabbitStep(shy, 0.1, { x: 2.0, z: 0, crouch: false, speed: 2 }, env0, rng);
    expect(shy.fleeing || shy.mode === 'alert').toBe(true);
    // a walking (not running) cat next to it does not scare it
    const env = { ground: () => true, free: () => true };
    for (let i = 0; i < 60; i++) rabbitStep(r, 0.1, { x: 0.8, z: 0, crouch: false, speed: 2 }, env, rng);
    expect(r.fleeing).toBe(false);
  });
});

describe('recompensas e missão ligadas às lojas', () => {
  it('missões antigas agora apresentam os itens novos (o peixe do Bigodes, o chá da Luna)', () => {
    expect(MISSIONS.peixe_fujao.rewards.items).toEqual({ peixe_grelhado: 1 });
    expect(MISSIONS.pocao.rewards.items).toEqual({ cha_erva: 1 });
  });

  it('Amigo dos Coelhos: Pipo → petiscos em 3 coelhos → Pipo, com a recompensa paga uma vez', () => {
    done('peixes');
    expect(availableOffer(NPCS_BY_ID.pipo, st().progress)).toBe('coelhos');
    const talk = () => {
      const d = resolveDialogue(NPCS_BY_ID.pipo, st().progress)!;
      const walk = (tree: DialogueTree, id: string): void => {
        const opt = tree[id].options[0];
        st().runActions(opt.action);
        if (opt.nextNodeId) walk(tree, opt.nextNodeId);
      };
      walk(d.tree, d.startId);
    };
    talk();
    expect(st().progress.missions.coelhos.steps).toEqual(['ouvir']);
    for (let i = 0; i < RABBIT_FRIENDS; i++) st().bumpCounter('coelhos_alimentados');
    expect(st().progress.missions.coelhos.steps).toContain('alimentar');
    const coins = st().player.coins;
    talk();
    expect(st().progress.missions.coelhos.status).toBe('done');
    expect(st().player.coins).toBe(coins + MISSIONS.coelhos.rewards.coins);
    expect(st().progress.inventory.petisco_atum).toBe(2);
    // finishing again pays nothing
    st().completeMission('coelhos');
    st().completeStep('coelhos', 'contar');
    expect(st().player.coins).toBe(coins + MISSIONS.coelhos.rewards.coins);
  });
});

describe('o save guarda tudo isso', () => {
  it('itens novos, coleira e mochila vestidas sobrevivem ao recarregar; vestir algo que não existe é descartado', () => {
    const progress = {
      ...emptyProgress(),
      inventory: { coleira_faro: 1, mochila_exploradora: 1, petisco_atum: 4, item_fantasma: 2 },
      equipped: { coleira: 'coleira_faro', mochila: 'mochila_exploradora', faixa: 'item_fantasma' },
    };
    const s = sanitizeSave({ player: st().player, progress }, { player: st().player, baseAbilities: ['faro', 'miado'], rankFor: () => 'Aprendiz' });
    expect(s.progress.inventory).toMatchObject({ coleira_faro: 1, mochila_exploradora: 1, petisco_atum: 4 });
    expect(s.progress.equipped).toEqual({ coleira: 'coleira_faro', mochila: 'mochila_exploradora' });
  });
});
