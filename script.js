import { generateDailyPuzzle, generateDailyPuzzle9 } from "./game-logic.mjs?v=4";
import { createGameEventTracker, initializeGoogleAnalytics } from "./analytics.mjs?v=2";

initializeGoogleAnalytics(window.location.hostname, window, document);

const boardElement = document.querySelector("#board");
const feedbackElement = document.querySelector("#feedback");
const answerHintElement = document.querySelector("#answer-hint");
const puzzleDateElement = document.querySelector("#puzzle-date");
const shareButton = document.querySelector("#share-button");
const puzzleHeadingElement = document.querySelector("#puzzle-heading");
const ruleBlockSizeElement = document.querySelector("#rule-block-size");
const ruleDigitsElement = document.querySelector("#rule-digits");
const memoControlsElement = document.querySelector("#memo-controls");
const memoStatusElement = document.querySelector("#memo-status");
const memoValueButtons = [...document.querySelectorAll("[data-memo-value]")];
const memoDeleteButton = document.querySelector("[data-memo-delete]");
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

function getMemoKey(dateKey) {
  return `liar-sudoku:memos:9x9:${dateKey}`;
}

function loadMemoValues(dateKey, clues) {
  let serialized;
  try {
    serialized = window.localStorage.getItem(getMemoKey(dateKey));
  } catch (error) {
    if (error instanceof DOMException) {
      return { values: {}, notice: "このブラウザーではメモを読み込めません。" };
    }
    throw error;
  }
  if (!serialized) return { values: {}, notice: "" };

  let values;
  try {
    values = JSON.parse(serialized);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { values: {}, notice: "保存されたメモを読み取れませんでした。" };
    }
    throw error;
  }

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return { values: {}, notice: "保存されたメモの形式が正しくありません。" };
  }
  for (const [indexText, value] of Object.entries(values)) {
    const index = Number(indexText);
    if (
      !/^(0|[1-9]\d*)$/.test(indexText)
      || !Number.isInteger(index)
      || index >= clues.length
      || clues[index] !== 0
      || !Number.isInteger(value)
      || value < 1
      || value > 9
    ) {
      return { values: {}, notice: "保存されたメモの形式が正しくありません。" };
    }
  }
  return { values, notice: "" };
}

function saveMemoValues(dateKey, values) {
  try {
    window.localStorage.setItem(getMemoKey(dateKey), JSON.stringify(values));
    return "";
  } catch (error) {
    if (error instanceof DOMException) {
      return "メモをこのブラウザーに保存できませんでした。";
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
  const savedMemos = mode === "9x9"
    ? loadMemoValues(dateKey, puzzle.clues)
    : { values: {}, notice: "" };
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
    memoValues: savedMemos.values,
    memoSelectedIndex: null,
    memoNotice: savedMemos.notice,
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
  memoControlsElement.hidden = activeMode !== "9x9";
  updateMemoControls();
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
    if (value) {
      cell.setAttribute("aria-label", `${row + 1}行${column + 1}列、${visibleValue}のヒント`);
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
    } else if (activeMode === "9x9") {
      const memoValue = state.memoValues[index];
      cell.textContent = memoValue ? String(memoValue) : "";
      cell.setAttribute(
        "aria-label",
        `${row + 1}行${column + 1}列、空欄${memoValue ? `、メモ ${memoValue}` : ""}`,
      );
      if (memoValue) cell.classList.add("is-memo");
      if (state.memoSelectedIndex === index) {
        cell.classList.add("is-selected");
        cell.setAttribute("aria-pressed", "true");
      }
      if (state.answered) {
        cell.disabled = true;
      } else {
        cell.classList.add("is-editable");
        cell.addEventListener("click", () => selectMemoCell(index));
      }
    } else {
      cell.disabled = true;
      cell.setAttribute("aria-label", `${row + 1}行${column + 1}列、空欄`);
    }
    fragment.append(cell);
  });
  boardElement.replaceChildren(fragment);
}

function updateMemoControls() {
  if (activeMode !== "9x9") return;
  const hasSelection = state.memoSelectedIndex !== null;
  memoStatusElement.textContent = state.memoNotice
    || (state.answered
      ? "クリア済みのためメモは編集できません。"
      : hasSelection
        ? "選択中のマスに数字を入力できます。"
        : "空欄のマスを選択してください。");
  for (const button of memoValueButtons) {
    button.disabled = state.answered || !hasSelection;
  }
  memoDeleteButton.disabled = state.answered || !hasSelection;
}

function selectMemoCell(index) {
  if (activeMode !== "9x9" || state.answered || state.puzzle.clues[index] !== 0) return;
  state.memoSelectedIndex = index;
  state.selectedIndex = null;
  state.lastIncorrectIndex = null;
  renderBoard();
  updateMemoControls();
  boardElement.children[index].focus();
}

function setMemoValue(value) {
  if (
    activeMode !== "9x9"
    || state.answered
    || state.memoSelectedIndex === null
    || state.puzzle.clues[state.memoSelectedIndex] !== 0
  ) return;

  if (value === null) {
    delete state.memoValues[state.memoSelectedIndex];
  } else {
    state.memoValues[state.memoSelectedIndex] = value;
  }
  state.memoNotice = saveMemoValues(state.dateKey, state.memoValues);
  renderBoard();
  updateMemoControls();
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
  state.memoSelectedIndex = null;
  updateMemoControls();
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
    updateMemoControls();
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

for (const button of memoValueButtons) {
  button.addEventListener("click", () => setMemoValue(Number(button.dataset.memoValue)));
}
memoDeleteButton.addEventListener("click", () => setMemoValue(null));
document.addEventListener("keydown", (event) => {
  if (
    activeMode !== "9x9"
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.target.isContentEditable
    || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
  ) return;

  if (/^[1-9]$/.test(event.key)) {
    if (state.memoSelectedIndex !== null && !state.answered) {
      event.preventDefault();
      setMemoValue(Number(event.key));
    }
  } else if (["Backspace", "Delete"].includes(event.key)) {
    if (state.memoSelectedIndex !== null && !state.answered) {
      event.preventDefault();
      setMemoValue(null);
    }
  }
});

modeButtons["4x4"].addEventListener("click", () => startPuzzle("4x4"));
modeButtons["9x9"].addEventListener("click", () => startPuzzle("9x9"));
document.addEventListener("visibilitychange", updateForNewDay);
window.setInterval(updateForNewDay, 60_000);
startPuzzle();
