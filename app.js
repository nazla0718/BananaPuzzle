
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const PLAYER_STORAGE_KEY = "banana-bounce-player";

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
  { name: "Mia M.", score: 2840, avatar: "🌸" },
  { name: "Leo J.", score: 2610, avatar: "🦁" },
  { name: "Ava K.", score: 2430, avatar: "🦄" },
  { name: "Noah B.", score: 2210, avatar: "🐸" },
  { name: "Zoe P.", score: 1980, avatar: "🦊" }
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

// Load the saved player profile from browser local storage.
function loadPlayer() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(PLAYER_STORAGE_KEY) || "{}"
    );

    return {
      ...defaultPlayer,
      ...saved,
      name: saved.name || defaultPlayer.name,
      email: saved.email || "",
      score: Number(saved.score) || 0,
      bananas: Number(saved.bananas) || 0,
      completed: Array.isArray(saved.completed)
        ? saved.completed
        : []
    };
  } catch (error) {
    console.warn("Could not load saved player:", error);
    return { ...defaultPlayer, completed: [] };
  }
}

// Save the player profile to browser local storage.
function savePlayer() {
  try {
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify(player)
    );
  } catch (error) {
    console.error("Could not save player profile:", error);
  }
}

// Optional terminal logging has been disabled.
// The game does not need a separate debug server.
function terminalLog(message, data = {}) {
  console.log(`[BananaPuzzle] ${message}`, data);
}

