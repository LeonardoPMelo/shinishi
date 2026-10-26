import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAudioSettings, type AudioBus } from '../audio/audioSettings';
import { useFamilySettings } from '../store/familySettings';
import { useUiSettings, AUTO_LADDER, reducedMotion } from '../store/uiSettings';
import { MISSIONS, MISSION_ORDER } from '../data/missions';
import { ITEMS } from '../data/items';
import { availableSteps } from '../systems/progression';
import { WorldMap } from './WorldMap';
import { CHAPTERS, NEXT_CHAPTER_TEASER } from '../data/campaign';
import { SKILLS, SKILL_ORDER, skillStars, nextStarAt } from '../data/skills';
import { SHOP_OFFERS, OFFERS_BY_ID, unitPrice } from '../data/shop';

function PanelFrame({ title, icon, children, onClose, wide }: { title: string; icon: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="panel-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`panel game-panel ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <header className="game-panel-head">
          <h2><span>{icon}</span> {title}</h2>
          <button className="panel-close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="game-panel-body">{children}</div>
      </div>
    </div>
  );
}

const CATEGORY_ICON: Record<string, string> = {
  principal: '⭐', secundária: '🤝', exploração: '🧭', treinamento: '🥋', investigação: '🔍', cômica: '😹', educativa: '🧮',
};

function MissionLog() {
  const progress = useGameStore((s) => s.progress);
  const trackMission = useGameStore((s) => s.trackMission);
  const ids = MISSION_ORDER.filter((id) => progress.missions[id]);
  const [selected, setSelected] = useState<string | null>(progress.tracked ?? ids[0] ?? null);
  const mission = selected ? MISSIONS[selected] : null;
  const mp = mission ? progress.missions[mission.id] : null;
  const available = mission ? availableSteps(mission, progress).map((s) => s.id) : [];
  const active = ids.filter((id) => progress.missions[id].status === 'active');
  const done = ids.filter((id) => progress.missions[id].status === 'done');

  if (ids.length === 0) {
    return <p className="empty-note">Nenhuma missão ainda. Procure moradores com um <b>!</b> dourado sobre a cabeça — a Chef Hana está precisando de ajuda!</p>;
  }

  return (
    <div className="log-layout">
      <div className="log-list">
        {active.length > 0 && <h3>Em andamento</h3>}
        {active.map((id) => (
          <button key={id} className={`log-item ${selected === id ? 'sel' : ''}`} onClick={() => setSelected(id)}>
            <span>{CATEGORY_ICON[MISSIONS[id].category]}</span> {MISSIONS[id].title}
            {progress.tracked === id && <em>seguindo</em>}
          </button>
        ))}
        {done.length > 0 && <h3>Concluídas</h3>}
        {done.map((id) => (
          <button key={id} className={`log-item done ${selected === id ? 'sel' : ''}`} onClick={() => setSelected(id)}>
            <span>✔</span> {MISSIONS[id].title}
          </button>
        ))}
        <p className="log-hint">Veja o progresso de cada capítulo em <b>Jornada</b> (K).</p>
      </div>
      {mission && mp && (
        <div className="log-detail">
          <span className="log-cat">{CATEGORY_ICON[mission.category]} {mission.category}</span>
          <h3>{mission.title}</h3>
          <p>{mission.description}</p>
          <ul className="log-steps">
            {mission.steps.map((st) => {
              const isDone = mp.steps.includes(st.id);
              const isNow = available.includes(st.id) && mp.status === 'active';
              if (!isDone && !isNow) return <li key={st.id} className="hidden-step">??? (desbloqueia depois)</li>;
              return (
                <li key={st.id} className={isDone ? 'done' : 'now'}>
                  {isDone ? '✔' : '▸'} {st.description}
                  {st.counter && !isDone && <b> {Math.min(progress.counters[st.counter.id] ?? 0, st.counter.goal)}/{st.counter.goal}</b>}
                </li>
              );
            })}
          </ul>
          <div className="log-rewards">
            Recompensa: ⭐ {mission.rewards.xp} XP · 🪙 {mission.rewards.coins}{mission.rewards.gems ? ` · 💎 ${mission.rewards.gems}` : ''}
            {mission.rewards.badges?.map((b) => <span key={b}> · 🏅 {b}</span>)}
          </div>
          {mp.status === 'done' && <p className="log-lesson">💡 {mission.lesson}</p>}
          {mp.status === 'active' && progress.tracked !== mission.id && (
            <button className="btn btn-secondary" onClick={() => trackMission(mission.id)}>📍 Seguir esta missão</button>
          )}
        </div>
      )}
    </div>
  );
}

