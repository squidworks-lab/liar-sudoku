const SIZE = 4;
const FULL_MASK = (1 << SIZE) - 1;

function shuffled(values, random = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createSeededRandom(seed) {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function candidatesFor(grid, index) {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  let used = 0;

  for (let offset = 0; offset < SIZE; offset += 1) {
    const rowValue = grid[row * SIZE + offset];
    const columnValue = grid[offset * SIZE + column];
    if (rowValue) used |= 1 << (rowValue - 1);
    if (columnValue) used |= 1 << (columnValue - 1);
  }

  const blockRow = Math.floor(row / 2) * 2;
  const blockColumn = Math.floor(column / 2) * 2;
  for (let rowOffset = 0; rowOffset < 2; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
      const value = grid[(blockRow + rowOffset) * SIZE + blockColumn + columnOffset];
      if (value) used |= 1 << (value - 1);
    }
  }

  return FULL_MASK & ~used;
}

function findBestEmpty(grid) {
  let bestIndex = -1;
  let bestMask = 0;
  let bestCount = SIZE + 1;

  for (let index = 0; index < grid.length; index += 1) {
    if (grid[index] !== 0) continue;
    const mask = candidatesFor(grid, index);
    let count = 0;
    for (let bits = mask; bits; bits &= bits - 1) count += 1;
    if (count < bestCount) {
      bestIndex = index;
      bestMask = mask;
      bestCount = count;
      if (count <= 1) break;
    }
  }

  return { index: bestIndex, mask: bestMask };
}

function maskValues(mask) {
  const values = [];
  for (let value = 1; value <= SIZE; value += 1) {
    if (mask & (1 << (value - 1))) values.push(value);
  }
  return values;
}

function search(grid, limit, solutions, randomize = false, random = Math.random) {
  if (solutions.length >= limit) return;
  const { index, mask } = findBestEmpty(grid);
  if (index === -1) {
    solutions.push([...grid]);
    return;
  }
  if (mask === 0) return;

  const values = maskValues(mask);
  const orderedValues = randomize ? shuffled(values, random) : values;
  for (const value of orderedValues) {
    grid[index] = value;
    search(grid, limit, solutions, randomize, random);
    grid[index] = 0;
    if (solutions.length >= limit) return;
  }
}

export function countSolutions(grid, limit = 2) {
  if (!Array.isArray(grid) || grid.length !== SIZE * SIZE || !Number.isInteger(limit) || limit < 1) {
    throw new TypeError("盤面は16マス、上限は正の整数で指定してください。");
  }
  if (grid.some((value) => !Number.isInteger(value) || value < 0 || value > SIZE)) {
    throw new TypeError("盤面の値は0〜4の整数で指定してください。");
  }

  const workingGrid = [...grid];
  for (let index = 0; index < workingGrid.length; index += 1) {
    const value = workingGrid[index];
    if (value === 0) continue;
    workingGrid[index] = 0;
    const allowed = candidatesFor(workingGrid, index) & (1 << (value - 1));
    workingGrid[index] = value;
    if (!allowed) return 0;
  }

  const solutions = [];
  search(workingGrid, limit, solutions);
  return solutions.length;
}

export function createSolution(random = Math.random) {
  const solutions = [];
  search(Array(SIZE * SIZE).fill(0), 1, solutions, true, random);
  return solutions[0];
}

export function validatePuzzle({ solution, clues, liarIndex }) {
  if (!Array.isArray(solution) || solution.length !== SIZE * SIZE ||
      !Array.isArray(clues) || clues.length !== SIZE * SIZE ||
      !Number.isInteger(liarIndex) || liarIndex < 0 || liarIndex >= SIZE * SIZE) {
    return { valid: false, candidates: [], reason: "盤面の形式が正しくありません。" };
  }

  if (solution.some((value) => !Number.isInteger(value) || value < 1 || value > SIZE) ||
      countSolutions(solution, 2) !== 1) {
    return { valid: false, candidates: [], reason: "完成盤面が正しい数独ではありません。" };
  }

  const clueIndexes = [];
  for (let index = 0; index < clues.length; index += 1) {
    const clue = clues[index];
    if (clue === 0) continue;
    if (!Number.isInteger(clue) || clue < 1 || clue > SIZE) {
      return { valid: false, candidates: [], reason: "ヒントの値が正しくありません。" };
    }
    clueIndexes.push(index);
  }
  if (clueIndexes.length < 2 || clues[liarIndex] === 0) {
    return { valid: false, candidates: [], reason: "ウソのヒントが見つかりません。" };
  }

  const wrongIndexes = clueIndexes.filter((index) => clues[index] !== solution[index]);
  if (wrongIndexes.length !== 1 || wrongIndexes[0] !== liarIndex) {
    return { valid: false, candidates: [], reason: "ウソのヒントは1つではありません。" };
  }

  const corrected = [...clues];
  corrected[liarIndex] = 0;
  if (countSolutions(corrected, 2) !== 1 || !sameGrid(getOnlySolution(corrected), solution)) {
    return { valid: false, candidates: [], reason: "ウソを除いた盤面の答えが一意ではありません。" };
  }

  const candidates = [];
  for (const index of clueIndexes) {
    const candidateGrid = [...clues];
    candidateGrid[index] = 0;
    if (countSolutions(candidateGrid, 2) === 1) candidates.push(index);
  }

  return {
    valid: candidates.length === 1 && candidates[0] === liarIndex,
    candidates,
    reason: candidates.length === 1 && candidates[0] === liarIndex
      ? "ウソの位置が一意に決まります。"
      : "ウソの位置を一意に特定できません。",
  };
}

function getOnlySolution(grid) {
  const solutions = [];
  search([...grid], 1, solutions);
  return solutions[0];
}

function sameGrid(first, second) {
  return Array.isArray(second) && first.every((value, index) => value === second[index]);
}

export function generatePuzzle({ maxAttempts = 5000, random = Math.random } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const solution = createSolution(random);
    const clueCount = 8 + Math.floor(random() * 4);
    const clueIndexes = shuffled(Array.from({ length: SIZE * SIZE }, (_, index) => index), random).slice(0, clueCount);
    const clues = Array(SIZE * SIZE).fill(0);
    for (const index of clueIndexes) clues[index] = solution[index];

    const liarIndex = clueIndexes[Math.floor(random() * clueIndexes.length)];
    const alternatives = [1, 2, 3, 4].filter((value) => value !== solution[liarIndex]);
    clues[liarIndex] = alternatives[Math.floor(random() * alternatives.length)];

    const validation = validatePuzzle({ solution, clues, liarIndex });
    if (validation.valid) return { solution, clues, liarIndex, attempts: attempt + 1 };
  }

  throw new Error(`検証に通る問題を${maxAttempts}回以内に生成できませんでした。`);
}

