import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGameStore } from '../src/store/gameStore';
import { buy, sell, useItem, equip, unequip, withItem, type Bag } from '../src/systems/inventory';
import { missionState, offeredMissions } from '../src/systems/missionState';
import { pickInteractable, type Interactable } from '../src/game/systems/interaction';
import { sanitizeSave } from '../src/store/saveSanitize';
import { emptyProgress } from '../src/systems/progression';
import { MISSIONS } from '../src/data/missions';
import { ITEMS } from '../src/data/items';
import type { PlayerStats } from '../src/types';

/** Etapa 2 da expansão: the core systems (inventory, missions, interaction, save) and their regressions. */

const player: PlayerStats = { xp: 0, level: 1, rank: 'Aprendiz', coins: 0, gems: 0, hp: 100, maxHp: 100, completedMissions: [], badges: [] };
const bag = (over: Partial<PlayerStats> = {}, inventory: Record<string, number> = {}): Bag => ({
  player: { ...player, ...over },
  progress: { ...emptyProgress(), inventory },
});

describe('inventário: compras', () => {
  const potion = { item: 'pocao_energia', qty: 3, price: 5 };

  it('sem saldo, não compra e não muda nada', () => {
    const b = bag({ gems: 4 });
    const r = buy(b, potion);
    expect(r.result).toBe('poor');
    expect(r.bag).toBe(b);
  });

  it('com saldo, desconta o preço e entrega a quantidade', () => {
    const r = buy(bag({ gems: 7 }), potion);
    expect(r.result).toBe('ok');
    expect(r.bag.player.gems).toBe(2);
    expect(r.bag.progress.inventory.pocao_energia).toBe(3);
  });

  it('clique duplo numa faixa (item único) compra uma vez só', () => {
    const band = { item: 'faixa_azul', qty: 1, price: 4, once: true };
    const first = buy(bag({ gems: 20 }), band);
    const second = buy(first.bag, band);
    expect(second.result).toBe('owned');
    expect(second.bag.player.gems).toBe(16);
    expect(second.bag.progress.inventory.faixa_azul).toBe(1);
  });

  it('pode cobrar em moedas', () => {
    const r = buy(bag({ coins: 10, gems: 0 }), { ...potion, currency: 'coins' });
    expect(r.result).toBe('ok');
    expect(r.bag.player.coins).toBe(5);
  });

  it('oferta de item inexistente é recusada', () => {
    expect(buy(bag({ gems: 99 }), { item: 'nao_existe', qty: 1, price: 1 }).result).toBe('unknown');
    expect(buy(bag({ gems: 99 }), undefined).result).toBe('unknown');
  });
});

describe('inventário: venda, uso e equipamento', () => {
  it('vende consumíveis por moedas; itens de missão não se vendem', () => {
    const r = sell(bag({}, { pocao_energia: 2 }), 'pocao_energia', 2);
    expect(r.result).toBe('ok');
    expect(r.bag.player.coins).toBe(2 * ITEMS.pocao_energia.sellPrice!);
    expect(r.bag.progress.inventory.pocao_energia).toBeUndefined();
    expect(sell(bag({}, { receita: 1 }), 'receita').result).toBe('notSellable');
    expect(sell(bag({}, { pocao_energia: 1 }), 'pocao_energia', 2).result).toBe('none');
  });

  it('usar gasta um e devolve o efeito; sem o item, nada acontece', () => {
    const r = useItem(bag({}, { pocao_energia: 1 }), 'pocao_energia');
    expect(r.result).toBe('ok');
    expect(r.effect).toEqual({ kind: 'impulso', seconds: 10 });
    expect(r.bag.progress.inventory.pocao_energia).toBeUndefined();
    expect(useItem(r.bag, 'pocao_energia').result).toBe('none');
    expect(useItem(bag({}, { receita: 1 }), 'receita').result).toBe('notUsable');
  });

  it('o onigiri agora tem uso (impulso curto)', () => {
    expect(useItem(bag({}, { onigiri: 1 }), 'onigiri').effect).toEqual({ kind: 'impulso', seconds: 5 });
  });

  it('vestir troca a faixa do slot; só veste o que está na mochila', () => {
    let p = { ...emptyProgress(), inventory: { faixa_azul: 1, faixa_rosa: 1 } };
    p = equip(p, 'faixa_azul').progress;
    expect(p.equipped.faixa).toBe('faixa_azul');
    p = equip(p, 'faixa_rosa').progress;
    expect(p.equipped.faixa).toBe('faixa_rosa');
    expect(equip(p, 'faixa_verde').result).toBe('none');
    expect(equip(p, 'pocao_energia').result).toBe('notWearable');
    expect(unequip(p, 'faixa').equipped.faixa).toBeUndefined();
  });

  it('perder o último item vestido também o tira', () => {
    const p = equip({ ...emptyProgress(), inventory: { faixa_azul: 1 } }, 'faixa_azul').progress;
    expect(withItem(p, 'faixa_azul', -1).equipped.faixa).toBeUndefined();
  });

  it('não vende a faixa que está vestida', () => {
    const p = equip({ ...emptyProgress(), inventory: { faixa_azul: 1 } }, 'faixa_azul').progress;
    // faixas não têm preço de venda hoje; a regra vale para qualquer item vestível que venha a ter
    expect(sell({ player, progress: p }, 'faixa_azul').result).not.toBe('ok');
  });

  it('save antigo: a flag veste_<faixa> vira o slot e some', () => {
    const out = sanitizeSave({ progress: { flags: { veste_faixa_rosa: true, outra: true }, inventory: { faixa_rosa: 1 } } }, {
      player, baseAbilities: [], rankFor: () => 'Aprendiz',
    });
    expect(out.progress.equipped).toEqual({ faixa: 'faixa_rosa' });
    expect(out.progress.flags).toEqual({ outra: true });
  });

  it('todas as faixas vão no slot "faixa"', () => {
    for (const item of Object.values(ITEMS)) if (item.band) expect(item.slot, item.id).toBe('faixa');
  });
});

