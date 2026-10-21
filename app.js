const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const levelData = {
  bronze: {
    label: "Bronze Trail",
    lives: 6,
    seconds: 60,
    questions: 5,
    color: "bronze",
    desc: "A sunny start with friendly number puzzles.",
    difficulty: "Easy"
  },
  silver: {
    label: "Silver Canopy",
    lives: 4,
    seconds: 40,
    questions: 6,
    color: "silver",
    desc: "Swing higher with trickier number challenges.",
    difficulty: "Medium"
  },
  gold: {
    label: "Golden Summit",
    lives: 2,
    seconds: 20,
    questions: 7,
    color: "gold",
    desc: "The ultimate jungle brain challenge!",
    difficulty: "Hard"
  }
};

const demoLeaders = [
  { name: "Mia M.", score: 2840, avatar: "\u{1F338}" },
  { name: "Leo J.", score: 2610, avatar: "\u{1F981}" },
  { name: "Ava K.", score: 2430, avatar: "\u{1F984}" },
  { name: "Noah B.", score: 2210, avatar: "\u{1F438}" },
  { name: "Zoe P.", score: 1980, avatar: "\u{1F98A}" }
];

const defaultPlayer = {
  name: "Jungle Guest",
  email: "",
  score: 0,
  bananas: 0,
  completed: []
};

let player = loadPlayer();
let screen = "home";
let authMode = "signin";
let level = "bronze";
let puzzle = null;
let options = [];
let question = 1;
let lives = 6;
let time = 60;
let runScore = 0;
let feedback = null;
let timer = null;
let answerTimer = null;

// Send game events to the VS Code terminal.
// Run debug-server.js in a separate terminal for this to work.
function terminalLog(message, data = {}) {
  fetch("http://localhost:3001/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      time: new Date().toLocaleTimeString(),
      message,
      data
    })
  }).catch(error => {
    console.warn(
      "Terminal logger is unavailable:",
      error.message
    );
  });
}

function loadPlayer() {
  try {
    return {
      ...defaultPlayer,
      ...JSON.parse(
        localStorage.getItem("banana-bounce-player") || "{}"
      )
    };
  } catch {
    return { ...defaultPlayer };
  }
}

function savePlayer() {
  localStorage.setItem(
    "banana-bounce-player",
    JSON.stringify(player)
  );
}

function navigate(next) {
  terminalLog("Navigation", {
    from: screen,
    to: next
  });

  clearInterval(timer);
  screen = next;

  $$("[data-page]").forEach(el => {
    el.classList.toggle(
      "hidden",
      el.dataset.page !== next
    );
  });

  $$(".nav-links button").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.screen === next
    );
  });

  renderShared();

  if (next === "levels") renderLevels();
  if (next === "leaderboard") renderLeaders();
  if (next === "dashboard") renderDashboard();
  if (next === "profile") renderProfile();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function isUnlocked(key) {
  return (
    key === "bronze" ||
    (key === "silver" &&
      player.completed.includes("bronze")) ||
    (key === "gold" &&
      player.completed.includes("silver"))
  );
}

function renderLevels() {
  const grid = $("#levelGrid");

  grid.innerHTML = Object.entries(levelData)
    .map(([key, data], i) => {
      const unlocked = isUnlocked(key);

      return `
        <article class="level-card ${data.color} ${unlocked ? "" : "locked"}">
          <div class="level-top">
            <span>LEVEL 0${i + 1}</span>
            <span>${unlocked ? "\u2726 Unlocked" : "\u{1F512} Locked"}</span>
          </div>

          <div class="level-medal">
            ${unlocked ? "\u{1F3C5}" : "\u{1F512}"}
          </div>

          <h3>${data.label}</h3>
          <p>${data.desc}</p>

          <div class="level-details">
            <span>\u2665 ${data.lives} lives</span>
            <span>\u25F7 ${data.seconds}s</span>
            <span>\u2726 ${data.questions} puzzles</span>
          </div>

          <button class="button level-button"
            data-start="${key}" ${unlocked ? "" : "disabled"}>
            ${unlocked ? "Start trail \u2192" : "Complete previous trail"}
          </button>
        </article>
      `;
    })
    .join("");

  $$("[data-start]").forEach(button => {
    button.addEventListener("click", () => {
      startGame(button.dataset.start);
    });
  });
}