export function generateDailyPuzzle(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new TypeError("日替わり問題の日付はYYYY-MM-DD形式で指定してください。");
  }
  return generatePuzzle({ random: createSeededRandom(dateKey) });
}

const SIZE_9 = 9;
const BOX_SIZE_9 = 3;
const FULL_MASK_9 = (1 << SIZE_9) - 1;
const UNITS_9 = [];
for (let index = 0; index < SIZE_9; index += 1) {
  UNITS_9.push(Array.from({ length: SIZE_9 }, (_, offset) => index * SIZE_9 + offset));
  UNITS_9.push(Array.from({ length: SIZE_9 }, (_, offset) => offset * SIZE_9 + index));
  const boxRow = Math.floor(index / BOX_SIZE_9) * BOX_SIZE_9;
  const boxColumn = (index % BOX_SIZE_9) * BOX_SIZE_9;
  UNITS_9.push(Array.from({ length: SIZE_9 }, (_, offset) =>
    (boxRow + Math.floor(offset / BOX_SIZE_9)) * SIZE_9 + boxColumn + offset % BOX_SIZE_9,
  ));
}

function boxIndex9(row, column) {
  return Math.floor(row / BOX_SIZE_9) * BOX_SIZE_9 + Math.floor(column / BOX_SIZE_9);
}

function getCandidates9(index, rowMasks, columnMasks, boxMasks) {
  const row = Math.floor(index / SIZE_9);
  const column = index % SIZE_9;
  return FULL_MASK_9 & ~(rowMasks[row] | columnMasks[column] | boxMasks[boxIndex9(row, column)]);
}

