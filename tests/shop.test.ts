import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../src/store/gameStore';
import { SHOP_OFFERS, OFFERS_BY_ID, unitPrice } from '../src/data/shop';
import { ITEMS } from '../src/data/items';
import { NPCS_BY_ID, resolveDialogue } from '../src/data/npcs';

/** Sacola da Sora: gems are spent correctly, never go negative, bands are bought once. */

const st = useGameStore.getState;
beforeEach(() => {
  st().resetGame();
  useGameStore.setState({ phase: 'playing', celebrations: [] });
});

describe('loja de gemas', () => {
  it('toda oferta aponta para um item que existe, com preço e quantidade positivos', () => {
    for (const o of SHOP_OFFERS) {
      expect(ITEMS[o.item], o.id).toBeDefined();
      expect(o.price).toBeGreaterThan(0);
      expect(o.qty).toBeGreaterThan(0);
      if (o.once) expect(ITEMS[o.item].band, `${o.id} é cosmético`).toBeTruthy();
    }
  });

  it('comprar desconta as gemas e põe o item na mochila', () => {
    st().addGems(10);
    expect(st().buyOffer('faixa_azul')).toBe('ok');
    expect(st().player.gems).toBe(10 - OFFERS_BY_ID.faixa_azul.price);
    expect(st().progress.inventory.faixa_azul).toBe(1);
    expect(st().buyOffer('pocao_3')).toBe('ok');
    expect(st().progress.inventory.pocao_energia).toBe(3);
    expect(st().player.gems).toBe(10 - 4 - 5);
  });

  it('sem gemas suficientes nada muda', () => {
    st().addGems(3);
    expect(st().buyOffer('faixa_roxa')).toBe('poor');
    expect(st().player.gems).toBe(3);
    expect(st().progress.inventory.faixa_roxa).toBeUndefined();
  });

  it('cada faixa só é comprada uma vez; poções podem ser compradas de novo', () => {
    st().addGems(20);
    expect(st().buyOffer('faixa_verde')).toBe('ok');
    expect(st().buyOffer('faixa_verde')).toBe('owned');
    expect(st().player.gems).toBe(20 - 4);
    expect(st().buyOffer('pocao_1')).toBe('ok');
    expect(st().buyOffer('pocao_1')).toBe('ok');
    expect(st().progress.inventory.pocao_energia).toBe(2);
  });

  it('a pergunta da Sora: o pacote sai mais barato por poção, e a conta bate', () => {
    const one = OFFERS_BY_ID.pocao_1;
    const pack = OFFERS_BY_ID.pocao_3;
    expect(unitPrice(pack)).toBeLessThan(unitPrice(one));
    expect(unitPrice(pack)).toBeCloseTo(5 / 3);
    // but the pack is not a trick: buying 3 single potions really costs more
    expect(one.price * pack.qty).toBeGreaterThan(pack.price);
  });

  it('a Sora oferece a loja na conversa do dia a dia', () => {
    const r = resolveDialogue(NPCS_BY_ID.sora, st().progress);
    const opts = r ? r.tree[r.startId].options : [];
    expect(opts.some((o) => o.action === 'SHOP')).toBe(true);
    st().runActions('SHOP');
    expect(st().panel).toBe('shop');
  });
});