function makePuzzle(key) {
  const max =
    key === "bronze" ? 5 :
    key === "silver" ? 8 : 10;

  const left = Math.floor(Math.random() * max) + 1;
  const add = key === "bronze" || Math.random() > 0.35;

  const right = add
    ? Math.floor(Math.random() * max) + 1
    : Math.floor(Math.random() * left) + 1;

  return {
    left,
    right,
    op: add ? "+" : "\u2212",
    answer: add ? left + right : left - right
  };
}

function getOptions(answer) {
  const choices = new Set([answer]);

  while (choices.size < 4) {
    choices.add(
      Math.max(
        0,
        answer + Math.floor(Math.random() * 7) - 3
      )
    );
  }

  return [...choices].sort(() => Math.random() - 0.5);
}

function startGame(key) {
  if (!isUnlocked(key)) {
    terminalLog("Start blocked: trail is locked", {
      level: key
    });
    return;
  }

  terminalLog("Game started", {
    level: key,
    player: player.name
  });

  clearInterval(timer);
  clearTimeout(answerTimer);

  level = key;
  question = 1;
  lives = levelData[key].lives;
  time = levelData[key].seconds;
  runScore = 0;
  feedback = null;

  nextPuzzle();
  navigate("play");
  renderGame();

  timer = setInterval(() => {
    time = Math.max(0, time - 1);
    $("#timeLeft").textContent = time;

    if (time === 0) {
      terminalLog("Timer expired", {
        level,
        question
      });
      finishGame(false);
    }
  }, 1000);
}

function nextPuzzle() {
  puzzle = makePuzzle(level);
  options = getOptions(puzzle.answer);

  terminalLog("New question", {
    level,
    question,
    left: puzzle.left,
    operator: puzzle.op,
    right: puzzle.right
  });
}

function renderGame() {
  if (screen !== "play") return;

  $("#levelLabel").textContent =
    levelData[level].label.toUpperCase();

  $("#progressText").textContent =
    `Question ${question} of ${levelData[level].questions}`;

  $("#progressFill").style.width =
    `${question / levelData[level].questions * 100}%`;

  $("#timeLeft").textContent = time;
  $("#livesLeft").textContent = lives;
  $("#runScore").textContent = runScore;

  const puzzleElement = $("#puzzle");
  puzzleElement.classList.add("banana-puzzle");

  puzzleElement.innerHTML = `
    <div class="banana-equation"
         aria-label="${puzzle.left} ${puzzle.op} ${puzzle.right} equals question mark">

      <div class="banana-group">
        ${"\u{1F34C}".repeat(puzzle.left)}
      </div>

      <span class="banana-operator">${puzzle.op}</span>

      <div class="banana-group">
        ${"\u{1F34C}".repeat(puzzle.right)}
      </div>

      <span class="banana-operator">=</span>

      <div class="banana-question">?</div>
    </div>
  `;

  $("#feedback").textContent = "";

  $("#answerGrid").innerHTML = options
    .map(n =>
      `<button class="answer" data-answer="${n}">${n}</button>`
    )
    .join("");

  $$("[data-answer]").forEach(button => {
    button.addEventListener("click", () => {
      chooseAnswer(Number(button.dataset.answer), button);
    });
  });
}