function search9(grid, rowMasks, columnMasks, boxMasks, limit, solutions) {
  if (solutions.length >= limit) return;

  let bestIndex = -1;
  let bestMask = 0;
  let bestCount = SIZE_9 + 1;
  for (let index = 0; index < grid.length; index += 1) {
    if (grid[index] !== 0) continue;
    const mask = getCandidates9(index, rowMasks, columnMasks, boxMasks);
    let count = 0;
    for (let bits = mask; bits; bits &= bits - 1) count += 1;
    if (count < bestCount) {
      bestIndex = index;
      bestMask = mask;
      bestCount = count;
      if (count <= 1) break;
    }
  }

  if (bestIndex === -1) {
    solutions.push([...grid]);
    return;
  }
  if (bestMask === 0) return;

  const row = Math.floor(bestIndex / SIZE_9);
  const column = bestIndex % SIZE_9;
  const box = boxIndex9(row, column);
  for (let value = 1; value <= SIZE_9; value += 1) {
    const bit = 1 << (value - 1);
    if (!(bestMask & bit)) continue;
    grid[bestIndex] = value;
    rowMasks[row] |= bit;
    columnMasks[column] |= bit;
    boxMasks[box] |= bit;
    search9(grid, rowMasks, columnMasks, boxMasks, limit, solutions);
    grid[bestIndex] = 0;
    rowMasks[row] &= ~bit;
    columnMasks[column] &= ~bit;
    boxMasks[box] &= ~bit;
    if (solutions.length >= limit) return;
  }
}

export function countSolutions9(grid, limit = 2) {
  if (!Array.isArray(grid) || grid.length !== SIZE_9 * SIZE_9 ||
      !Number.isInteger(limit) || limit < 1) {
    throw new TypeError("9×9盤面は81マス、上限は正の整数で指定してください。");
  }
  if (grid.some((value) => !Number.isInteger(value) || value < 0 || value > SIZE_9)) {
    throw new TypeError("9×9盤面の値は0〜9の整数で指定してください。");
  }

  const workingGrid = [...grid];
  const rowMasks = Array(SIZE_9).fill(0);
  const columnMasks = Array(SIZE_9).fill(0);
  const boxMasks = Array(SIZE_9).fill(0);
  for (let index = 0; index < workingGrid.length; index += 1) {
    const value = workingGrid[index];
    if (value === 0) continue;
    const row = Math.floor(index / SIZE_9);
    const column = index % SIZE_9;
    const box = boxIndex9(row, column);
    const bit = 1 << (value - 1);
    if ((rowMasks[row] | columnMasks[column] | boxMasks[box]) & bit) return 0;
    rowMasks[row] |= bit;
    columnMasks[column] |= bit;
    boxMasks[box] |= bit;
  }

  const solutions = [];
  search9(workingGrid, rowMasks, columnMasks, boxMasks, limit, solutions);
  return solutions.length;
}

function solve9(grid, limit = 2) {
  const workingGrid = [...grid];
  const rowMasks = Array(SIZE_9).fill(0);
  const columnMasks = Array(SIZE_9).fill(0);
  const boxMasks = Array(SIZE_9).fill(0);
  for (let index = 0; index < workingGrid.length; index += 1) {
    const value = workingGrid[index];
    if (value === 0) continue;
    const row = Math.floor(index / SIZE_9);
    const column = index % SIZE_9;
    const box = boxIndex9(row, column);
    const bit = 1 << (value - 1);
    if ((rowMasks[row] | columnMasks[column] | boxMasks[box]) & bit) return [];
    rowMasks[row] |= bit;
    columnMasks[column] |= bit;
    boxMasks[box] |= bit;
  }

  const solutions = [];
  search9(workingGrid, rowMasks, columnMasks, boxMasks, limit, solutions);
  return solutions;
}

