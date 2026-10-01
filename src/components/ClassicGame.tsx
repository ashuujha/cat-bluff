import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CatCard } from "./CatCard";
import { Dialog } from "./Dialog";
import { ClassicPrivacy, ClassicRules } from "./ClassicHelp";
import { DECK, loadDeckArt, type DeckArt } from "../game/classic-cards";
import {
  applyClassic,
  botDecision,
  classicView,
  declaration,
  newClassicState,
  RANKS,
  RANK_NAMES,
  type ClassicAction,
  type ClassicState,
  type ClassicView,
  type TurnRecord,
} from "../game/classic-rules";
import { practiceActor, practiceRecap } from "../game/practice-presentation";
import { classicInvite } from "../game/classic-invite";
import { playGameCue, playMeme, reactMeme } from "../game/sound";
import { useClassic52 } from "../hooks/useClassic52";
import { useCatChaos } from "../hooks/useCatChaos";
import type { Action } from "../midnight/classic52";
const stages = {
  preparing: "Preparing your move",
  proving: "Proving privately",
  balancing: "Approve in Lace",
  submitting: "Sending your move",
  confirming: "Waiting for confirmation",
};
export function ClassicGame({
  online,
  sound,
  gameSound,
  onHome,
  onFriends,
  onPractice,
  onBusy,
}: {
  online: boolean;
  sound: boolean;
  gameSound: boolean;
  onHome: () => void;
  onFriends: () => void;
  onPractice: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const live = useClassic52(online);
  const engine = useRef<ClassicState | null>(null);
  const [practice, setPractice] = useState<ClassicView | null>(null),
    [players, setPlayers] = useState(2);
  const [selected, setSelected] = useState<number[]>([]),
    [error, setError] = useState(""),
    [art, setArt] = useState<DeckArt | null>(null),
    [artError, setArtError] = useState("");
  const [pace, setPace] = useState<"step" | "auto">("step");
  const [reviewing, setReviewing] = useState(false);
  const [recap, setRecap] = useState(
    "Your hand is ready. Start by reading the required rank.",
  );
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const [sortHand, setSortHand] = useState<"rank" | "deal">("rank");
  const [expandedHand, setExpandedHand] = useState(false);
  const [inspected, setInspected] = useState<number | null>(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [showGuide, setShowGuide] = useState(
    () => localStorage.getItem("cat-bluff-guide") !== "done",
  );
  const [modal, setModal] = useState<"rules" | "privacy" | "invite" | null>(
      null,
    ),
    [copied, setCopied] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const view = online ? live.view : practice;
  useCatChaos({
    scope: online
      ? `classic:${live.contract}:${live.room}`
      : "classic-practice",
    round: view?.round,
    play: view ? (view.latest?.number ?? 0) : undefined,
    pending: view?.phase === "respond",
    sound,
  });
  const busy = online && live.busy;
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  const status = online
    ? Number(live.snapshot?.state.status ?? -1)
    : view
      ? 3
      : -1;
  const seat = view?.viewer ?? -1;
  const name = (i: number) => view?.players[i]?.name ?? `Player ${i + 1}`;
  const active = !!view && (!online || status >= 3);
  const practiceReview = !online && reviewing;
  const playing =
    active && !practiceReview && view.phase === "play" && view.turn === seat;
  const responding =
    active &&
    !practiceReview &&
    view.phase === "respond" &&
    view.responder === seat;
  const opening =
    active && view.phase === "reveal" && view.latest?.actor === seat;
  const transferring =
    online &&
    status === 3 &&
    view?.phase === "transfer" &&
    live.snapshot?.owners.some(
      (owner, i) => owner === 4 && live.snapshot!.custodians[i] === seat,
    );
  const link = live.room
    ? classicInvite(location.origin, live.room, live.contract)
    : "";
  const lastOutcome = useRef("");
  const fetchArt = () => {
    setArtError("");
    void loadDeckArt()
      .then(setArt)
      .catch(() =>
        setArtError(
          "The cat artwork could not load. Your cards and ranks are safe.",
        ),
      );
  };
  useEffect(fetchArt, []);
  useEffect(() => {
    setSelected([]);
    setError("");
    setInspected(null);
    setInspectMode(false);
  }, [view?.round, view?.latest?.number, view?.phase, online]);
  useEffect(() => {
    if (!busy) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - live.started) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [busy, live.started]);
  useEffect(() => {
    const r = view?.latest;
    if (!r) return;
    const key = `${view.round}:${r.number}:${r.outcome}`;
    if (lastOutcome.current === key) return;
    lastOutcome.current = key;
    if (r.outcome === "bluff" || r.outcome === "truth") {
      playGameCue("penalty", gameSound);
      const reaction = r.outcome === "bluff" ? "crying" : "polite";
      reactMeme(
        reaction,
        false,
        r.outcome === "bluff"
          ? "Caught. The pile is yours."
          : "The claim was true. Oops.",
        1100,
      );
      if (sound)
        setTimeout(() => {
          if (localStorage.getItem("cat-bluff-sound") !== "off")
            playMeme(reaction, 750);
        }, 300);
    }
  }, [
    view?.round,
    view?.latest?.number,
    view?.latest?.outcome,
    gameSound,
    sound,
  ]);
  const lastWin = useRef("");
  useEffect(() => {
    if (view?.phase !== "finished") return;
    const key = `${view.round}:${view.winner}`;
    if (lastWin.current === key) return;
    lastWin.current = key;
    playGameCue("victory", gameSound);
  }, [view?.phase, view?.round, view?.winner, gameSound]);
  const lastTurn = useRef("");
  useEffect(() => {
    if (!view || view.phase !== "play" || view.turn !== seat) return;
    const key = `${view.round}:${view.latest?.number ?? 0}`;
    if (lastTurn.current === key) return;
    lastTurn.current = key;
    playGameCue("turn", gameSound);
  }, [
    view?.round,
    view?.phase,
    view?.turn,
    view?.latest?.number,
    seat,
    gameSound,
  ]);
  function deal() {
    engine.current = newClassicState(players, (engine.current?.round ?? 0) + 1);
    setPractice(classicView(engine.current));
    setSelected([]);
    setError("");
    setReviewing(false);
    setRecap("Your hand is ready. Start by reading the required rank.");
    playGameCue("flick", gameSound);
  }
  function local(seat: number, action: ClassicAction) {
    if (!engine.current) return;
    const before = classicView(engine.current);
    engine.current = applyClassic(engine.current, seat, action);
    const next = classicView(engine.current);
    setPractice(next);
    setRecap(
      seat === 0 && action.kind === "play"
        ? `You put down ${action.cards.map((id) => `${DECK[id].rank}${DECK[id].suit}`).join(" · ")} and claimed ${declaration(action.cards.length, before.rank)}. The bots see your claim, not your cards.`
        : practiceRecap(before, next, seat, action.kind),
    );
    setReviewing(
      next.latest?.outcome !== "pending" &&
        next.latest !== undefined &&
        next.phase !== "finished",
    );
  }
  function animateSubmission() {
    if (
      document.documentElement.dataset.fx === "off" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const source = document.querySelector<HTMLElement>(
      ".classic-hand-card.is-selected",
    );
    const target = document.querySelector<HTMLElement>(
      ".classic-pile .pile-cards",
    );
    if (!source || !target) return;
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const card = document.createElement("span");
    card.className = "flying-cat-back";
    card.setAttribute("aria-hidden", "true");
    card.textContent = "CAT BLUFF";
    Object.assign(card.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    });
    document.body.append(card);
    card
      .animate(
        [
          { transform: "translate(0,0) rotate(-4deg) scale(1)", opacity: 1 },
          {
            transform: `translate(${to.left + to.width / 2 - from.left - from.width / 2}px,${to.top + to.height / 2 - from.top - from.height / 2}px) rotate(7deg) scale(.8)`,
            opacity: 0.8,
          },
        ],
        { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" },
      )
      .finished.then(
        () => card.remove(),
        () => card.remove(),
      );
  }
  function advanceBot() {
    if (online || !engine.current || reviewing) return;
    const seat = practiceActor(classicView(engine.current));
    if (seat === null || seat === 0) return;
    try {
      const action = botDecision(classicView(engine.current, seat));
      if (action.kind === "call") playGameCue("bluff", gameSound);
      if (action.kind === "play") playGameCue("flick", gameSound);
      if (action.kind === "reveal") playGameCue("reveal", gameSound);
      local(seat, action);
    } catch {
      setError(
        "The practice turn could not finish. Deal a new round to try again.",
      );
    }
  }
  useEffect(() => {
    if (
      online ||
      !practice ||
      pace !== "auto" ||
      !pageVisible ||
      modal ||
      practice.phase === "finished"
    )
      return;
    if (reviewing) {
      const timer = setTimeout(() => setReviewing(false), 6500);
      return () => clearTimeout(timer);
    }
    if (practiceActor(practice) === 0) return;
    const expectedState = engine.current;
    const timer = setTimeout(() => {
      if (engine.current === expectedState) advanceBot();
    }, 3500);
    return () => clearTimeout(timer);
  }, [practice, online, pace, reviewing, pageVisible, modal, gameSound]);
  async function act(action: Action) {
    setError("");
    if (action.kind === "call") playGameCue("bluff", gameSound);
    if (action.kind === "play") {
      animateSubmission();
      playGameCue("flick", gameSound);
    }
    if (action.kind === "reveal") playGameCue("reveal", gameSound);
    if (online) {
      if (await live.act(action)) setSelected([]);
    } else {
      try {
        local(0, action as ClassicAction);
        setSelected([]);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "That move could not finish.",
        );
      }
    }
  }
  function card(id: number, small = false) {
    const c = DECK[id];
    return (
      <CatCard
        small={small}
        face={{
          ...c,
          image: art?.[id] ?? "/memes/polite.jpg",
          quote: art ? "trust issues included" : "artwork loading",
        }}
      />
    );
  }
  const history = view?.history ?? [];
  function recordText(r: TurnRecord) {
    if (r.outcome === "passed")
      return "Everyone trusted. Cards stay face down.";
    if (r.outcome === "truth")
      return `Truth! ${name(r.receiver!)} takes all ${r.pileSize} cards.`;
    if (r.outcome === "bluff")
      return `Caught! ${name(r.receiver!)} takes all ${r.pileSize} cards.`;
    if (r.challenger !== undefined)
      return `${name(r.challenger)} called BLUFF!`;
    return r.passed.length
      ? `${r.passed.length} trusted · awaiting a response`
      : "Trust… or call BLUFF?";
  }
  let headline = "Bring your suspicious friends.",
    hint = "52 meme cats. Four of every rank. One very risky pile.";
  if (view && active) {
    if (view.phase === "finished") {
      headline = `${name(view.winner!)} won the round!`;
      hint = "No cats left. Absolutely no trust left. Deal another?";
    } else if (practiceReview) {
      headline = "A moment for the evidence.";
      hint =
        "Read the result below. Continue when you’re ready for the next turn.";
    } else if (playing) {
      headline = `Your turn. Claim ${RANK_NAMES[view.rank]}s.`;
      hint =
        "Choose the actual cards from your hand below. The required rank is fixed; you decide whether your claim is true.";
    } else if (responding) {
      headline = `${name(view.latest!.actor)} says ${declaration(view.latest!.quantity, view.latest!.rank)}.`;
      hint = `The actual cards are hidden. Trust that claim or call BLUFF; ${view.pileSize} cards are at stake.`;
    } else if (view.phase === "reveal") {
      headline = opening
        ? "Time to show those cats."
        : `${name(view.latest!.actor)} must open the play.`;
      hint =
        "Only the challenged cards are revealed. The rest of the pile stays hidden.";
    } else if (view.phase === "transfer") {
      headline = "The whole pile has a new home.";
      hint = `${name(view.latest!.receiver!)} takes ${view.latest!.pileSize} cards. Contributors return them privately before the next turn.`;
    } else if (view.phase === "respond") {
      headline = `${name(view.responder)} is deciding.`;
      hint =
        "Everyone gets a response turn. The pile stays face down unless someone calls BLUFF.";
    } else {
      headline = `${name(view.turn)} is choosing cards.`;
      hint = `The next claim is ${RANK_NAMES[view.rank]}s. Watch their hand count.`;
    }
  }
  const connect = (
    <button
      className="button primary"
      disabled={live.wallet.status === "connecting"}
      onClick={() => void live.wallet.connect()}
    >
      {live.wallet.status === "connecting" ? "Connecting…" : "Connect Lace"}
    </button>
  );
  return (
    <section className="classic-shell">
      <div className="table-toolbar">
        <span className="mode-chip">
          <i />
          {online ? "Friends · Midnight Preprod" : "Practice · local bots"}
        </span>
        <div>
          {online && live.room && (
            <button className="text-button" onClick={() => setModal("invite")}>
              Invite friends ↗
            </button>
          )}
          {!online && (
            <button className="text-button" onClick={onFriends}>
              Play with friends ↗
            </button>
          )}
          <button className="text-button" onClick={() => setModal("rules")}>
            Rules
          </button>
          <button className="text-button" disabled={busy} onClick={onHome}>
            Leave table
          </button>
        </div>
      </div>
      {!online && (
        <div className="practice-pacing">
          <div className="pace-options" role="group" aria-label="Practice pace">
            <button
              aria-pressed={pace === "step"}
              onClick={() => setPace("step")}
            >
              Step by step
            </button>
            <button
              aria-pressed={pace === "auto"}
              onClick={() => setPace("auto")}
            >
              Relaxed auto
            </button>
          </div>
          <p>
            {pace === "step"
              ? "You advance every bot move. Nothing rushes past."
              : "Bots take 3.5 seconds. Results stay for 6.5 seconds. Your choices never time out."}
          </p>
        </div>
      )}
      {(error || (online && live.error)) && (
        <p className="notice error" role="alert">
          {error || live.error}
        </p>
      )}
      {online && live.readError && (
        <p className="notice" role="status">
          {live.readError}{" "}
          <button className="text-button" onClick={() => void live.refresh()}>
            Refresh table
          </button>
        </p>
      )}
      {busy && (
        <div className="classic-progress" role="status">
          <span className="spinner" />
          <div>
            <strong>{stages[live.stage]}</strong>
            <span>
              {elapsed}s elapsed · Keep this tab open. Your move is confirmed
              before the table changes.
            </span>
          </div>
        </div>
      )}
      {!view && !online ? (
        <div className="classic-welcome">
          <div className="welcome-cat">
            <img src="/memes/huh.jpg" alt="Huh Cat eyeing the table" />
            <span>i trust nobody.</span>
          </div>
          <span className="eyebrow">THE 52-CAT SOCIAL CLUB</span>
          <h1>
            Small lies.
            <br />
            Big pile.
          </h1>
          <p>
            Get rid of your cards. Call out a liar.
            <br />
            Get it wrong? Every cat in the pile is yours.
          </p>
          <fieldset className="player-picker">
            <legend>How many at the table?</legend>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                aria-pressed={players === n}
                onClick={() => setPlayers(n)}
              >
                {n} players{" "}
                <small>
                  {n === 2 ? "26 each" : n === 3 ? "18 / 17 / 17" : "13 each"}
                </small>
              </button>
            ))}
          </fieldset>
          {players === 2 && (
            <p className="classic-deduction">
              Two-player twist: you can work out the other starting hand. Which
              cards they play stays hidden.
            </p>
          )}
          <button className="button primary" onClick={deal}>
            Deal the cats ↗
          </button>
          <small>
            You play against {players - 1} {players === 2 ? "bot" : "bots"}. No
            wallet or blockchain in practice.
          </small>
        </div>
      ) : null}
      {online && !view ? (
        <div className="classic-welcome">
          <img
            className="lobby-meme"
            src="/memes/polite.jpg"
            alt="Polite Cat waiting for friends"
          />
          <span className="eyebrow">PRIVATE HANDS. PUBLIC SIDE-EYE.</span>
          <h1>
            Save your
            <br />
            friends a seat.
          </h1>
          <p>Create a room. Send the invite. Start with 2–4 players.</p>
          <button className="text-button learn-link" onClick={onPractice}>
            Learn in one hand · no wallet needed ↗
          </button>
          {live.wallet.status !== "connected" ? (
            connect
          ) : live.contract ? (
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void act(live.room ? { kind: "join" } : { kind: "create" })
              }
            >
              {live.room ? "Join this table" : "Create a room"}
            </button>
          ) : (
            <p className="notice">
              This site needs a Classic 52 contract address before live rooms
              can open. Check VITE_CLASSIC_CONTRACT_ADDRESS in the deployment.
            </p>
          )}
          <details className="classic-setup">
            <summary>Set up live play</summary>
            <p>
              Classic 52 uses contract V4. Deploy once, then publish its address
              to the site. Each player needs Lace on Preprod with tDUST and a
              working proof server.
            </p>
            <p>
              Use a local prover for private table keys. A bridge forwarding to
              a remote prover shares those keys with that service.
            </p>
            {live.wallet.status === "connected" ? (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void live.deploy()}
              >
                Deploy Classic 52 with Lace
              </button>
            ) : (
              connect
            )}
            {live.contract && (
              <>
                <label>
                  Classic 52 contract
                  <input
                    readOnly
                    value={live.contract}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <small>
                  Save this address as VITE_CLASSIC_CONTRACT_ADDRESS when
                  deploying the site.
                </small>
              </>
            )}
          </details>
        </div>
      ) : null}
      {view && online && status < 3 ? (
        <div className="classic-setup-table">
          <span className="eyebrow">
            ROUND {view.round || 1} · {view.players.length} / 4 SEATS
          </span>
          <h1>
            {status === 0
              ? "The gang’s assembling."
              : status === 1
                ? "Shuffle. Don’t peek."
                : "Your private deal."}
          </h1>
          <div className="lobby-room-code">
            <span>PRIVATE ROOM</span>
            <strong>{live.room.slice(0, 8).toUpperCase()}</strong>
            <button
              className="button secondary"
              onClick={() => setModal("invite")}
            >
              Copy invite link ↗
            </button>
          </div>
          <div className="classic-seats">
            {Array.from({ length: 4 }, (_, i) => view.players[i] ?? null).map(
              (p, i) =>
                p ? (
                  <div
                    key={p.id}
                    className={
                      Number(live.snapshot!.state.step) === i && status > 0
                        ? "seat active"
                        : "seat"
                    }
                  >
                    <img
                      src={
                        [
                          "/memes/polite.jpg",
                          "/memes/huh.jpg",
                          "/memes/pop.png",
                          "/memes/crying.png",
                        ][i]
                      }
                      alt=""
                    />
                    <strong>{p.name}</strong>
                    <small>{i === 0 ? "Host" : "Ready"}</small>
                  </div>
                ) : (
                  <button
                    className="seat empty-seat"
                    key={`empty-${i}`}
                    onClick={() => setModal("invite")}
                  >
                    + Invite a friend <small>Seat {i + 1}</small>
                  </button>
                ),
            )}
          </div>
          {status === 0 ? (
            <>
              <p>
                {view.players.length < 2
                  ? "Invite at least one friend to start."
                  : "Ready whenever you are. Two, three, or four players can start."}
              </p>
              {view.players.length === 2 && (
                <p className="classic-deduction">
                  With two players, each starting hand can be inferred from the
                  other. Invite a third friend for more hidden-hand uncertainty.
                </p>
              )}
              <div className="classic-actions">
                <button
                  className="button secondary"
                  onClick={() => setModal("invite")}
                >
                  Invite friends ↗
                </button>
                {seat === 0 ? (
                  <button
                    className="button primary"
                    disabled={busy || view.players.length < 2}
                    onClick={() => void act({ kind: "start" })}
                  >
                    Start round · {view.players.length} players
                  </button>
                ) : seat < 0 ? (
                  live.wallet.status === "connected" ? (
                    <button
                      className="button primary"
                      disabled={busy || view.players.length >= 4}
                      onClick={() => void act({ kind: "join" })}
                    >
                      Join this table
                    </button>
                  ) : (
                    connect
                  )
                ) : (
                  <p>Waiting for the host to start.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <ol className="deal-progress">
                <li className={status === 1 ? "current" : "complete"}>
                  1. Everyone shuffles privately
                </li>
                <li className={status === 2 ? "current" : ""}>
                  2. Everyone releases the deal
                </li>
                <li>3. Only you open your hand</li>
              </ol>
              <p>
                {name(Number(live.snapshot!.state.step))}’s turn · player{" "}
                {Number(live.snapshot!.state.step) + 1} of {view.players.length}
              </p>
              {seat === Number(live.snapshot!.state.step) ? (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void act({ kind: status === 1 ? "shuffle" : "deal" })
                  }
                >
                  {status === 1
                    ? "Shuffle privately"
                    : "Release the private deal"}
                </button>
              ) : (
                <p>Keep this tab open. Your turn follows in seat order.</p>
              )}
              <small>
                Setup needs one shuffle and one deal proof per player. No
                service deals the hands for you.
              </small>
            </>
          )}
          {seat < 0 && status > 0 && (
            <p className="notice">
              This round has started. Connect with the wallet and browser used
              to join, or ask for a new table.
            </p>
          )}
          {seat < 0 && status === 0 && view.players.length >= 4 && (
            <p className="notice" role="status">
              This room is full. Ask a friend for a new invitation.
            </p>
          )}
        </div>
      ) : null}
      {view && active ? (
        <>
          {online && live.wallet.status !== "connected" && (
            <div className="notice" role="status">
              Lace is disconnected. Reconnect with the same wallet and browser
              to resume your private hand. {connect}
            </div>
          )}
          {!online && (
            <div className="practice-coach">
              <div className="practice-coach-copy" role="status">
                <span className="eyebrow">
                  {practiceReview
                    ? "WHAT JUST HAPPENED"
                    : "YOUR PRACTICE COMPANION"}
                </span>
                <p>{recap}</p>
                {showGuide && (
                  <p className="coach-tip">
                    {practiceReview
                      ? "The pile and hand counts are updated. You can also revisit this result in the activity feed."
                      : view.phase === "play" && playing
                        ? `Required rank: ${RANK_NAMES[view.rank]}s. Tap one or more cards in your hand. The table will hear only how many ${RANK_NAMES[view.rank]}s you claim.`
                        : view.phase === "respond" && responding
                          ? `${name(view.latest!.actor)} claims ${declaration(view.latest!.quantity, view.latest!.rank)}. Their real cards stay hidden unless you call BLUFF. If they lied, they take the pile; if they told the truth, you take it.`
                          : view.phase === "reveal"
                            ? "Only this play is revealed. All other hidden cards stay hidden."
                            : "Watch the claim, then let the next cat act. Reactions are random, never evidence."}
                  </p>
                )}
              </div>
              <div className="coach-actions">
                {practiceReview ? (
                  <button
                    className="button primary"
                    onClick={() => setReviewing(false)}
                  >
                    Got it · next turn →
                  </button>
                ) : practiceActor(view) !== null &&
                  practiceActor(view) !== 0 ? (
                  <button className="button secondary" onClick={advanceBot}>
                    {view.phase === "reveal"
                      ? `See ${name(practiceActor(view)!)}’s reveal`
                      : view.phase === "respond"
                        ? `See ${name(practiceActor(view)!)}’s response`
                        : `See ${name(practiceActor(view)!)}’s play`}{" "}
                    →
                  </button>
                ) : null}
                <button
                  className="text-button"
                  onClick={() => {
                    setShowGuide(!showGuide);
                    localStorage.setItem(
                      "cat-bluff-guide",
                      showGuide ? "done" : "show",
                    );
                  }}
                >
                  {showGuide ? "Hide tips" : "Show tips"}
                </button>
              </div>
            </div>
          )}
          <div className="classic-seats" aria-label="Players and hand sizes">
            {view.players.map((p, i) => (
              <div
                className={`seat ${(view.phase === "play" && view.turn === i) || (view.phase === "respond" && view.responder === i) ? "active" : ""} ${seat === i ? "you" : ""}`}
                key={p.id}
              >
                <img
                  src={
                    [
                      "/memes/polite.jpg",
                      "/memes/huh.jpg",
                      "/memes/pop.png",
                      "/memes/crying.png",
                    ][i]
                  }
                  alt=""
                />
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {p.count} {p.count === 1 ? "cat" : "cats"}
                    {p.count === 0 && view.phase !== "finished"
                      ? " · final claim"
                      : p.count === 1
                        ? " · one away!"
                        : ""}
                  </span>
                </div>
                {seat === i && <small>YOU</small>}
              </div>
            ))}
          </div>
          <div className={`classic-board phase-${view.phase}`}>
            <div className="rank-sign">
              <span>REQUIRED RANK</span>
              <b>{RANKS[view.rank]}</b>
              <small>next {RANKS[(view.rank + 1) % 13]}</small>
            </div>
            <div className="classic-turn" aria-live="polite">
              {view.phase === "finished" && (
                <img className="winner-cat" src="/memes/pop.png" alt="" />
              )}
              <span className="eyebrow">
                ROUND {view.round} ·{" "}
                {view.phase === "finished"
                  ? "SETTLED"
                  : `TURN ${view.phase === "play" ? history.length + 1 : history.length}`}
              </span>
              <h1>{headline}</h1>
              <p>{hint}</p>
              {view.latest && view.phase !== "play" && (
                <div className="claim-bubble">
                  <small>{view.latest.actor === seat ? "YOUR CLAIM" : "WHAT THEY CLAIMED"}</small>
                  <strong>
                    {name(view.latest.actor)} says: “I played{" "}
                    {declaration(view.latest.quantity, view.latest.rank)}.”
                  </strong>
                  <span>
                    {view.latest.revealed
                      ? "A challenge revealed this turn’s actual cards below."
                      : "The actual cards are face-down. Only a BLUFF call reveals them."}
                  </span>
                </div>
              )}
              {playing && !online && (
                <button
                  className="button secondary choose-cards-jump"
                  onClick={() =>
                    document.getElementById("hand-title")?.scrollIntoView({
                      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "instant"
                        : "smooth",
                      block: "start",
                    })
                  }
                >
                  {selected.length
                    ? `Review ${selected.length} selected ${selected.length === 1 ? "card" : "cards"} ↓`
                    : "Choose the cards you’ll play ↓"}
                </button>
              )}
              {view.latest?.challenger !== undefined &&
                (view.phase === "reveal" || view.phase === "transfer") && (
                  <span className="bluff-stamp">BLUFF!</span>
                )}
              {responding && (
                <div className="classic-actions response-actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void act({ kind: "pass" })}
                  >
                    Trust the claim
                  </button>
                  <button
                    className="button primary bluff-button"
                    disabled={busy}
                    onClick={() => void act({ kind: "call" })}
                  >
                    BLUFF!
                  </button>
                </div>
              )}
              {opening && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void act({ kind: "reveal" })}
                >
                  {online ? "Prove & reveal this play" : "Reveal this play"}
                </button>
              )}
              {transferring && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void act({ kind: "transfer" })}
                >
                  Return pile cards privately
                </button>
              )}
              {view.phase === "finished" && (!online || seat === 0) && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    online ? void act({ kind: "start" }) : deal()
                  }
                >
                  Play again ↗
                </button>
              )}
              {view.phase === "finished" && online && seat !== 0 && (
                <p>Waiting for the host to deal another round.</p>
              )}
            </div>
            <div
              className={`classic-pile ${view.pileSize > 15 ? "big-pile" : ""}`}
              aria-label={`${view.pileSize} cards in the central pile`}
            >
              <div className="pile-cards">
                {view.pileSize > 0 ? (
                  <>
                    {[0, 1, 2].slice(0, Math.min(3, view.pileSize)).map((n) => (
                      <div
                        key={n}
                        style={{
                          transform: `rotate(${n * 9 - 9}deg) translate(${n * 3}px,${n * -2}px)`,
                        }}
                      >
                        <CatCard back small />
                      </div>
                    ))}
                  </>
                ) : (
                  <span className="empty-pile">
                    no cats
                    <br />
                    yet.
                  </span>
                )}
              </div>
              <b>{view.pileSize}</b>
              <span>CATS AT STAKE</span>
            </div>
            {view.phase === "transfer" &&
              view.latest?.receiver !== undefined && (
                <span
                  className="penalty-flight"
                  aria-hidden="true"
                  style={
                    {
                      "--flight-x": `${(view.latest.receiver - (view.players.length - 1) / 2) * 100}px`,
                    } as CSSProperties
                  }
                >
                  <CatCard back small />
                </span>
              )}
          </div>
          <p className="chaos-note">
            Cat Chaos · reactions are random. They do not reveal anyone’s cards.
          </p>
          {view.latest?.revealed && (
            <div className="classic-result" role="status">
              <div>
                <span className="eyebrow">
                  {view.latest.outcome === "bluff"
                    ? "CAUGHT BLUFFING"
                    : "THE CLAIM WAS TRUE"}
                </span>
                <p>{recordText(view.latest)}</p>
              </div>
              <div className="revealed-cats">
                {view.latest.revealed.map((id) => (
                  <span
                    key={id}
                    title={`${DECK[id].name} · ${DECK[id].rank}${DECK[id].suit}`}
                  >
                    {card(id, true)}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="classic-bottom">
            <section className="classic-hand" aria-labelledby="hand-title">
              <div className="hand-heading">
                <div>
                  <span className="eyebrow">FOR YOUR EYES ONLY</span>
                  <h2 id="hand-title">Your {view.hand.length} cats.</h2>
                </div>
                <span>Only you can see your hand</span>
              </div>
              {seat >= 0 && view.hand.length > 0 && (
                <div className="hand-tools">
                  <button
                    className="text-button"
                    aria-pressed={sortHand === "rank"}
                    onClick={() =>
                      setSortHand(sortHand === "rank" ? "deal" : "rank")
                    }
                  >
                    Sort: {sortHand === "rank" ? "rank" : "dealt order"} ↕
                  </button>
                  <button
                    className="text-button"
                    aria-expanded={expandedHand}
                    onClick={() => setExpandedHand(!expandedHand)}
                  >
                    {expandedHand ? "Compact hand" : "Expand hand"}
                  </button>
                  {playing && (
                    <button
                      className="text-button inspect-toggle"
                      aria-pressed={inspectMode}
                      onClick={() => {
                        setInspectMode(!inspectMode);
                        setInspected(null);
                      }}
                    >
                      {inspectMode ? "Choose cards" : "Inspect cards"}
                    </button>
                  )}
                </div>
              )}
              {playing && (
                <div className="classic-playbar play-controls">
                  <div className="selection-summary" role="status">
                    <strong>
                      {selected.length
                        ? `You will claim: ${declaration(selected.length, view.rank)}`
                        : `Claim ${RANK_NAMES[view.rank]}s this turn`}
                    </strong>
                    <span>
                      The table sets the rank. You choose the actual cards and
                      how many to put down.
                    </span>
                  </div>
                  <div className="selection-review">
                    <span className="selection-label">Actually playing (private)</span>
                    <div
                      className="selected-tray"
                      aria-label="Your selected cards, kept private"
                    >
                      {selected.length ? (
                        selected.map((id) => (
                          <button
                            key={id}
                            className="selected-card-chip"
                            aria-label={`Remove ${DECK[id].rank} of ${DECK[id].suitName} from selection`}
                            disabled={busy}
                            onClick={() =>
                              setSelected((cards) =>
                                cards.filter((card) => card !== id),
                              )
                            }
                          >
                            {DECK[id].rank}
                            {DECK[id].suit}
                            <span aria-hidden="true">×</span>
                          </button>
                        ))
                      ) : (
                        <span className="selection-empty">
                          Your picks will appear here.
                        </span>
                      )}
                    </div>
                    <button
                      className="text-button clear-selection"
                      disabled={!selected.length || busy}
                      onClick={() => setSelected([])}
                    >
                      Clear selection
                    </button>
                  </div>
                  <button
                    className="button primary submit-selection"
                    disabled={!selected.length || busy || inspectMode}
                    aria-label={
                      selected.length
                        ? `Place ${selected.length} cards face-down and claim ${declaration(selected.length, view.rank)}`
                        : "Select cards from your hand first"
                    }
                    onClick={() =>
                      void act({ kind: "play", cards: [...selected] })
                    }
                  >
                    {selected.length
                      ? `Place face-down · claim ${declaration(selected.length, view.rank)} ↗`
                      : "Choose cards first"}
                  </button>
                </div>
              )}
              {seat >= 0 && view.hand.length > 0 && (
                <p className="hand-interaction-hint" id="hand-interaction-hint">
                  {playing
                    ? inspectMode
                      ? "Preview mode: tap a cat to enlarge it. Choose cards to return to selecting."
                      : "Tap any cards to select them. Tap again to undo. Swipe or expand to see more."
                    : "Tap a cat to inspect it. You can select cards when it’s your turn."}
                </p>
              )}
              {artError && (
                <p role="alert">
                  {artError}{" "}
                  <button className="text-button" onClick={fetchArt}>
                    Retry artwork
                  </button>
                </p>
              )}
              {seat < 0 ? (
                <p>
                  Connect using the wallet and browser used to join this table
                  to see your hand.
                </p>
              ) : view.hand.length === 0 ? (
                <p className="empty-hand">
                  No cats left.
                  {view.phase === "finished"
                    ? " Round settled."
                    : " Your final claim still needs to survive."}
                </p>
              ) : (
                <div
                  className={`classic-hand-grid ${expandedHand ? "is-expanded" : ""}`}
                  role="region"
                  aria-label="Your private cards"
                  aria-describedby="hand-interaction-hint"
                  tabIndex={0}
                >
                  {[...view.hand]
                    .sort(sortHand === "rank" ? (a, b) => a - b : () => 0)
                    .map((id) => (
                      <button
                        key={id}
                        className={`classic-hand-card hand-card ${selected.includes(id) ? "is-selected" : ""}`}
                        aria-label={`${DECK[id].rank} of ${DECK[id].suitName}, ${DECK[id].name}`}
                        aria-pressed={selected.includes(id)}
                        disabled={busy}
                        onClick={() => {
                          if (!playing || inspectMode) {
                            setInspected(id);
                            return;
                          }
                          setSelected((cards) =>
                            cards.includes(id)
                              ? cards.filter((card) => card !== id)
                              : [...cards, id],
                          );
                        }}
                      >
                        {card(id, true)}
                        {playing && !inspectMode && (
                          <span className="selection-dot" aria-hidden="true">
                            {selected.includes(id) ? "✓" : "+"}
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              )}
              {inspected !== null && view.hand.includes(inspected) && (
                <div className="card-inspect">
                  <div className="inspect-art">{card(inspected)}</div>
                  <div>
                    <span className="eyebrow">PRIVATE CARD</span>
                    <strong>
                      {DECK[inspected].rank} of {DECK[inspected].suitName}
                    </strong>
                    <p>{DECK[inspected].name} · only visible to you.</p>
                    <button
                      className="text-button"
                      onClick={() => setInspected(null)}
                    >
                      Close preview ×
                    </button>
                  </div>
                </div>
              )}
            </section>
            <aside className="classic-history">
              <span className="eyebrow">THE TABLE REMEMBERS</span>
              <h2>Who said what.</h2>
              {!history.length ? (
                <p>
                  No alibis yet. You’re all innocent.
                  <br />
                  For now.
                </p>
              ) : (
                <ol>
                  {[...history]
                    .reverse()
                    .slice(0, 12)
                    .map((r) => (
                      <li key={r.number}>
                        <span className="history-number">
                          {r.number.toString().padStart(2, "0")}
                        </span>
                        <div>
                          <strong>
                            {name(r.actor)} · {declaration(r.quantity, r.rank)}
                          </strong>
                          {r.challenger !== undefined && (
                            <span>{name(r.challenger)} → BLUFF!</span>
                          )}
                          <small>{recordText(r)}</small>
                          {r.revealed && (
                            <details>
                              <summary>
                                Revealed cards ({r.revealed.length})
                              </summary>
                              <p>
                                {r.revealed
                                  .map(
                                    (id) =>
                                      `${DECK[id].rank}${DECK[id].suit} ${DECK[id].name}`,
                                  )
                                  .join(" · ")}
                              </p>
                            </details>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              )}
            </aside>
          </div>
        </>
      ) : null}
      <div className="classic-footnotes">
        <button className="text-button" onClick={() => setModal("privacy")}>
          What stays private?
        </button>
        {online && live.result && (
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://${live.wallet.networkId}.midnightexplorer.com/transactions/0x${live.result.txId.replace(/^0x/, "")}`}
          >
            Confirmed at block {live.result.blockHeight} ↗
          </a>
        )}
        {online && live.room && (
          <button
            className="text-button"
            disabled={busy}
            onClick={live.clearRoom}
          >
            Leave room / create another
          </button>
        )}
      </div>
      {modal === "rules" && (
        <Dialog
          title="Small rules. Big trust issues."
          onClose={() => setModal(null)}
        >
          <ClassicRules />
        </Dialog>
      )}
      {modal === "privacy" && (
        <Dialog
          title="Private cats. Verifiable play."
          onClose={() => setModal(null)}
        >
          <ClassicPrivacy />
        </Dialog>
      )}
      {modal === "invite" && (
        <Dialog title="Invite your accomplices." onClose={() => setModal(null)}>
          <p>
            Send this link to friends. Each uses their own Lace wallet and
            browser. Start with two, three, or four players.
          </p>
          <label>
            Private table invitation
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
          </label>
          <button
            className="button primary"
            onClick={() => {
              void navigator.clipboard
                .writeText(link)
                .then(() => setCopied(true))
                .catch(() =>
                  setError("Select and copy the invitation link manually."),
                );
            }}
          >
            {copied ? "Copied!" : "Copy invitation ↗"}
          </button>
          <p>Keep your browser data. It holds your private table key.</p>
        </Dialog>
      )}
    </section>
  );
}
