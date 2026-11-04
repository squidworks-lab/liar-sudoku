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