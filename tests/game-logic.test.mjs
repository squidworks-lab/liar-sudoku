import test from "node:test";
import assert from "node:assert/strict";
import {
  countSolutions,
  countSolutions9,
  generateDailyPuzzle,
  generateDailyPuzzle9,
  generatePuzzle,
  generatePuzzle9,
  validatePuzzle,
  validatePuzzle9,
} from "../game-logic.mjs";
import { createGameEventTracker } from "../analytics.mjs";

test("solution counter distinguishes impossible, unique, and multiple grids", () => {
  assert.equal(countSolutions(Array(16).fill(0), 2), 2);
  assert.equal(countSolutions([1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1], 2), 1);
  assert.equal(countSolutions([1, 1, ...Array(14).fill(0)], 2), 0);
  assert.equal(countSolutions([1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 2], 2), 0);
});

test("generated puzzles have exactly one logically identifiable lie", () => {
  for (let puzzleNumber = 0; puzzleNumber < 40; puzzleNumber += 1) {
    const puzzle = generatePuzzle();
    const validation = validatePuzzle(puzzle);

    assert.equal(validation.valid, true, validation.reason);
    assert.deepEqual(validation.candidates, [puzzle.liarIndex]);

    const corrected = [...puzzle.clues];
    corrected[puzzle.liarIndex] = 0;
    assert.equal(countSolutions(corrected, 2), 1);
  }
});

test("generation retries are bounded", () => {
  assert.throws(() => generatePuzzle({ maxAttempts: 0 }), /0回以内/);
});

test("daily puzzles are stable for a date and have a uniquely identifiable lie", () => {
  const first = generateDailyPuzzle("2026-11-04");
  const second = generateDailyPuzzle("2026-11-04");

  assert.deepEqual(first, second);
  assert.equal(validatePuzzle(first).valid, true);
});

test("daily puzzle date keys must use the ISO date format", () => {
  assert.throws(() => generateDailyPuzzle("2026/11/04"), /YYYY-MM-DD/);
});

test("9x9 solution counter checks Sudoku constraints and uniqueness limits", () => {
  const solution = generatePuzzle9().solution;
  assert.equal(countSolutions9(Array(81).fill(0), 2), 2);
  assert.equal(countSolutions9(solution, 2), 1);
  assert.equal(countSolutions9([1, 1, ...Array(79).fill(0)], 2), 0);
});

test("daily 9x9 puzzles are valid, uniquely identify one lie, and are date-stable", () => {
  const first = generateDailyPuzzle9("2026-11-04");
  const sameDay = generateDailyPuzzle9("2026-11-04");
  const nextDay = generateDailyPuzzle9("2026-11-05");

  assert.deepEqual(first, sameDay);
  assert.notDeepEqual(first, nextDay);
  assert.equal(first.solution.length, 81);
  assert.equal(first.clues.length, 81);
  assert.equal(validatePuzzle9(first).valid, true);
  assert.deepEqual(validatePuzzle9(first).candidates, [first.liarIndex]);
  assert.deepEqual(
    first.clues.flatMap((clue, index) => clue !== 0 && clue !== first.solution[index] ? [index] : []),
    [first.liarIndex],
  );

  for (let row = 0; row < 9; row += 1) {
    assert.equal(new Set(first.solution.slice(row * 9, row * 9 + 9)).size, 9);
    assert.equal(new Set(Array.from({ length: 9 }, (_, column) => first.solution[row + column * 9])).size, 9);
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      const values = [];
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          values.push(first.solution[(boxRow * 3 + row) * 9 + boxColumn * 3 + column]);
        }
      }
      assert.equal(new Set(values).size, 9);
    }
  }
});

test("9x9 generation retries are bounded and daily keys are validated", () => {
  assert.throws(() => generatePuzzle9({ maxAttempts: 0 }), /0回以内/);
  assert.throws(() => generateDailyPuzzle9("2026/11/04"), /YYYY-MM-DD/);
});

test("GA4 game events send only the allowed mode, date, and completion attempts", () => {
  const sent = [];
  const track = createGameEventTracker(() => (...args) => sent.push(args));

  assert.equal(track("game_start", { game_mode: "4x4", game_date: "2026-11-04" }), true);
  assert.equal(track("game_complete", {
    game_mode: "9x9",
    game_date: "2026-11-05",
    attempts: 3,
    solution: [1, 2, 3],
  }), true);
  assert.equal(track("game_share", { game_mode: "4x4", game_date: "2026-11-04" }), true);
  assert.deepEqual(sent, [
    ["event", "game_start", { game_mode: "4x4", game_date: "2026-11-04" }],
    ["event", "game_complete", { game_mode: "9x9", game_date: "2026-11-05", attempts: 3 }],
    ["event", "game_share", { game_mode: "4x4", game_date: "2026-11-04" }],
  ]);
});

test("GA4 tracking is optional and cannot interrupt game behavior", () => {
  const errors = [];
  const track = createGameEventTracker(() => undefined, (...args) => errors.push(args));
  const brokenTrack = createGameEventTracker(() => {
    throw new Error("offline");
  }, (...args) => errors.push(args));

  assert.equal(track("game_start", { game_mode: "4x4", game_date: "2026-11-04" }), false);
  assert.equal(brokenTrack("game_share", { game_mode: "9x9", game_date: "2026-11-04" }), false);
  assert.equal(errors.length, 1);
  assert.throws(
    () => track("game_complete", { game_mode: "4x4", game_date: "2026-11-04" }),
    /attempts/,
  );
});

test("GA4 start and completion events are sent once per mode and date", () => {
  const sent = [];
  const track = createGameEventTracker(() => (...args) => sent.push(args));
  const event = { game_mode: "9x9", game_date: "2026-11-04" };

  assert.equal(track("game_start", event), true);
  assert.equal(track("game_start", event), false);
  assert.equal(track("game_complete", { ...event, attempts: 2 }), true);
  assert.equal(track("game_complete", { ...event, attempts: 2 }), false);
  assert.equal(track("game_share", event), true);
  assert.equal(track("game_share", event), true);
  assert.equal(track("game_start", { ...event, game_mode: "4x4" }), true);
  assert.equal(track("game_start", { ...event, game_date: "2026-11-05" }), true);
  assert.equal(sent.length, 6);
});