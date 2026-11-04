import { generatePuzzle } from "./game-logic.mjs";

const boardElement = document.querySelector("#board");
const feedbackElement = document.querySelector("#feedback");
const answerHintElement = document.querySelector("#answer-hint");
const puzzleNumberElement = document.querySelector("#puzzle-number");
const nextButton = document.querySelector("#next-button");

let puzzle;
let puzzleNumber = 0;
let selectedIndex = null;
let answered = false;

function startPuzzle() {
  puzzle = generatePuzzle();
  puzzleNumber += 1;
  selectedIndex = null;
  answered = false;
  puzzleNumberElement.textContent = String(puzzleNumber).padStart(2, "0");
  feedbackElement.textContent = "";
  feedbackElement.className = "feedback";
  answerHintElement.hidden = false;
  renderBoard();
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

function chooseCell(index) {
  if (answered) return;
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
  } else {
    feedbackElement.textContent = "ここは正しいヒントです。ほかの数字を探してみましょう。";
    feedbackElement.classList.add("is-incorrect");
    selectedCell.classList.add("is-incorrect");
  }
}

nextButton.addEventListener("click", startPuzzle);
startPuzzle();