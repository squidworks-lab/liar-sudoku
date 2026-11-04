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

function getTodayInJapan() {
  const dateParts = Object.fromEntries(
    jstDateFormatter.formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function startPuzzle(dateKey = getTodayInJapan()) {
  puzzleDate = dateKey;
  puzzle = generateDailyPuzzle(puzzleDate);
  selectedIndex = null;
  answered = false;
  guessesMade = 0;
  puzzleDateElement.textContent = puzzleDate.replaceAll("-", ".");
  feedbackElement.textContent = "";
  feedbackElement.className = "feedback";
  answerHintElement.hidden = false;
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
    feedbackElement.textContent = `正解！このマスの本当の数字は ${puzzle.solution[index]} です。`;
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