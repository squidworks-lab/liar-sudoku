import { generateDailyPuzzle } from "./game-logic.mjs?v=2";

const boardElement = document.querySelector("#board");
const feedbackElement = document.querySelector("#feedback");
const answerHintElement = document.querySelector("#answer-hint");
const puzzleDateElement = document.querySelector("#puzzle-date");
const shareButton = document.querySelector("#share-button");
const jstDateFormatter = new Intl.DateTimeFormat("en-US", {
  calendar: "gregory",
  numberingSystem: "latn",
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

let puzzle;
let puzzleDate;
let selectedIndex = null;
let answered = false;
let guessesMade = 0;
let persistenceNotice = "";

function getDailyResultKey(dateKey) {
  return `liar-sudoku:daily-result:${dateKey}`;
}

function loadDailyResult(dateKey) {
  let serialized;
  try {
    serialized = window.localStorage.getItem(getDailyResultKey(dateKey));
  } catch (error) {
    if (error instanceof DOMException) {
      persistenceNotice = "このブラウザーではクリア状態を読み込めません。";
      return null;
    }
    throw error;
  }
  if (!serialized) return null;

  let result;
  try {
    result = JSON.parse(serialized);
  } catch (error) {
    if (error instanceof SyntaxError) {
      persistenceNotice = "保存されたクリア状態を読み取れませんでした。";
      return null;
    }
    throw error;
  }
  if (result?.completed === true && Number.isInteger(result.guessesMade) && result.guessesMade > 0) {
    return result;
  }

  persistenceNotice = "保存されたクリア状態の形式が正しくありません。";
  return null;
}

function saveDailyResult(dateKey, result) {
  try {
    window.localStorage.setItem(getDailyResultKey(dateKey), JSON.stringify(result));
    return true;
  } catch (error) {
    if (error instanceof DOMException) {
      persistenceNotice = "クリア状態をこのブラウザーに保存できませんでした。";
      return false;
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

function startPuzzle(dateKey = getTodayInJapan()) {
  puzzleDate = dateKey;
  puzzle = generateDailyPuzzle(puzzleDate);
  persistenceNotice = "";
  const savedResult = loadDailyResult(puzzleDate);
  answered = savedResult !== null;
  selectedIndex = answered ? puzzle.liarIndex : null;
  guessesMade = savedResult?.guessesMade ?? 0;
  puzzleDateElement.textContent = puzzleDate.replaceAll("-", ".");
  feedbackElement.textContent = answered
    ? `本日の問題はクリア済みです。${guessesMade}回目で正解しました。`
    : persistenceNotice;
  feedbackElement.className = "feedback";
  if (answered) feedbackElement.classList.add("is-correct");
  answerHintElement.hidden = answered;
  renderBoard();
  updateShareLink();
}

function updateForNewDay() {
  if (getTodayInJapan() !== puzzleDate) startPuzzle();
}

function renderBoard() {
  const fragment = document.createDocumentFragment();
  puzzle.clues.forEach((value, index) => {
    const cell = document.createElement("button");
    const row = Math.floor(index / 4) + 1;
    const column = (index % 4) + 1;
    cell.type = "button";
    cell.className = "cell";
    cell.setAttribute("aria-label", ` ${row}行${column}列、${value ? `${value}のヒント` : "空欄"}`);

    if (value) {
      cell.textContent = String(answered && index === puzzle.liarIndex ? puzzle.solution[index] : value);
      cell.classList.add("is-clue");
      cell.setAttribute("aria-label", `${row}行${column}列、${value}のヒント`);
      if (selectedIndex === index && !answered) cell.classList.add("is-selected");
      if (answered && index === puzzle.liarIndex) {
        cell.classList.add("is-revealed");
        cell.setAttribute("aria-label", `${row}行${column}列、ウソのヒント。本当の数字は${puzzle.solution[index]}`);
      }
      cell.addEventListener("click", () => chooseCell(index));
    } else {
      cell.disabled = true;
      cell.setAttribute("aria-label", `${row}行${column}列、空欄`);
    }
    fragment.append(cell);
  });
  boardElement.replaceChildren(fragment);
}

function updateShareLink() {
  const date = puzzleDate.replaceAll("-", ".");
  const result = answered
    ? guessesMade === 1
      ? "一発正解！今日のウソを見破った！"
      : `${guessesMade}回目で正解！今日のウソを見破った！`
    : "挑戦中！あなたはウソの数字を見破れる？";
  const shareUrl = new URL("https://twitter.com/intent/tweet");
  shareUrl.searchParams.set(
    "text",
    `【今日のウソツキ数独｜${date}】\n4×4数独に、ウソの数字がひとつ。\n${result}\n友だちも挑戦してみて！\n#ウソツキ数独`,
  );
  shareUrl.searchParams.set("url", window.location.href);
  shareButton.href = shareUrl.toString();
}

function chooseCell(index) {
  if (answered) return;
  guessesMade += 1;
  selectedIndex = index;
  feedbackElement.textContent = "";
  feedbackElement.className = "feedback";
  renderBoard();
  const selectedCell = boardElement.children[index];
  selectedCell.focus();

  if (index === puzzle.liarIndex) {
    answered = true;
    answerHintElement.hidden = true;
    const saved = saveDailyResult(puzzleDate, { completed: true, guessesMade });
    feedbackElement.textContent = saved || !persistenceNotice
      ? `正解！このマスの本当の数字は ${puzzle.solution[index]} です。`
      : `正解！このマスの本当の数字は ${puzzle.solution[index]} です。${persistenceNotice}`;
    feedbackElement.classList.add("is-correct");
    renderBoard();
    updateShareLink();
  } else {
    feedbackElement.textContent = "ここは正しいヒントです。ほかの数字を探してみましょう。";
    feedbackElement.classList.add("is-incorrect");
    selectedCell.classList.add("is-incorrect");
    updateShareLink();
  }
}

document.addEventListener("visibilitychange", updateForNewDay);
window.setInterval(updateForNewDay, 60_000);
startPuzzle();