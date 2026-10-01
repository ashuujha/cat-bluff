import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyClassic,
  classicView,
  newClassicState,
} from "../src/game/classic-rules";
import {
  practiceActor,
  practiceRecap,
} from "../src/game/practice-presentation";

const deck = Array.from({ length: 52 }, (_, i) => i);
describe("practice narration", () => {
  it("never narrates a face-down rank, even when the player is bluffing", () => {
    const initial = newClassicState(2, 1, deck);
    const bluff = applyClassic(initial, 0, { kind: "play", cards: [48] });
    const honest = applyClassic(initial, 0, { kind: "play", cards: [0] });
    const text = practiceRecap(
      classicView(initial),
      classicView(bluff),
      0,
      "play",
    );
    assert.equal(
      text,
      practiceRecap(classicView(initial), classicView(honest), 0, "play"),
    );
    assert.match(text, /claimed 1 Ace/);
    assert.doesNotMatch(text, /King/);
  });
  it("shows a bot's declared card without disclosing its actual face-down card", () => {
    const start = newClassicState(2, 1, deck);
    const playerPlayed = applyClassic(start, 0, { kind: "play", cards: [0] });
    const botTurn = applyClassic(playerPlayed, 1, { kind: "pass" });
    const bluff = applyClassic(botTurn, 1, { kind: "play", cards: [1] });
    const honest = applyClassic(botTurn, 1, { kind: "play", cards: [5] });
    const claim = practiceRecap(classicView(botTurn), classicView(bluff), 1, "play");
    assert.equal(
      claim,
      practiceRecap(classicView(botTurn), classicView(honest), 1, "play"),
    );
    assert.match(claim, /Miso played 1 face-down and claimed 1 Two/);
    assert.equal(classicView(bluff).latest!.revealed, undefined);
  });
  it("explains the correct full-pile penalty for both challenge outcomes", () => {
    for (const [card, expectedReceiver, outcome] of [
      [0, "Miso", "true"],
      [48, "You", "bluffing"],
    ] as const) {
      const played = applyClassic(newClassicState(2, 1, deck), 0, {
        kind: "play",
        cards: [card],
      });
      const challenged = applyClassic(played, 1, { kind: "call" });
      const resolved = applyClassic(challenged, 0, { kind: "reveal" });
      const text = practiceRecap(
        classicView(challenged),
        classicView(resolved),
        0,
        "reveal",
      );
      assert.match(text, new RegExp(outcome));
      assert.match(
        text,
        new RegExp(`${expectedReceiver} takes the entire 1-card pile`),
      );
      assert.equal(practiceActor(classicView(challenged)), 0);
      assert.equal(practiceActor(classicView(resolved)), 1);
    }
  });
  it("keeps an unchallenged play secret and stops asking bots to act after a win", () => {
    const played = applyClassic(newClassicState(2, 1, deck), 0, {
      kind: "play",
      cards: [48],
    });
    const settled = applyClassic(played, 1, { kind: "pass" });
    assert.equal(practiceActor(classicView(played)), 1);
    assert.match(
      practiceRecap(classicView(played), classicView(settled), 1, "pass"),
      /stay hidden/,
    );
    assert.equal(
      practiceActor({ ...classicView(settled), phase: "finished", winner: 0 }),
      null,
    );
  });
});
