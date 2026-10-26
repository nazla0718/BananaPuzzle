
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const levelData = {
  bronze: {
    label: "Bronze Trail",
    lives: 6,
    seconds: 60,
    questions: 5,
    color: "bronze",
    desc: "A sunny start with friendly banana puzzles.",
    difficulty: "Easy"
  },
  silver: {
    label: "Silver Canopy",
    lives: 4,
    seconds: 40,
    questions: 6,
    color: "silver",
    desc: "Swing higher with trickier banana puzzles.",
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

// Load the player's saved progress.
function loadPlayer() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("banana-bounce-player") || "{}"
    );

    return {
      ...defaultPlayer,
      ...saved,
      completed: Array.isArray(saved.completed)
        ? saved.completed
        : []
    };
  } catch (error) {
    console.error("Could not load player:", error);
    return { ...defaultPlayer };
  }
}

// Save player progress in the browser.
function savePlayer() {
  try {
    localStorage.setItem(
      "banana-bounce-player",
      JSON.stringify(player)
    );
  } catch (error) {
    console.error("Could not save player:", error);
  }
}

// Optional development logging.
function terminalLog(message, data = {}) {
  console.log("[Banana Bounce]", message, data);
}

// Change between pages.
function navigate(next) {
  clearInterval(timer);

  screen = next;

  $$("[data-page]").forEach(element => {
    element.classList.toggle(
      "hidden",
      element.dataset.page !== next
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

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Check which levels the player has unlocked.
function isUnlocked(key) {
  return (
    key === "bronze" ||
    (key === "silver" &&
      player.completed.includes("bronze")) ||
    (key === "gold" &&
      player.completed.includes("silver"))
  );
}

// Display the game levels.
function renderLevels() {
  const grid = $("#levelGrid");
  if (!grid) return;

  grid.innerHTML = Object.entries(levelData)
    .map(([key, data], index) => {
      const unlocked = isUnlocked(key);

      return `
        <article class="level-card ${data.color} ${unlocked ? "" : "locked"}">
          <div class="level-top">
            <span>LEVEL 0${index + 1}</span>
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

// Create a random puzzle.
function makePuzzle(key) {
  const max =
    key === "bronze" ? 5 :
    key === "silver" ? 8 : 10;

  const left = Math.floor(Math.random() * max) + 1;
  const addition = key === "bronze" || Math.random() > 0.35;

  const right = addition
    ? Math.floor(Math.random() * max) + 1
    : Math.floor(Math.random() * left) + 1;

  return {
    left,
    right,
    op: addition ? "+" : "−",
    answer: addition ? left + right : left - right
  };
}

// Generate four answer choices.
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

// Start a level.
function startGame(key) {
  if (!isUnlocked(key)) return;

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

  terminalLog("Game started", { level });
}

// Move to the next puzzle.
function nextPuzzle() {
  puzzle = makePuzzle(level);
  options = getOptions(puzzle.answer);
}

// Display the current banana puzzle.
function renderGame() {
  if (screen !== "play" || !puzzle) return;

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
        ${"🍌".repeat(puzzle.left)}
      </div>

      <span class="banana-operator">${puzzle.op}</span>

      <div class="banana-group">
        ${"🍌".repeat(puzzle.right)}
      </div>

      <span class="banana-operator">=</span>

      <div class="banana-question">?</div>
    </div>
  `;

  $("#feedback").textContent = "";

  $("#answerGrid").innerHTML = options
    .map(number => `
      <button class="answer" data-answer="${number}">
        ${number}
      </button>
    `)
    .join("");

  $$("[data-answer]").forEach(button => {
    button.addEventListener("click", () => {
      chooseAnswer(Number(button.dataset.answer), button);
    });
  });
}

// Check the selected answer.
function chooseAnswer(answer, button) {
  if (feedback || screen !== "play") return;

  feedback = answer === puzzle.answer ? "correct" : "wrong";

  $$(".answer").forEach(element => {
    element.disabled = true;

    if (Number(element.dataset.answer) === puzzle.answer) {
      element.classList.add("correct");
    }
  });

  if (feedback === "wrong") {
    button.classList.add("wrong");
  }

  const correct = feedback === "correct";

  if (correct) {
    runScore += 100 + time;
  } else {
    lives--;
  }

  $("#livesLeft").textContent = lives;
  $("#runScore").textContent = runScore;

  $("#feedback").textContent = correct
    ? "✨ Correct! Great banana brain!"
    : "Almost! The right answer is " + puzzle.answer + ".";

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

// Finish the current game.
function finishGame(success) {
  clearInterval(timer);
  clearTimeout(answerTimer);

  screen = "results";

  $$("[data-page]").forEach(element => {
    element.classList.toggle(
      "hidden",
      element.dataset.page !== "results"
    );
  });

  $("#resultEmoji").textContent = success ? "🏆" : "🌴";

  $("#resultKicker").textContent =
    success ? "TRAIL COMPLETE" : "KEEP PRACTISING";

  $("#resultTitle").textContent =
    success ? "Amazing work!" : "Good try, adventurer!";

  $("#resultText").textContent = success
    ? "Momo is proud of you. You unlocked the next jungle trail!"
    : "Every puzzle makes you stronger. Ready for another go?";

  $("#resultScore").textContent = runScore.toLocaleString();

  const earned = success ? levelData[level].questions * 2 : 0;
  $("#resultBananas").textContent = `${earned} 🍌`;

  if (success) {
    player.score += runScore;
    player.bananas += earned;

    if (!player.completed.includes(level)) {
      player.completed.push(level);
    }

    savePlayer();

    // Submit the completed run's score to the PHP/MySQL API.
    submitScore(runScore, earned);
  }

  renderShared();
  window.scrollTo({ top: 0, behavior: "smooth" });

  terminalLog("Game finished", {
    level,
    success,
    score: runScore,
    livesLeft: lives
  });
}

// Send a score to api.php.
async function submitScore(score, bananas) {
  try {
    const response = await fetch("api.php?action=score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        name: player.name,
        score,
        bananas
      })
    });

    const result = await response.json();

    if (!response.ok || result.success === false) {
      throw new Error(result.error || "Could not save score.");
    }

    console.log("Score saved:", result);

    if (screen === "leaderboard") {
      await renderLeaders();
    }
  } catch (error) {
    console.error(
      "Could not save score. Check Apache, MySQL and api.php:",
      error
    );
  }
}

// Update the sign-in button.
function renderShared() {
  const button = $("#signInBtn");
  if (!button) return;

  if (player.email) {
    button.textContent = player.name.split(" ")[0];
    button.onclick = () => navigate("profile");
  } else {
    button.textContent = "Sign in";
    button.onclick = () => navigate("auth");
  }
}

// Load the leaderboard from MySQL through PHP.
async function loadLeaderboardFromMySQL() {
  const response = await fetch("api.php?action=leaderboard", {
    headers: {
      "Accept": "application/json"
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Could not load leaderboard.");
  }

  if (!Array.isArray(result.scores)) {
    throw new Error("The API must return a scores array.");
  }

  return result.scores.map(row => ({
    name: row.player_name ?? row.name ?? "Jungle Player",
    score: Number(row.score) || 0,
    bananas: Number(row.bananas) || 0,
    created_at: row.created_at || ""
  }));
}

// Display the full leaderboard.
async function renderLeaders() {
  const listElement = $("#leaderList");
  if (!listElement) return;

  listElement.innerHTML = "<p>Loading leaderboard...</p>";

  try {
    const leaders = await loadLeaderboardFromMySQL();

    listElement.innerHTML = leaders.length
      ? leaders.map((item, index) => `
          <div class="leader-row">
            <span class="rank">#${index + 1}</span>
            <span class="avatar">🐵</span>
            <div>
              <strong>${escapeHtml(item.name)}</strong><br>
              <small>
                ${index === 0
                  ? "Jungle legend"
                  : index < 3
                    ? "Top adventurer"
                    : "Puzzle explorer"}
              </small>
            </div>
            <span class="leader-score">
              ${item.score.toLocaleString()} pts
            </span>
          </div>
        `).join("")
      : "<p>No scores yet. Complete a trail to be the first!</p>";
  } catch (error) {
    console.error("Could not load leaderboard:", error);
    listElement.innerHTML =
      "<p>Leaderboard unavailable. Check XAMPP and api.php.</p>";
  }
}

// Display the dashboard and its top three players.
async function renderDashboard() {
  const firstName = player.name.split(" ")[0];

  $("#welcomeName").textContent = `Hi, ${firstName}!`;
  $("#dashBananas").textContent = player.bananas;
  $("#dashScore").textContent = player.score.toLocaleString();
  $("#dashCompleted").textContent = `${player.completed.length} / 3`;

  $("#nextTrail").textContent =
    player.completed.includes("silver")
      ? "Golden Summit"
      : player.completed.includes("bronze")
        ? "Silver Canopy"
        : "Bronze Trail";

  const miniLeaders = $("#miniLeaders");
  if (!miniLeaders) return;

  miniLeaders.innerHTML = "<p>Loading leaderboard...</p>";

  try {
    const leaders = (await loadLeaderboardFromMySQL()).slice(0, 3);

    miniLeaders.innerHTML = leaders.length
      ? leaders.map((item, index) => `
          <div class="mini-rank">
            <b>${index + 1}</b>
            <span class="avatar">🐵</span>
            <strong>${escapeHtml(item.name)}</strong>
            <b>${item.score.toLocaleString()}</b>
          </div>
        `).join("")
      : "<p>No scores yet. Finish a trail to appear here!</p>";
  } catch (error) {
    console.error("Could not load dashboard leaderboard:", error);
    miniLeaders.innerHTML =
      "<p>Leaderboard unavailable. Check XAMPP and api.php.</p>";
  }
}

// Display the player's profile.
function renderProfile() {
  $("#profileName").textContent = player.name;
  $("#profileEmail").textContent = player.email;
  $("#profileBananas").textContent = player.bananas;
  $("#profileScore").textContent = player.score.toLocaleString();
  $("#profileCompleted").textContent =
    `${player.completed.length} / 3`;
}

// Prevent player names from inserting HTML into the page.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

// Navigation buttons.
$$("[data-screen]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.screen);
  });
});

// Quit the game.
$("#quitGame").addEventListener("click", () => {
  clearInterval(timer);
  clearTimeout(answerTimer);
  navigate("levels");
});

// Sign out of the local player profile.
$("#signOutBtn").addEventListener("click", () => {
  player = { ...defaultPlayer, completed: [] };
  savePlayer();
  renderShared();
  navigate("home");
});

// Switch between sign-in and registration.
$$("[data-auth]").forEach(button => {
  button.addEventListener("click", () => {
    authMode = button.dataset.auth;

    $$("[data-auth]").forEach(item => {
      item.classList.toggle("selected", item === button);
    });

    $("#nameLabel").classList.toggle(
      "hidden",
      authMode !== "register"
    );

    $("#nameLabel input").required = authMode === "register";

    $("#authTitle").textContent =
      authMode === "register"
        ? "Join the adventure!"
        : "Welcome back!";

    $("#authSubtitle").textContent =
      authMode === "register"
        ? "Create your player profile."
        : "Enter your details to continue.";
  });
});

// Demo sign-in: this saves the player locally, not to a user account database.
$("#authForm").addEventListener("submit", event => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "");

  const name = String(
    formData.get("name") ||
    email.split("@")[0] ||
    "Jungle Player"
  ).trim();

  player = { ...player, name, email };

  savePlayer();
  renderShared();
  navigate("dashboard");
});

// Initial page setup.
renderShared();
renderLevels();
renderDashboard();