describe('missões: estados e recompensas', () => {
  const st = () => useGameStore.getState();
  beforeEach(() => {
    st().resetGame();
    useGameStore.setState({ phase: 'playing', celebrations: [] });
  });

  it('num jogo novo: peixes disponível (Hana oferece), uma do capítulo 2 bloqueada', () => {
    const p = st().progress;
    expect(missionState('peixes', p)).toBe('disponivel');
    const locked = Object.keys(MISSIONS).find((id) => missionState(id, p) === 'bloqueada');
    expect(locked).toBeDefined();
    expect(offeredMissions(p).map((o) => o.missionId)).toContain('peixes');
  });

  it('ativa → concluída, e a recompensa é paga uma única vez', () => {
    st().startMission('peixes');
    expect(missionState('peixes', st().progress)).toBe('ativa');
    st().completeMission('peixes');
    const after = { xp: st().player.xp, coins: st().player.coins, gems: st().player.gems, celebrations: st().celebrations.length };
    expect(missionState('peixes', st().progress)).toBe('concluida');
    st().completeMission('peixes');
    st().startMission('peixes');
    st().completeStep('peixes', 'talk_tofu');
    expect({ xp: st().player.xp, coins: st().player.coins, gems: st().player.gems, celebrations: st().celebrations.length }).toEqual(after);
    expect(st().player.completedMissions.filter((m) => m === 'peixes')).toHaveLength(1);
  });

  it('etapa fora de ordem não conta (precisa da anterior)', () => {
    st().startMission('peixes');
    st().completeStep('peixes', 'talk_kenzo');
    expect(st().progress.missions.peixes.steps).toEqual([]);
    st().completeStep('peixes', 'talk_tofu');
    st().completeStep('peixes', 'talk_kenzo');
    expect(st().progress.missions.peixes.steps).toEqual(['talk_tofu', 'talk_kenzo']);
  });

  it('comprar pela loja do store: saldo validado, clique duplo seguro', () => {
    useGameStore.setState({ player: { ...st().player, gems: 4 } });
    expect(st().buyOffer('faixa_azul')).toBe('ok');
    expect(st().buyOffer('faixa_azul')).toBe('owned');
    expect(st().buyOffer('pocao_3')).toBe('poor');
    expect(st().player.gems).toBe(0);
  });
});

describe('interação', () => {
  const at = (x: number, z: number, label: string | null = 'Falar', radius = 2): Interactable => ({
    id: `${x},${z}`, position: new THREE.Vector3(x, 0, z), radius, label: () => label, onInteract: () => undefined,
  });

  it('escolhe o alvo mais próximo dentro do alcance', () => {
    const r = pickInteractable([at(1.5, 0), at(0.8, 0), at(5, 0)], { x: 0, y: 0, z: 0 }, 'playing');
    expect(r?.item.id).toBe('0.8,0');
  });

  it('fora do alcance, ou em outro andar, não há interação', () => {
    expect(pickInteractable([at(3, 0)], { x: 0, y: 0, z: 0 }, 'playing')).toBeNull();
    expect(pickInteractable([at(1, 0)], { x: 0, y: 3, z: 0 }, 'playing')).toBeNull();
  });

  it('alvo sem ação agora (sem rótulo) é ignorado', () => {
    expect(pickInteractable([at(1, 0, null), at(1.5, 0)], { x: 0, y: 0, z: 0 }, 'playing')?.item.id).toBe('1.5,0');
  });

  it('durante diálogo, desafio, pausa ou painel, nada é interagível (sem sobreposição)', () => {
    for (const phase of ['dialogue', 'challenge', 'paused', 'panel', 'celebrating']) {
      expect(pickInteractable([at(1, 0)], { x: 0, y: 0, z: 0 }, phase)).toBeNull();
    }
  });
});
