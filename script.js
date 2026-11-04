import { generateDailyPuzzle, generateDailyPuzzle9 } from "./game-logic.mjs?v=3";
import { createGameEventTracker } from "./analytics.mjs?v=1";

const boardElement = document.querySelector("#board");
const feedbackElement = document.querySelector("#feedback");
const answerHintElement = document.querySelector("#answer-hint");
const puzzleDateElement = document.querySelector("#puzzle-date");
const shareButton = document.querySelector("#share-button");
const puzzleHeadingElement = document.querySelector("#puzzle-heading");
const ruleBlockSizeElement = document.querySelector("#rule-block-size");
const ruleDigitsElement = document.querySelector("#rule-digits");
const modeButtons = {
  "4x4": document.querySelector("#mode-4-button"),
  "9x9": document.querySelector("#mode-9-button"),
};
const jstDateFormatter = new Intl.DateTimeFormat("en-US", {
  calendar: "gregory",
  numberingSystem: "latn",
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const modeSettings = {
  "4x4": { size: 4, blockSize: 2, generate: generateDailyPuzzle },
  "9x9": { size: 9, blockSize: 3, generate: generateDailyPuzzle9 },
};
const modeStates = new Map();
const trackGameEvent = createGameEventTracker(
  () => window.gtag,
  (message, error) => console.error(message, error),
);

let activeMode = "4x4";
let state;

function getDailyResultKey(dateKey, mode) {
  return mode === "4x4"
    ? `liar-sudoku:daily-result:${dateKey}`
    : `liar-sudoku:daily-result:${mode}:${dateKey}`;
}

function loadDailyResult(dateKey, mode) {
  let serialized;
  try {
    serialized = window.localStorage.getItem(getDailyResultKey(dateKey, mode));
  } catch (error) {
    if (error instanceof DOMException) {
      return { result: null, notice: "このブラウザーではクリア状態を読み込めません。" };
    }
    throw error;
  }
  if (!serialized) return { result: null, notice: "" };

  let result;
  try {
    result = JSON.parse(serialized);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { result: null, notice: "保存されたクリア状態を読み取れませんでした。" };
    }
    throw error;
  }
  if (result?.completed === true && Number.isInteger(result.guessesMade) && result.guessesMade > 0) {
    return { result, notice: "" };
  }
  return { result: null, notice: "保存されたクリア状態の形式が正しくありません。" };
}

function saveDailyResult(dateKey, mode, result) {
  try {
    window.localStorage.setItem(getDailyResultKey(dateKey, mode), JSON.stringify(result));
    return "";
  } catch (error) {
    if (error instanceof DOMException) {
      return "クリア状態をこのブラウザーに保存できませんでした。";
    }
    throw error;
  }
}

function getTodayInJapan() {
  const dateParts = Object.fromEntries(
    jstDateFormatter.formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function createModeState(mode, dateKey) {
  const { result: savedResult, notice } = loadDailyResult(dateKey, mode);
  const puzzle = modeSettings[mode].generate(dateKey);
  return {
    dateKey,
    puzzle,
    selectedIndex: savedResult ? puzzle.liarIndex : null,
    answered: savedResult !== null,
    guessesMade: savedResult?.guessesMade ?? 0,
    feedbackText: savedResult
      ? `本日の問題はクリア済みです。${savedResult.guessesMade}回目で正解しました。`
      : notice,
    feedbackClass: savedResult ? "is-correct" : "",
    lastIncorrectIndex: null,
  };
}

function startPuzzle(mode = activeMode, dateKey = getTodayInJapan()) {
  activeMode = mode;
  state = modeStates.get(mode);
  if (!state || state.dateKey !== dateKey) {
    state = createModeState(mode, dateKey);
    modeStates.set(mode, state);
  }

  const { size, blockSize } = modeSettings[activeMode];
  boardElement.style.setProperty("--board-size", size);
  for (const [buttonMode, button] of Object.entries(modeButtons)) {
    const active = buttonMode === activeMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  boardElement.className = `board board--${size}`;
  boardElement.setAttribute("aria-label", `${size}行${size}列の数独盤面`);
  puzzleDateElement.textContent = state.dateKey.replaceAll("-", ".");
  puzzleHeadingElement.textContent = `${size}×${size}の盤面に、ひとつだけウソがある。`;
  ruleBlockSizeElement.textContent = `${blockSize}×${blockSize}`;
  ruleDigitsElement.textContent = `1〜${size}`;
  feedbackElement.textContent = state.feedbackText;
  feedbackElement.className = "feedback";
  if (state.feedbackClass) feedbackElement.classList.add(state.feedbackClass);
  answerHintElement.hidden = state.answered;
  renderBoard();
  updateShareLink();
  trackGameEvent("game_start", { game_mode: mode, game_date: state.dateKey });
}

function updateForNewDay() {
  if (getTodayInJapan() !== state.dateKey) startPuzzle(activeMode);
}

function renderBoard() {
  const { size, blockSize } = modeSettings[activeMode];
  const fragment = document.createDocumentFragment();
  state.puzzle.clues.forEach((value, index) => {
    const cell = document.createElement("button");
    const row = Math.floor(index / size);
    const column = index % size;
    const visibleValue = state.answered && index === state.puzzle.liarIndex
      ? state.puzzle.solution[index]
      : value;
    cell.type = "button";
    cell.className = "cell";
    if ((column + 1) % blockSize === 0 && column + 1 < size) cell.classList.add("is-block-right");
    if ((row + 1) % blockSize === 0 && row + 1 < size) cell.classList.add("is-block-bottom");
    if (column === size - 1) cell.classList.add("is-edge-right");
    if (row === size - 1) cell.classList.add("is-edge-bottom");
    cell.setAttribute(
      "aria-label",
      `${row + 1}行${column + 1}列、${value ? `${visibleValue}のヒント` : "空欄"}`,
    );

    if (value) {
      cell.textContent = String(visibleValue);
      cell.classList.add("is-clue");
      if (state.selectedIndex === index && !state.answered) cell.classList.add("is-selected");
      if (state.lastIncorrectIndex === index && !state.answered) cell.classList.add("is-incorrect");
      if (state.answered && index === state.puzzle.liarIndex) {
        cell.classList.add("is-revealed");
        cell.setAttribute(
          "aria-label",
          `${row + 1}行${column + 1}列、ウソのヒント。本当の数字は${state.puzzle.solution[index]}`,
        );
      }
      cell.addEventListener("click", () => chooseCell(index));
    } else {
      cell.disabled = true;
      cell.setAttribute("aria-label", `${row + 1}行${column + 1}列、空欄`);
    }
    fragment.append(cell);
  });
  boardElement.replaceChildren(fragment);
}

function updateShareLink() {
  const { size } = modeSettings[activeMode];
  const date = state.dateKey.replaceAll("-", ".");
  const result = state.answered
    ? state.guessesMade === 1
      ? "一発正解！今日のウソを見破った！"
      : `${state.guessesMade}回目で正解！今日のウソを見破った！`
    : `挑戦中（回答数：${state.guessesMade}回）！あなたはウソの数字を見破れる？`;
  const shareUrl = new URL("https://twitter.com/intent/tweet");
  shareUrl.searchParams.set(
    "text",
    `【今日のウソツキ数独｜${size}×${size}｜${date}】\n${size}×${size}数独に、ウソの数字がひとつ。\n${result}\nこのウソ、見破れる？\n#ウソツキ数独`,
  );
  shareUrl.searchParams.set("url", window.location.href);
  shareButton.href = shareUrl.toString();
}

shareButton.addEventListener("click", () => {
  trackGameEvent("game_share", { game_mode: activeMode, game_date: state.dateKey });
});

function chooseCell(index) {
  if (state.answered) return;
  state.guessesMade += 1;
  state.selectedIndex = index;
  state.lastIncorrectIndex = null;
  state.feedbackText = "";
  state.feedbackClass = "";
  renderBoard();
  const selectedCell = boardElement.children[index];
  selectedCell.focus();

  if (index === state.puzzle.liarIndex) {
    state.answered = true;
    answerHintElement.hidden = true;
    const persistenceNotice = saveDailyResult(state.dateKey, activeMode, {
      completed: true,
      guessesMade: state.guessesMade,
    });
    state.feedbackText =
      `正解！このマスの本当の数字は ${state.puzzle.solution[index]} です。${persistenceNotice}`;
    state.feedbackClass = "is-correct";
    feedbackElement.textContent = state.feedbackText;
    feedbackElement.className = `feedback ${state.feedbackClass}`;
    renderBoard();
    trackGameEvent("game_complete", {
      game_mode: activeMode,
      game_date: state.dateKey,
      attempts: state.guessesMade,
    });
  } else {
    state.lastIncorrectIndex = index;
    state.feedbackText = "ここは正しいヒントです。ほかの数字を探してみましょう。";
    state.feedbackClass = "is-incorrect";
    feedbackElement.textContent = state.feedbackText;
    feedbackElement.className = `feedback ${state.feedbackClass}`;
    boardElement.children[index].classList.add("is-incorrect");
  }
  updateShareLink();
}

modeButtons["4x4"].addEventListener("click", () => startPuzzle("4x4"));
modeButtons["9x9"].addEventListener("click", () => startPuzzle("9x9"));
document.addEventListener("visibilitychange", updateForNewDay);
window.setInterval(updateForNewDay, 60_000);
startPuzzle();