function findSinglesContradictionDepth9(grid, maxSteps = 2) {
  const workingGrid = [...grid];
  let steps = 0;
  while (steps <= maxSteps) {
    const rowMasks = Array(SIZE_9).fill(0);
    const columnMasks = Array(SIZE_9).fill(0);
    const boxMasks = Array(SIZE_9).fill(0);
    for (let index = 0; index < workingGrid.length; index += 1) {
      const value = workingGrid[index];
      if (value === 0) continue;
      const row = Math.floor(index / SIZE_9);
      const column = index % SIZE_9;
      const box = boxIndex9(row, column);
      const bit = 1 << (value - 1);
      if ((rowMasks[row] | columnMasks[column] | boxMasks[box]) & bit) return steps;
      rowMasks[row] |= bit;
      columnMasks[column] |= bit;
      boxMasks[box] |= bit;
    }

    const candidates = Array(SIZE_9 * SIZE_9).fill(0);
    for (let index = 0; index < workingGrid.length; index += 1) {
      if (workingGrid[index] !== 0) continue;
      candidates[index] = getCandidates9(index, rowMasks, columnMasks, boxMasks);
      if (candidates[index] === 0) return steps;
    }

    const forced = [];
    for (let index = 0; index < candidates.length; index += 1) {
      const mask = candidates[index];
      if (mask && (mask & (mask - 1)) === 0) {
        forced.push([index, 32 - Math.clz32(mask)]);
      }
    }
    for (const unit of UNITS_9) {
      let used = 0;
      for (const index of unit) {
        if (workingGrid[index]) used |= 1 << (workingGrid[index] - 1);
      }
      for (let value = 1; value <= SIZE_9; value += 1) {
        const bit = 1 << (value - 1);
        if (used & bit) continue;
        const places = unit.filter((index) => !workingGrid[index] && (candidates[index] & bit));
        if (places.length === 0) return steps;
        if (places.length === 1) forced.push([places[0], value]);
      }
    }

    const forcedValues = new Map();
    for (const [index, value] of forced) {
      const priorValue = forcedValues.get(index);
      if (priorValue !== undefined && priorValue !== value) return steps;
      forcedValues.set(index, value);
    }
    if (forcedValues.size === 0 || steps === maxSteps) return -1;

    const [index, value] = forced.find(([forcedIndex]) => forcedIndex === forcedValues.keys().next().value);
    workingGrid[index] = value;
    steps += 1;
  }
  return -1;
}

export function validatePuzzle9({ solution, clues, liarIndex }) {
  if (!Array.isArray(solution) || solution.length !== SIZE_9 * SIZE_9 ||
      !Array.isArray(clues) || clues.length !== SIZE_9 * SIZE_9 ||
      !Number.isInteger(liarIndex) || liarIndex < 0 || liarIndex >= SIZE_9 * SIZE_9) {
    return { valid: false, candidates: [], reason: "9×9盤面の形式が正しくありません。" };
  }
  if (solution.some((value) => !Number.isInteger(value) || value < 1 || value > SIZE_9) ||
      countSolutions9(solution, 2) !== 1) {
    return { valid: false, candidates: [], reason: "完成盤面が正しい9×9数独ではありません。" };
  }

  const clueIndexes = [];
  for (let index = 0; index < clues.length; index += 1) {
    const clue = clues[index];
    if (clue === 0) continue;
    if (!Number.isInteger(clue) || clue < 1 || clue > SIZE_9) {
      return { valid: false, candidates: [], reason: "ヒントの値が正しくありません。" };
    }
    clueIndexes.push(index);
  }
  if (clueIndexes.length < 2 || clues[liarIndex] === 0) {
    return { valid: false, candidates: [], reason: "ウソのヒントが見つかりません。" };
  }
  if (countSolutions9(clues, 1) !== 0) {
    return { valid: false, candidates: [], reason: "ウソを含む盤面に解があるか、ヒントが重複しています。" };
  }
  const wrongIndexes = clueIndexes.filter((index) => clues[index] !== solution[index]);
  if (wrongIndexes.length !== 1 || wrongIndexes[0] !== liarIndex) {
    return { valid: false, candidates: [], reason: "ウソのヒントは1つではありません。" };
  }

  const corrected = [...clues];
  corrected[liarIndex] = 0;
  const correctedSolutions = solve9(corrected, 2);
  if (correctedSolutions.length !== 1 || !sameGrid(solution, correctedSolutions[0])) {
    return { valid: false, candidates: [], reason: "ウソを除いた盤面の答えが一意ではありません。" };
  }

  const candidates = [];
  let otherCluesRemainUnsolvable = true;
  for (const index of clueIndexes) {
    const candidateGrid = [...clues];
    candidateGrid[index] = 0;
    const solutionCount = countSolutions9(candidateGrid, 2);
    if (index === liarIndex) {
      if (solutionCount === 1) candidates.push(index);
    } else if (solutionCount !== 0) {
      otherCluesRemainUnsolvable = false;
    }
  }
  const contradictionDepth = findSinglesContradictionDepth9(clues, 2);
  return {
    valid: candidates.length === 1 && candidates[0] === liarIndex &&
      otherCluesRemainUnsolvable && contradictionDepth >= 1 && contradictionDepth <= 2,
    candidates,
    contradictionDepth,
    reason: candidates.length === 1 && candidates[0] === liarIndex
      ? otherCluesRemainUnsolvable && contradictionDepth >= 1 && contradictionDepth <= 2
        ? "ウソの位置が一意に決まり、短いシングル推理で矛盾します。"
        : "ウソ以外のヒントを除いた盤面または推理難易度が条件を満たしません。"
      : "ウソの位置を一意に特定できません。",
  };
}

