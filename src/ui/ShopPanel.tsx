import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ITEMS } from '../data/items';
import { SHOPS_BY_ID, type ShopDef } from '../data/shops';
import { OFFERS_BY_ID as SORA_OFFERS, unitPrice } from '../data/shop';
import { checkCondition } from '../systems/progression';

/**
 * Any shop of the village (Etapa 6 da expansão): what it sells, with what each item is for and its price, and
 * (for shops that buy) a list of what you can sell. Every click gets a clear answer: bought, not enough money,
 * already yours, locked and why, sold. The rules are in systems/inventory.ts and the store.
 */

const money = (shop: ShopDef, n: number) => (shop.currency === 'gems' ? `💎 ${n}` : `🪙 ${n}`);

type Note = { text: string; good: boolean };

function BuyTab({ shop, setNote }: { shop: ShopDef; setNote: (n: Note) => void }) {
  const progress = useGameStore((s) => s.progress);
  const balance = useGameStore((s) => (shop.currency === 'gems' ? s.player.gems ?? 0 : s.player.coins));
  const buy = (offerId: string) => {
    const o = shop.offers.find((x) => x.id === offerId)!;
    const r = useGameStore.getState().buyOffer(offerId);
    const name = ITEMS[o.item].name;
    if (r === 'ok') setNote({ text: o.qty > 1 ? `Comprado: ${o.qty}× ${name}. Está na mochila.` : `Comprado: ${name}. Está na mochila.`, good: true });
    else if (r === 'poor') setNote({ text: `Faltam ${o.price - balance} ${shop.currency === 'gems' ? 'gema(s)' : 'moeda(s)'}. Missões e desafios dão mais!`, good: false });
    else if (r === 'owned') setNote({ text: `Você já tem: ${name}. ${ITEMS[o.item].slot ? 'Vista na mochila!' : ''}`, good: false });
    else if (r === 'locked') setNote({ text: o.lockedText ?? 'Ainda não está à venda.', good: false });
    // 'busy' (a double click) says nothing: the first click already answered
  };
  return (
    <div className="shop-grid">
      {shop.offers.map((o) => {
        const it = ITEMS[o.item];
        const locked = !checkCondition(o.when, progress);
        const owned = !!o.once && (progress.inventory[o.item] ?? 0) > 0;
        const short = balance < o.price;
        return (
          <div key={o.id} className={`shop-card ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}`}>
            <div className="shop-icon">{locked ? '🔒' : it.icon}{o.qty > 1 && <b>×{o.qty}</b>}</div>
            <strong>{it.name}</strong>
            {it.effectText && <span className="shop-effect">{it.effectText}</span>}
            <small>{locked ? o.lockedText : o.pitch}</small>
            <button
              className={`btn ${owned || locked ? 'btn-ghost' : short ? 'btn-secondary' : 'btn-primary'}`}
              disabled={owned || locked}
              onClick={() => buy(o.id)}
            >
              {owned ? '✓ Já é sua' : locked ? `🔒 ${money(shop, o.price)}` : short ? `${money(shop, o.price)} · faltam ${o.price - balance}` : money(shop, o.price)}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SellTab({ shop, setNote }: { shop: ShopDef; setNote: (n: Note) => void }) {
  const progress = useGameStore((s) => s.progress);
  const items = Object.entries(progress.inventory)
    .filter(([id, n]) => n > 0 && ITEMS[id] && shop.buys?.(ITEMS[id]))
    .map(([id, n]) => ({ item: ITEMS[id], n, worn: Object.values(progress.equipped).includes(id) }));
  const sell = (id: string) => {
    const r = useGameStore.getState().sellItem(id, 1);
    const it = ITEMS[id];
    if (r === 'ok') setNote({ text: `Vendido: ${it.name} por 🪙 ${it.sellPrice}.`, good: true });
    else if (r === 'worn') setNote({ text: `Você está usando ${it.name}. Tire na mochila antes de vender.`, good: false });
    else setNote({ text: 'Esse item não pode ser vendido aqui.', good: false });
  };
  return (
    <div className="sell-list">
      <p className="sell-hint">{shop.buysText}</p>
      {items.length === 0 && <p className="empty-note">Nada na mochila que o {shop.keeper} compre.</p>}
      {items.map(({ item, n, worn }) => (
        <div key={item.id} className="sell-row">
          <span className="sell-icon">{item.icon}</span>
          <span className="sell-name"><b>{item.name}</b> ×{n}{worn && <em> · vestido</em>}</span>
          <button className="btn btn-secondary" disabled={worn && n < 2} onClick={() => sell(item.id)}>
            Vender 1 · 🪙 {item.sellPrice}
          </button>
        </div>
      ))}
    </div>
  );
}

/** Sora's little price question (kept from before): which is cheaper per potion? */
function SoraQuiz() {
  const [answered, setAnswered] = useState<null | 'single' | 'pack'>(null);
  const single = SORA_OFFERS.pocao_1;
  const pack = SORA_OFFERS.pocao_3;
  const answer = (pick: 'single' | 'pack') => {
    if (answered) return;
    setAnswered(pick);
    useGameStore.getState().recordPractice('proporcoes', pick === 'pack', true);
  };
  return (
    <div className="shop-quiz">
      <strong>🤔 Pergunta da Sora:</strong> uma poção custa 💎 {single.price}; o pacote com {pack.qty} custa 💎 {pack.price}. Qual sai mais barato <i>por poção</i>?
      {!answered ? (
        <div className="shop-quiz-actions">
          <button className="btn btn-secondary" onClick={() => answer('single')}>A poção sozinha</button>
          <button className="btn btn-secondary" onClick={() => answer('pack')}>O pacote de {pack.qty}</button>
        </div>
      ) : (
        <p>
          {answered === 'pack' ? '✅ Isso! ' : '🌱 Quase! '}
          No pacote, cada poção sai por {pack.price} ÷ {pack.qty} ≈ {unitPrice(pack).toFixed(2).replace('.', ',')} gemas, menos que {unitPrice(single)} gemas.
          {' '}Mas só vale a pena se você for usar as {pack.qty}!
        </p>
      )}
    </div>
  );
}

export function ShopPanel() {
  const shopId = useGameStore((s) => s.shopId);
  const shop = SHOPS_BY_ID[shopId] ?? SHOPS_BY_ID.sora;
  const balance = useGameStore((s) => (shop.currency === 'gems' ? s.player.gems ?? 0 : s.player.coins));
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [note, setNote] = useState<Note | null>(null);
  return (
    <div className="shop" style={{ ['--shop-accent' as string]: shop.theme.accent, ['--shop-bg' as string]: shop.theme.bg }}>
      <div className="shop-head shop-themed">
        <p>“{shop.greeting}” <b>— {shop.keeper}</b></p>
        <span className="shop-gems">{money(shop, balance)}</span>
      </div>
      {shop.buys && (
        <div className="shop-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'buy'} className={`shop-tab ${tab === 'buy' ? 'on' : ''}`} onClick={() => setTab('buy')}>🛒 Comprar</button>
          <button role="tab" aria-selected={tab === 'sell'} className={`shop-tab ${tab === 'sell' ? 'on' : ''}`} onClick={() => setTab('sell')}>🪙 Vender</button>
        </div>
      )}
      {tab === 'buy' || !shop.buys ? <BuyTab shop={shop} setNote={setNote} /> : <SellTab shop={shop} setNote={setNote} />}
      {note && <p className={`shop-note ${note.good ? 'good' : ''}`} role="status">{note.text}</p>}
      {shop.id === 'sora' && <SoraQuiz />}
    </div>
  );
}

export const shopTitle = (shopId: string) => SHOPS_BY_ID[shopId] ?? SHOPS_BY_ID.sora;