function chooseAnswer(answer, button) {
  if (feedback || screen !== "play") return;

  const correctAnswer = puzzle.answer;
  const isCorrect = answer === correctAnswer;

  terminalLog("Answer selected", {
    level,
    question,
    answer,
    correctAnswer,
    isCorrect
  });

  feedback = isCorrect ? "correct" : "wrong";

  $$(".answer").forEach(b => {
    b.disabled = true;

    if (Number(b.dataset.answer) === correctAnswer) {
      b.classList.add("correct");
    }
  });

  if (feedback === "wrong") {
    button.classList.add("wrong");
  }

  if (isCorrect) {
    runScore += 100 + time;
  } else {
    lives--;
  }

  $("#livesLeft").textContent = lives;
  $("#runScore").textContent = runScore;

  $("#feedback").textContent = isCorrect
    ? "\u2728 Correct! Great banana brain!"
    : "Almost! The right answer is " + correctAnswer + ".";

  terminalLog("Answer result", {
    correct: isCorrect,
    score: runScore,
    livesRemaining: lives
  });

  answerTimer = setTimeout(() => {
    if (lives <= 0) {
      finishGame(false);
      return;
    }

    if (question >= levelData[level].questions) {
      finishGame(true);
      return;
    }

    question++;
    feedback = null;
    nextPuzzle();
    renderGame();
  }, 650);
}

function finishGame(success) {
  terminalLog("Game finished", {
    level,
    success,
    score: runScore,
    livesLeft: lives,
    questionsAnswered: question
  });

  clearInterval(timer);
  clearTimeout(answerTimer);

  screen = "results";

  $$("[data-page]").forEach(el => {
    el.classList.toggle(
      "hidden",
      el.dataset.page !== "results"
    );
  });

  $("#resultEmoji").textContent =
    success ? "\u{1F3C6}" : "\u{1F334}";

  $("#resultKicker").textContent =
    success ? "TRAIL COMPLETE" : "KEEP PRACTISING";

  $("#resultTitle").textContent =
    success ? "Amazing work!" : "Good try, adventurer!";

  $("#resultText").textContent = success
    ? "Momo is proud of you. You unlocked the next jungle trail!"
    : "Every puzzle makes you stronger. Ready for another go?";

  $("#resultScore").textContent =
    runScore.toLocaleString();

  const earned =
    success ? levelData[level].questions * 2 : 0;

  $("#resultBananas").textContent =
    earned + " \u{1F34C}";

  if (success) {
    player.score += runScore;
    player.bananas += earned;

    if (!player.completed.includes(level)) {
      player.completed.push(level);
    }

    savePlayer();
    submitScore();
  }

  renderShared();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function submitScore() {
  try {
    terminalLog("Submitting score to PHP API", {
      player: player.name,
      score: player.score,
      bananas: player.bananas
    });

    const response = await fetch("api.php?action=score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: player.name,
        score: player.score,
        bananas: player.bananas
      })
    });

    const responseText = await response.text();

    terminalLog("PHP score API response", {
      status: response.status,
      body: responseText
    });

    if (!response.ok) {
      console.error("Score submission failed:", responseText);
    }
  } catch (error) {
    terminalLog("PHP score submission failed", {
      error: error.message
    });

    console.error("Could not submit score:", error.message);
  }
}

function renderShared() {
  const btn = $("#signInBtn");

  if (!btn) return;

  if (player.email) {
    btn.textContent = player.name.split(" ")[0];
    btn.onclick = () => navigate("profile");
  } else {
    btn.textContent = "Sign in";
    btn.onclick = () => navigate("auth");
  }
}