function createSolution9(random) {
  const bands = shuffled([0, 1, 2], random);
  const rows = bands.flatMap((band) => shuffled([0, 1, 2], random).map((row) => band * 3 + row));
  const stacks = shuffled([0, 1, 2], random);
  const columns = stacks.flatMap((stack) => shuffled([0, 1, 2], random).map((column) => stack * 3 + column));
  const digits = shuffled(Array.from({ length: SIZE_9 }, (_, index) => index + 1), random);
  return rows.flatMap((row) => columns.map((column) =>
    digits[(row * BOX_SIZE_9 + Math.floor(row / BOX_SIZE_9) + column) % SIZE_9],
  ));
}

function hasUniqueSolution9(grid) {
  return countSolutions9(grid, 2) === 1;
}

function getPeerValues9(grid, index) {
  const row = Math.floor(index / SIZE_9);
  const column = index % SIZE_9;
  const boxRow = Math.floor(row / BOX_SIZE_9) * BOX_SIZE_9;
  const boxColumn = Math.floor(column / BOX_SIZE_9) * BOX_SIZE_9;
  const values = new Set();
  for (let offset = 0; offset < SIZE_9; offset += 1) {
    const rowIndex = row * SIZE_9 + offset;
    const columnIndex = offset * SIZE_9 + column;
    if (rowIndex !== index && grid[rowIndex]) values.add(grid[rowIndex]);
    if (columnIndex !== index && grid[columnIndex]) values.add(grid[columnIndex]);
  }
  for (let rowOffset = 0; rowOffset < BOX_SIZE_9; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < BOX_SIZE_9; columnOffset += 1) {
      const peerIndex = (boxRow + rowOffset) * SIZE_9 + boxColumn + columnOffset;
      if (peerIndex !== index && grid[peerIndex]) values.add(grid[peerIndex]);
    }
  }
  return values;
}

function findValidLiars9(solution, clues, clueIndexes, random) {
  const validLiars = [];
  for (const index of clueIndexes) {
    const peerValues = getPeerValues9(clues, index);
    for (let value = 1; value <= SIZE_9; value += 1) {
      if (value === solution[index] || peerValues.has(value)) continue;
      const candidateClues = [...clues];
      candidateClues[index] = value;
      const contradictionDepth = findSinglesContradictionDepth9(candidateClues, 2);
      if (contradictionDepth < 1 || contradictionDepth > 2) continue;
      if (countSolutions9(candidateClues, 1) !== 0) continue;

      let allOtherCluesKeepItUnsolvable = true;
      for (const otherIndex of clueIndexes) {
        if (otherIndex === index) continue;
        const reducedClues = [...candidateClues];
        reducedClues[otherIndex] = 0;
        if (countSolutions9(reducedClues, 1) !== 0) {
          allOtherCluesKeepItUnsolvable = false;
          break;
        }
      }
      if (allOtherCluesKeepItUnsolvable) validLiars.push({ index, value });
    }
  }
  return validLiars.length ? validLiars[Math.floor(random() * validLiars.length)] : null;
}

export function generatePuzzle9({ maxAttempts = 100, random = Math.random } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const solution = createSolution9(random);
    const clueCount = 45 + Math.floor(random() * 7);
    const clueIndexes = shuffled(Array.from({ length: SIZE_9 * SIZE_9 }, (_, index) => index), random)
      .slice(0, clueCount);
    const clues = Array(SIZE_9 * SIZE_9).fill(0);
    for (const index of clueIndexes) clues[index] = solution[index];
    if (!hasUniqueSolution9(clues)) continue;

    const liar = findValidLiars9(solution, clues, clueIndexes, random);
    if (!liar) continue;
    const { index: liarIndex, value } = liar;
    clues[liarIndex] = value;
    const puzzle = { solution, clues, liarIndex, attempts: attempt + 1 };
    if (validatePuzzle9(puzzle).valid) return puzzle;
  }
  throw new Error(`検証に通る9×9問題を${maxAttempts}回以内に生成できませんでした。`);
}

export function generateDailyPuzzle9(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new TypeError("日替わり問題の日付はYYYY-MM-DD形式で指定してください。");
  }
  return generatePuzzle9({ random: createSeededRandom(`9x9:${dateKey}`) });
}