function Inventory() {
  const progress = useGameStore((s) => s.progress);
  const player = useGameStore((s) => s.player);
  const entries = Object.entries(progress.inventory).filter(([id, n]) => n > 0 && ITEMS[id]);
  const [selected, setSelected] = useState<string | null>(entries[0]?.[0] ?? null);
  const item = selected ? ITEMS[selected] : null;
  return (
    <div className="inv-layout">
      <div>
        <h3>Itens</h3>
        {entries.length === 0 && <p className="empty-note">A mochila está vazia. Explore a vila!</p>}
        <div className="inv-grid">
          {entries.map(([id, n]) => (
            <button key={id} className={`inv-slot ${selected === id ? 'sel' : ''}`} onClick={() => setSelected(id)} title={ITEMS[id].name}>
              <span>{ITEMS[id].icon}</span>
              {n > 1 && <b>{n}</b>}
            </button>
          ))}
        </div>
        {item && (
          <div className="inv-detail">
            <strong>{item.icon} {item.name}</strong>
            <p>{item.description}</p>
            {item.band && (
              <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => {
                const st = useGameStore.getState();
                const wearing = !!st.progress.flags[`veste_${item.id}`];
                Object.keys(st.progress.flags).filter((f) => f.startsWith('veste_')).forEach((f) => st.setFlag(f, false));
                if (!wearing) st.setFlag(`veste_${item.id}`, true);
              }}>
                {progress.flags[`veste_${item.id}`] ? 'Tirar a faixa' : '🥷 Usar esta faixa'}
              </button>
            )}
          </div>
        )}
      </div>
      <div>
        <h3>Insígnias</h3>
        {player.badges.length === 0 && <p className="empty-note">Complete missões para ganhar insígnias.</p>}
        <div className="badge-list">
          {player.badges.map((b) => <span key={b} className="badge-chip">🏅 {b}</span>)}
        </div>
        <h3>Técnicas</h3>
        <ul className="tech-list">
          <li>👃 <b>Faro Ninja</b> (Q) — revela itens e segredos por alguns segundos.</li>
          <li>😺 <b>Miado Ninja</b> (R) — os moradores reagem.</li>
          <li className={progress.abilities.includes('double_jump') ? '' : 'locked'}>🌀 <b>Salto Duplo</b> — {progress.abilities.includes('double_jump') ? 'pule de novo no ar.' : 'aprenda com o Mestre Lótus.'}</li>
        </ul>
      </div>
    </div>
  );
}

