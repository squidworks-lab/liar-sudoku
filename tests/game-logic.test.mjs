import test from "node:test";
import assert from "node:assert/strict";
import { countSolutions, generatePuzzle, validatePuzzle } from "../game-logic.mjs";

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