function navigate(next) {
  terminalLog("Navigation", { from: screen, to: next });

  clearInterval(timer);
  screen = next;

  $$("[data-page]").forEach(el => {
    el.classList.toggle("hidden", el.dataset.page !== next);
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

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isUnlocked(key) {
  return (
    key === "bronze" ||
    (key === "silver" && player.completed.includes("bronze")) ||
    (key === "gold" && player.completed.includes("silver"))
  );
}

function renderLevels() {
  const grid = $("#levelGrid");
  if (!grid) return;

  grid.innerHTML = Object.entries(levelData)
    .map(([key, data], i) => {
      const unlocked = isUnlocked(key);

      return `
        <article class="level-card ${data.color} ${unlocked ? "" : "locked"}">
          <div class="level-top">
            <span>LEVEL 0${i + 1}</span>
            <span>${unlocked ? "✦ Unlocked" : "🔒 Locked"}</span>
          </div>

          <div class="level-medal">
            ${unlocked ? "🏅" : "🔒"}
          </div>

          <h3>${data.label}</h3>
          <p>${data.desc}</p>

          <div class="level-details">
            <span>♥ ${data.lives} lives</span>
            <span>◷ ${data.seconds}s</span>
            <span>✦ ${data.questions} puzzles</span>
          </div>

          <button class="button level-button"
            data-start="${key}" ${unlocked ? "" : "disabled"}>
            ${unlocked ? "Start trail →" : "Complete previous trail"}
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
  const max = key === "bronze" ? 5 : key === "silver" ? 8 : 10;
  const left = Math.floor(Math.random() * max) + 1;
  const add = key === "bronze" || Math.random() > 0.35;

  const right = add
    ? Math.floor(Math.random() * max) + 1
    : Math.floor(Math.random() * left) + 1;

  return {
    left,
    right,
    op: add ? "+" : "−",
    answer: add ? left + right : left - right
  };
}

function getOptions(answer) {
  const choices = new Set([answer]);

  while (choices.size < 4) {
    choices.add(
      Math.max(0, answer + Math.floor(Math.random() * 7) - 3)
    );
  }

  return [...choices].sort(() => Math.random() - 0.5);
}

function startGame(key) {
  if (!isUnlocked(key)) {
    terminalLog("Start blocked: trail is locked", { level: key });
    return;
  }

  terminalLog("Game started", { level: key, player: player.name });

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

    const timeElement = $("#timeLeft");
    if (timeElement) timeElement.textContent = time;

    if (time === 0) finishGame(false);
  }, 1000);
}

function nextPuzzle() {
  puzzle = makePuzzle(level);
  options = getOptions(puzzle.answer);
}

function renderGame() {
  if (screen !== "play" || !puzzle) return;

  const setText = (selector, value) => {
    const el = $(selector);
    if (el) el.textContent = value;
  };

  setText("#levelLabel", levelData[level].label.toUpperCase());
  setText(
    "#progressText",
    `Question ${question} of ${levelData[level].questions}`
  );

  const progressFill = $("#progressFill");
  if (progressFill) {
    progressFill.style.width =
      `${question / levelData[level].questions * 100}%`;
  }

  setText("#timeLeft", time);
  setText("#livesLeft", lives);
  setText("#runScore", runScore);

  const puzzleElement = $("#puzzle");

  if (puzzleElement) {
    puzzleElement.classList.add("banana-puzzle");
    puzzleElement.innerHTML = `
      <div class="banana-equation"
           aria-label="${puzzle.left} ${puzzle.op} ${puzzle.right} equals question mark">
        <div class="banana-group">${"🍌".repeat(puzzle.left)}</div>
        <span class="banana-operator">${puzzle.op}</span>
        <div class="banana-group">${"🍌".repeat(puzzle.right)}</div>
        <span class="banana-operator">=</span>
        <div class="banana-question">?</div>
      </div>
    `;
  }

  setText("#feedback", "");

  const answerGrid = $("#answerGrid");
  if (!answerGrid) return;

  answerGrid.innerHTML = options
    .map(n => `<button class="answer" data-answer="${n}">${n}</button>`)
    .join("");

  $$("[data-answer]").forEach(button => {
    button.addEventListener("click", () => {
      chooseAnswer(Number(button.dataset.answer), button);
    });
  });
}

function chooseAnswer(answer, button) {
  if (feedback || screen !== "play") return;

  terminalLog("Answer selected", {
    level,
    question,
    answer,
    correctAnswer: puzzle.answer,
    isCorrect: answer === puzzle.answer
  });

  feedback = answer === puzzle.answer ? "correct" : "wrong";

  $$(".answer").forEach(b => {
    b.disabled = true;

    if (Number(b.dataset.answer) === puzzle.answer) {
      b.classList.add("correct");
    }
  });

  if (feedback === "wrong") button.classList.add("wrong");

  const correct = feedback === "correct";

  if (correct) {
    runScore += 100 + time;
  } else {
    lives--;
  }

  const livesElement = $("#livesLeft");
  const scoreElement = $("#runScore");
  const feedbackElement = $("#feedback");

  if (livesElement) livesElement.textContent = lives;
  if (scoreElement) scoreElement.textContent = runScore;

  if (feedbackElement) {
    feedbackElement.textContent = correct
      ? "✨ Correct! Great banana brain!"
      : `Almost! The right answer is ${puzzle.answer}.`;
  }

  answerTimer = setTimeout(() => {
    if (lives <= 0) return finishGame(false);

    if (question >= levelData[level].questions) {
      return finishGame(true);
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
    el.classList.toggle("hidden", el.dataset.page !== "results");
  });

  const setText = (selector, value) => {
    const el = $(selector);
    if (el) el.textContent = value;
  };

  setText("#resultEmoji", success ? "🏆" : "🌴");
  setText("#resultKicker", success ? "TRAIL COMPLETE" : "KEEP PRACTISING");
  setText("#resultTitle", success ? "Amazing work!" : "Good try, adventurer!");

  setText(
    "#resultText",
    success
      ? "Momo is proud of you. You unlocked the next jungle trail!"
      : "Every puzzle makes you stronger. Ready for another go?"
  );

  setText("#resultScore", runScore.toLocaleString());

  const earned = success ? levelData[level].questions * 2 : 0;
  setText("#resultBananas", `${earned} 🍌`);

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
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submitScore() {
  try {
    terminalLog("Submitting score to PHP/MySQL API", {
      player: player.name,
      score: player.score,
      bananas: player.bananas
    });

    const response = await fetch("api.php?action=score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: player.name,
        score: player.score,
        bananas: player.bananas
      })
    });

    const result = await response.json();

    if (!response.ok || result.success === false) {
      throw new Error(result.error || "The server could not save the score.");
    }

    terminalLog("Score saved to MySQL", result);

    if (screen === "leaderboard") {
      await renderLeaders();
    }
  } catch (error) {
    terminalLog("PHP/MySQL score submission failed", {
      error: error.message
    });
    console.error("Could not save score to MySQL:", error);
  }
}

function renderShared() {
  const btn = $("#signInBtn");
  if (!btn) return;

  const hasIdentity =
    player.name &&
    player.name !== defaultPlayer.name;

  if (player.email || hasIdentity) {
    btn.textContent = player.name.split(" ")[0];
    btn.onclick = () => navigate("profile");
  } else {
    btn.textContent = "Sign in";
    btn.onclick = () => navigate("auth");
  }
}

async function renderDashboard() {
  const first = player.name.split(" ")[0];

  const setText = (selector, value) => {
    const el = $(selector);
    if (el) el.textContent = value;
  };

  setText("#welcomeName", `Hi, ${first}!`);
  setText("#dashBananas", player.bananas);
  setText("#dashScore", player.score.toLocaleString());
  setText("#dashCompleted", `${player.completed.length} / 3`);

  setText(
    "#nextTrail",
    player.completed.includes("silver")
      ? "Golden Summit"
      : player.completed.includes("bronze")
        ? "Silver Canopy"
        : "Bronze Trail"
  );

  const miniLeaders = $("#miniLeaders");
  if (!miniLeaders) return;

  miniLeaders.innerHTML = "<p>Loading leaderboard...</p>";

  try {
    const leaders = (await loadLeaderboardFromMySQL()).slice(0, 3);

    miniLeaders.innerHTML = leaders.length
      ? leaders.map((x, i) => `
          <div class="mini-rank">
            <b>${i + 1}</b>
            <span class="avatar">🐵</span>
            <strong>${escapeHtml(x.name)}</strong>
            <b>${Number(x.score).toLocaleString()}</b>
          </div>
        `).join("")
      : "<p>No scores yet. Finish a trail to appear here!</p>";
  } catch (error) {
    miniLeaders.innerHTML =
      "<p>Leaderboard unavailable. Check XAMPP and api.php.</p>";
    console.error("Could not load dashboard leaderboard:", error);
  }
}

async function loadLeaderboardFromMySQL() {
  const response = await fetch("api.php?action=leaderboard", {
    headers: { Accept: "application/json" }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Could not load leaderboard.");
  }

  if (!Array.isArray(result.scores)) {
    throw new Error("The API response must contain a scores array.");
  }

  return result.scores.map(row => ({
    name: row.player_name ?? row.name ?? "Jungle Player",
    score: Number(row.score) || 0,
    bananas: Number(row.bananas) || 0,
    created_at: row.created_at || ""
  }));
}

async function renderLeaders() {
  const listElement = $("#leaderList");
  if (!listElement) return;

  listElement.innerHTML = "<p>Loading leaderboard...</p>";

  try {
    const list = await loadLeaderboardFromMySQL();

    terminalLog("Leaderboard loaded from MySQL", {
      entries: list.length
    });

    listElement.innerHTML = list.length
      ? list.map((x, i) => `
          <div class="leader-row">
            <span class="rank">#${i + 1}</span>
            <span class="avatar">🐵</span>
            <div>
              <strong>${escapeHtml(x.name)}</strong><br>
              <small>${i === 0 ? "Jungle legend" : i < 3 ? "Top adventurer" : "Puzzle explorer"}</small>
            </div>
            <span class="leader-score">${Number(x.score).toLocaleString()} pts</span>
          </div>
        `).join("")
      : "<p>No scores have been saved yet. Complete a trail to be the first!</p>";
  } catch (error) {
    terminalLog("MySQL leaderboard load failed", {
      error: error.message
    });

    console.error("Could not load leaderboard from MySQL:", error);

    listElement.innerHTML =
      "<p>Could not load leaderboard. Make sure Apache and MySQL are running and api.php is configured for your database.</p>";
  }
}

function renderProfile() {
  const setText = (selector, value) => {
    const el = $(selector);
    if (el) el.textContent = value;
  };

  setText("#profileName", player.name);
  setText("#profileEmail", player.email || "No email added");
  setText("#profileBananas", player.bananas);
  setText("#profileScore", player.score.toLocaleString());
  setText("#profileCompleted", `${player.completed.length} / 3`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// Main navigation
$$("[data-screen]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.screen);
  });
});

// Quit the current game
const quitButton = $("#quitGame");

if (quitButton) {
  quitButton.addEventListener("click", () => {
    clearInterval(timer);
    clearTimeout(answerTimer);
    navigate("levels");
  });
}

// Sign out and clear the local player identity.
const signOutButton = $("#signOutBtn");

if (signOutButton) {
  signOutButton.addEventListener("click", () => {
    player = {
      ...defaultPlayer,
      completed: []
    };

    savePlayer();
    renderShared();
    navigate("home");
  });
}

// Sign-in and registration mode
$$("[data-auth]").forEach(button => {
  button.addEventListener("click", () => {
    authMode = button.dataset.auth;

    $$("[data-auth]").forEach(item => {
      item.classList.toggle("selected", item === button);
    });

    const nameLabel = $("#nameLabel");
    const nameInput = $("#nameLabel input");

    if (nameLabel) {
      nameLabel.classList.toggle("hidden", authMode !== "register");
    }

    if (nameInput) {
      nameInput.required = authMode === "register";
    }

    const authTitle = $("#authTitle");
    const authSubtitle = $("#authSubtitle");

    if (authTitle) {
      authTitle.textContent = authMode === "register"
        ? "Join the adventure!"
        : "Welcome back!";
    }

    if (authSubtitle) {
      authSubtitle.textContent = authMode === "register"
        ? "Create your player profile."
        : "Enter your details to continue.";
    }
  });
});

// Save the player's chosen name in local storage.
const authForm = $("#authForm");

if (authForm) {
  authForm.addEventListener("submit", event => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const enteredName = String(formData.get("name") || "").trim();

    let name;

    if (authMode === "register") {
      name = enteredName;
    } else {
      name = player.name !== defaultPlayer.name
        ? player.name
        : (email.split("@")[0] || "Jungle Player");
    }

    if (!name) {
      alert("Please enter your player name.");
      return;
    }

    player = {
      ...player,
      name,
      email
    };

    savePlayer();
    terminalLog("Player profile saved", { name: player.name });

    renderShared();
    navigate("dashboard");
  });
}

// Restore the saved player identity when the game opens.
renderShared();
renderLevels();
renderDashboard();