function renderDashboard() {
  const first = player.name.split(" ")[0];

  $("#welcomeName").textContent = `Hi, ${first}!`;
  $("#dashBananas").textContent = player.bananas;
  $("#dashScore").textContent =
    player.score.toLocaleString();

  $("#dashCompleted").textContent =
    `${player.completed.length} / 3`;

  $("#nextTrail").textContent =
    player.completed.includes("silver")
      ? "Golden Summit"
      : player.completed.includes("bronze")
        ? "Silver Canopy"
        : "Bronze Trail";

  const leaders = combinedLeaders().slice(0, 3);

  $("#miniLeaders").innerHTML = leaders
    .map((x, i) => `
      <div class="mini-rank">
        <b>${i + 1}</b>
        <span class="avatar">${x.avatar || "\u{1F435}"}</span>
        <strong>${escapeHtml(x.name)}</strong>
        <b>${x.score.toLocaleString()}</b>
      </div>
    `)
    .join("");
}

function combinedLeaders() {
  const list = [...demoLeaders];

  if (player.score > 0) {
    list.push({
      name: player.name,
      score: player.score,
      avatar: "\u{1F435}"
    });
  }

  return list.sort((a, b) => b.score - a.score);
}

function renderLeaders() {
  const list = combinedLeaders();

  terminalLog("Leaderboard rendered (demo/local data)", {
    entries: list.length
  });

  $("#leaderList").innerHTML = list
    .map((x, i) => `
      <div class="leader-row">
        <span class="rank">#${i + 1}</span>
        <span class="avatar">${x.avatar || "\u{1F435}"}</span>
        <div>
          <strong>${escapeHtml(x.name)}</strong><br>
          <small>
            ${i === 0
              ? "Jungle legend"
              : i < 3
                ? "Top adventurer"
                : "Puzzle explorer"}
          </small>
        </div>
        <span class="leader-score">
          ${x.score.toLocaleString()} pts
        </span>
      </div>
    `)
    .join("");
}

function renderProfile() {
  $("#profileName").textContent = player.name;
  $("#profileEmail").textContent = player.email;
  $("#profileBananas").textContent = player.bananas;

  $("#profileScore").textContent =
    player.score.toLocaleString();

  $("#profileCompleted").textContent =
    `${player.completed.length} / 3`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

// Navigation buttons
$$("[data-screen]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.screen);
  });
});

// Quit the current game
const quitButton = $("#quitGame");

if (quitButton) {
  quitButton.addEventListener("click", () => {
    terminalLog("Game quit by player", {
      level,
      question,
      score: runScore
    });

    clearInterval(timer);
    clearTimeout(answerTimer);
    navigate("levels");
  });
}

// Sign out
const signOutButton = $("#signOutBtn");

if (signOutButton) {
  signOutButton.addEventListener("click", () => {
    terminalLog("Player signed out", {
      player: player.name
    });

    player = { ...defaultPlayer };
    savePlayer();
    renderShared();
    navigate("home");
  });
}

// Sign-in and registration tabs
$$("[data-auth]").forEach(button => {
  button.addEventListener("click", () => {
    authMode = button.dataset.auth;

    $$(".[data-auth]").forEach(x => {
      x.classList.toggle("selected", x === button);
    });

    $("#nameLabel").classList.toggle(
      "hidden",
      authMode !== "register"
    );

    $("#nameLabel input").required =
      authMode === "register";

    $("#authTitle").textContent =
      authMode === "register"
        ? "Join the adventure!"
        : "Welcome back!";

    $("#authSubtitle").textContent =
      authMode === "register"
        ? "Create your player profile."
        : "Enter your details to continue.";

    terminalLog("Authentication mode changed", {
      mode: authMode
    });
  });
});

// Demo sign-in form
const authForm = $("#authForm");

if (authForm) {
  authForm.addEventListener("submit", event => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");

    const name = String(
      formData.get("name") ||
      email.split("@")[0] ||
      "Jungle Player"
    );

    player = {
      ...player,
      name,
      email
    };

    terminalLog("Demo sign-in submitted", {
      name: player.name,
      email: player.email
    });

    savePlayer();
    renderShared();
    navigate("dashboard");
  });
}

// Start the app
renderShared();
renderLevels();
renderDashboard();

terminalLog("Banana Bounce application loaded", {
  player: player.name,
  currentScreen: screen
});