/** Campaign chapters + "Saberes": what the player has practised, shown as stars that only go up. */
function Journey() {
  const progress = useGameStore((s) => s.progress);
  const player = useGameStore((s) => s.player);
  const learning = progress.learning ?? {};
  const practiceOpen = !!progress.flags.alvo_numeros;
  // the skill to suggest: least practised among the ones the game can train right now
  const suggestion = [...SKILL_ORDER]
    .filter((sk) => practiceOpen ? ['adicao', 'subtracao', 'multiplicacao', 'divisao'].includes(sk) : true)
    .sort((a, b) => (learning[a]?.solved ?? 0) + (learning[a]?.firstTry ?? 0) - ((learning[b]?.solved ?? 0) + (learning[b]?.firstTry ?? 0)))[0];

  return (
    <div className="journey">
      <section>
        <h3>Campanha</h3>
        {CHAPTERS.map((ch) => {
          const ids = MISSION_ORDER.filter((id) => MISSIONS[id].chapter === ch.id);
          const done = ids.filter((id) => progress.missions[id]?.status === 'done').length;
          return (
            <div key={ch.id} className="chapter-card">
              <div className="chapter-head">
                <span className="chapter-num">Capítulo {ch.id}</span>
                <b>{ch.title}</b>
                <span className="chapter-count">{done}/{ids.length}</span>
              </div>
              <div className="chapter-bar"><i style={{ width: `${(done / ids.length) * 100}%` }} /></div>
              <p>{ch.blurb}</p>
              <ul className="chapter-missions">
                {ids.map((id) => {
                  const mp = progress.missions[id];
                  const state = mp?.status === 'done' ? 'done' : mp ? 'active' : 'locked';
                  return (
                    <li key={id} className={state} title={state === 'locked' ? 'Ainda não descoberta' : MISSIONS[id].title}>
                      <span>{state === 'done' ? '✔' : state === 'active' ? '▸' : '?'}</span>
                      {state === 'locked' ? '???' : MISSIONS[id].title}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <p className="log-hint">{NEXT_CHAPTER_TEASER}</p>
      </section>
      <section>
        <h3>Saberes <span className="journey-gems">💎 {player.gems ?? 0} {(player.gems ?? 0) === 1 ? 'Gema' : 'Gemas'} do Saber</span></h3>
        <div className="skill-grid">
          {SKILL_ORDER.map((sk) => {
            const r = learning[sk];
            const stars = skillStars(r);
            const next = nextStarAt(r);
            return (
              <div key={sk} className={`skill-card ${stars === 0 ? 'fresh' : ''}`}>
                <div className="skill-head"><span className="skill-icon">{SKILLS[sk].icon}</span><b>{SKILLS[sk].name}</b></div>
                <div className="skill-stars" aria-label={`${stars} de 3 estrelas`}>{'★'.repeat(stars)}<span>{'★'.repeat(3 - stars)}</span></div>
                {next ? (
                  <div className="skill-bar" title={`${next.have}/${next.need} pontos para a próxima estrela`}><i style={{ width: `${(next.have / next.need) * 100}%` }} /></div>
                ) : <div className="skill-max">Mestre!</div>}
                <small>{r ? `${r.solved} ${r.solved === 1 ? 'acerto' : 'acertos'} · ${r.firstTry} de primeira` : SKILLS[sk].blurb}</small>
              </div>
            );
          })}
        </div>
        <p className="skill-note">
          Cada acerto vale um ponto, e acertar de primeira vale mais um. Errar nunca tira estrelas: errar é praticar!
          {suggestion && <> Que tal treinar <b>{SKILLS[suggestion].name}</b>? {practiceOpen
            ? 'O Alvo dos Números, ao lado do dojô, virou treino livre.'
            : 'Os moradores com ! dourado têm desafios, e o Alvo dos Números fica ao lado do dojô.'}</>}
        </p>
      </section>
    </div>
  );
}

function MapPanel() {
  return (
    <div className="map-wrap">
      <WorldMap size={Math.min(520, window.innerHeight - 200, window.innerWidth - 80)} labels />
      <div className="map-legend">
        <span><i className="dot gold" /> Missão disponível</span>
        <span><i className="dot blue" /> Objetivo atual</span>
        <span><i className="dot cream" /> Morador</span>
        <span><i className="arrow" /> Você</span>
      </div>
    </div>
  );
}

function Slider({ label, bus }: { label: string; bus: AudioBus | 'master' }) {
  const value = useAudioSettings((s) => s[bus]);
  const muted = useAudioSettings((s) => (bus === 'master' ? s.muted : s[`${bus}Muted` as const]));
  const setVolume = useAudioSettings((s) => s.setVolume);
  const toggleMute = useAudioSettings((s) => s.toggleMute);
  return (
    <div className="setting-row">
      <label>{label}</label>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => setVolume(bus, Number(e.target.value) / 100)} aria-label={`Volume: ${label}`} />
      <button className={`mute-btn ${muted ? 'on' : ''}`} onClick={() => toggleMute(bus === 'master' ? undefined : bus)} aria-label={muted ? `Ativar ${label}` : `Silenciar ${label}`}>
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}

export function Settings({ inGame }: { inGame: boolean }) {
  const family = useFamilySettings();
  const ui = useUiSettings();
  const resetGame = useGameStore((s) => s.resetGame);
  const [nameDraft, setNameDraft] = useState(family.childName);
  const [guardian, setGuardian] = useState(false);

  return (
    <div className="settings">
      <section>
        <h3>🎵 Áudio</h3>
        <Slider label="Geral" bus="master" />
        <Slider label="Música" bus="music" />
        <Slider label="Efeitos" bus="sfx" />
        <Slider label="Ambiente" bus="ambient" />
        <p className="setting-note">As músicas e sons atuais são <b>provisórios</b>, gerados por código. O jogo já aceita arquivos de áudio licenciados no lugar deles.</p>
      </section>
      <section>
        <h3>🎮 Controles</h3>
        <div className="setting-row">
          <label>Controles de toque</label>
          <select value={ui.touch} onChange={(e) => ui.setTouch(e.target.value as 'auto' | 'on' | 'off')}>
            <option value="auto">Automático</option>
            <option value="on">Sempre mostrar</option>
            <option value="off">Esconder</option>
          </select>
        </div>
        <div className="setting-row">
          <label>Qualidade gráfica</label>
          <select value={ui.quality} onChange={(e) => ui.setQuality(e.target.value as 'auto' | 'alta' | 'media' | 'baixa')}>
            <option value="auto">Automática{ui.quality === 'auto' ? ` (resolução ${Math.round(AUTO_LADDER[ui.autoLevel].scale * 100)}%)` : ''}</option>
            <option value="alta">Alta — brilho, sombras nítidas</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa — para computadores mais simples</option>
          </select>
        </div>
        <div className="setting-row">
          <label>Horário da vila</label>
          <select value={ui.timeOfDay} onChange={(e) => ui.setTimeOfDay(e.target.value as 'entardecer' | 'dia')}>
            <option value="entardecer">Entardecer (lanternas acesas)</option>
            <option value="dia">Dia</option>
          </select>
        </div>
        <div className="setting-row">
          <label>Sensibilidade da câmera</label>
          <input type="range" min={30} max={200} value={Math.round(ui.cameraSensitivity * 100)} onChange={(e) => ui.setCameraSensitivity(Number(e.target.value) / 100)} aria-label="Sensibilidade da câmera" />
        </div>
        <p className="setting-note">WASD mover · Shift correr · C (ou Ctrl) agachar em silêncio · Espaço pular · E interagir · Q faro · R miado · I mochila · J missões · K jornada · M mapa · Esc pausa · roda do mouse aproxima</p>
      </section>
      <section>
        <h3>🧩 Acessibilidade</h3>
        <div className="setting-row">
          <label>Movimento reduzido</label>
          <select value={ui.reduceMotion} onChange={(e) => ui.setReduceMotion(e.target.value as 'auto' | 'on' | 'off')}>
            <option value="auto">Seguir o sistema{ui.reduceMotion === 'auto' ? (reducedMotion('auto') ? ' (ligado)' : ' (desligado)') : ''}</option>
            <option value="on">Ligado — menos animação e brilho</option>
            <option value="off">Desligado</option>
          </select>
        </div>
        <div className="setting-row">
          <label>Tamanho do texto</label>
          <select value={String(ui.textScale)} onChange={(e) => ui.setTextScale(Number(e.target.value))}>
            <option value="1">Normal</option>
            <option value="1.15">Grande</option>
            <option value="1.3">Muito grande</option>
          </select>
        </div>
        <div className="setting-row">
          <label>Inverter câmera (cima/baixo)</label>
          <input type="checkbox" checked={ui.invertY} onChange={(e) => ui.setInvertY(e.target.checked)} />
        </div>
      </section>
      <section>
        <h3>👪 Para responsáveis</h3>
        {!guardian ? (
          <button className="btn btn-secondary" onClick={() => setGuardian(true)}>Abrir opções dos responsáveis</button>
        ) : (
          <>
            <div className="setting-row">
              <label>Nome da criança (opcional)</label>
              <input type="text" value={nameDraft} maxLength={24} onChange={(e) => setNameDraft(e.target.value)} onBlur={() => family.setChildName(nameDraft.trim())} placeholder="Deixe vazio para não usar" />
            </div>
            <div className="setting-row">
              <label>Arte de aniversário nas comemorações</label>
              <input type="checkbox" checked={family.birthdayArt} onChange={(e) => family.setBirthdayArt(e.target.checked)} />
            </div>
            <p className="setting-note">Nada pessoal aparece no jogo a menos que você ative aqui. Tudo fica salvo só neste navegador.</p>
            {inGame && (
              <button className="btn btn-ghost" onClick={() => {
                if (window.confirm('Apagar todo o progresso do jogo? Isso não pode ser desfeito.')) resetGame();
              }}>Apagar progresso</button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** A Sacola da Sora: spend gems on bands and potions; a little price-comparison question on the side. */
function Shop() {
  const gems = useGameStore((s) => s.player.gems ?? 0);
  const inventory = useGameStore((s) => s.progress.inventory);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [answered, setAnswered] = useState<null | 'single' | 'pack'>(null);
  const single = OFFERS_BY_ID.pocao_1;
  const pack = OFFERS_BY_ID.pocao_3;
  const buy = (id: string) => {
    const o = OFFERS_BY_ID[id];
    const r = useGameStore.getState().buyOffer(id);
    const name = ITEMS[o.item].name;
    if (r === 'ok') setNote({ text: o.qty > 1 ? `Comprado: ${o.qty}× ${name}! Está na mochila.` : `Comprado: ${name}! Está na mochila.`, good: true });
    else if (r === 'poor') setNote({ text: `Faltam ${o.price - gems} gema(s). Resolva desafios e missões para ganhar mais!`, good: false });
    else if (r === 'owned') setNote({ text: 'Você já tem essa faixa. Vista na mochila!', good: false });
  };
  const answer = (pick: 'single' | 'pack') => {
    if (answered) return;
    setAnswered(pick);
    useGameStore.getState().recordPractice('proporcoes', pick === 'pack', true);
  };
  return (
    <div className="shop">
      <div className="shop-head">
        <p>“Achados das minhas viagens! Aceito gemas. Minhocas, não.” <b>— Sora</b></p>
        <span className="shop-gems">💎 {gems}</span>
      </div>
      <div className="shop-grid">
        {SHOP_OFFERS.map((o) => {
          const it = ITEMS[o.item];
          const owned = !!o.once && (inventory[o.item] ?? 0) > 0;
          const short = gems < o.price;
          return (
            <div key={o.id} className={`shop-card ${owned ? 'owned' : ''}`}>
              <div className="shop-icon">{it.icon}{o.qty > 1 && <b>×{o.qty}</b>}</div>
              <strong>{it.name}</strong>
              <small>{o.pitch}</small>
              <button className={`btn ${owned ? 'btn-ghost' : short ? 'btn-secondary' : 'btn-primary'}`} disabled={owned} onClick={() => buy(o.id)}>
                {owned ? '✓ Já é sua' : short ? `💎 ${o.price} · faltam ${o.price - gems}` : `💎 ${o.price}`}
              </button>
            </div>
          );
        })}
      </div>
      {note && <p className={`shop-note ${note.good ? 'good' : ''}`}>{note.text}</p>}
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
    </div>
  );
}

export function GamePanels() {
  const panel = useGameStore((s) => s.panel);
  const phase = useGameStore((s) => s.phase);
  const openPanel = useGameStore((s) => s.openPanel);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const close = () => openPanel(null);

  if (panel === 'missions') return <PanelFrame title="Missões" icon="📜" onClose={close} wide><MissionLog /></PanelFrame>;
  if (panel === 'inventory') return <PanelFrame title="Mochila" icon="🎒" onClose={close} wide><Inventory /></PanelFrame>;
  if (panel === 'journey') return <PanelFrame title="Jornada" icon="📖" onClose={close} wide><Journey /></PanelFrame>;
  if (panel === 'map') return <PanelFrame title="Vila das Patas" icon="🗺️" onClose={close}><MapPanel /></PanelFrame>;
  if (panel === 'shop') return <PanelFrame title="Sacola da Sora" icon="🎒" onClose={close} wide><Shop /></PanelFrame>;
  if (panel === 'settings') return <PanelFrame title="Configurações" icon="⚙️" onClose={close}><Settings inGame /></PanelFrame>;

  if (phase === 'paused') {
    return (
      <div className="pause-overlay">
        <div className="pause-box panel">
          <div className="pause-art" />
          <h2>Pausado</h2>
          <p>Até os ninjas precisam de um cochilo.</p>
          <div className="pause-actions">
            <button className="btn btn-primary" onClick={resumeGame}>▶ Voltar ao jogo</button>
            <div className="pause-grid">
              <button className="btn btn-secondary" onClick={() => openPanel('missions')}>📜 Missões</button>
              <button className="btn btn-secondary" onClick={() => openPanel('inventory')}>🎒 Mochila</button>
              <button className="btn btn-secondary" onClick={() => openPanel('journey')}>📖 Jornada</button>
              <button className="btn btn-secondary" onClick={() => openPanel('map')}>🗺️ Mapa</button>
              <button className="btn btn-secondary" onClick={() => openPanel('settings')}>⚙️ Ajustes</button>
            </div>
            <button className="btn btn-ghost" onClick={() => useGameStore.setState({ phase: 'menu', panel: null })}>Sair para o menu (o progresso fica salvo)</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
