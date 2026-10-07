const REPO_OWNER = "sehyunnoh";
const REPO_NAME = "word-cards";
const DATA_PATH = "data/words.json";
const BRANCH = "main";
const TOKEN_KEY = "wordCardsGhToken";

const el = {
  emptyState: document.getElementById("emptyState"),
  cardArea: document.getElementById("cardArea"),
  card: document.getElementById("card"),
  front: document.querySelector(".card-front"),
  back: document.querySelector(".card-back"),
  wordText: document.getElementById("wordText"),
  meaningText: document.getElementById("meaningText"),
  examplesList: document.getElementById("examplesList"),
  nextBtn: document.getElementById("nextBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  statusMsg: document.getElementById("statusMsg"),
  wordCount: document.getElementById("wordCount"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsPanel: document.getElementById("settingsPanel"),
  tokenInput: document.getElementById("tokenInput"),
  saveTokenBtn: document.getElementById("saveTokenBtn"),
  clearTokenBtn: document.getElementById("clearTokenBtn"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  tokenStatus: document.getElementById("tokenStatus"),
};

let words = [];
let fileSha = null;
let currentIndex = -1;
let flipped = false;

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(str) {
  return decodeURIComponent(escape(atob(str)));
}

function apiHeaders() {
  const headers = { Accept: "application/vnd.github+json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function loadWords() {
  setStatus("불러오는 중...");
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_PATH}?ref=${BRANCH}`,
      { headers: apiHeaders(), cache: "no-store" }
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    fileSha = data.sha;
    words = JSON.parse(base64ToUtf8(data.content));
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("단어 목록을 불러오지 못했어요. 새로고침 해보세요.");
  }
  render();
}

function pickRandomIndex() {
  if (words.length === 0) return -1;
  if (words.length === 1) return 0;
  let idx;
  do {
    idx = Math.floor(Math.random() * words.length);
  } while (idx === currentIndex);
  return idx;
}

function showNextCard() {
  flipped = false;
  currentIndex = pickRandomIndex();
  render();
}

function render() {
  el.wordCount.textContent = `(${words.length})`;

  if (words.length === 0) {
    el.emptyState.hidden = false;
    el.cardArea.hidden = true;
    return;
  }
  el.emptyState.hidden = true;
  el.cardArea.hidden = false;

  if (currentIndex === -1 || currentIndex >= words.length) {
    currentIndex = pickRandomIndex();
  }

  const current = words[currentIndex];
  el.wordText.textContent = current.word;
  el.meaningText.textContent = current.meaning || "";
  el.examplesList.innerHTML = "";
  (current.examples || []).forEach((ex) => {
    const li = document.createElement("li");
    li.textContent = ex;
    el.examplesList.appendChild(li);
  });

  el.front.hidden = flipped;
  el.back.hidden = !flipped;
}

function setStatus(msg) {
  el.statusMsg.textContent = msg;
}

function toggleFlip() {
  flipped = !flipped;
  render();
}

async function deleteCurrentWord() {
  if (currentIndex === -1) return;
  const token = getToken();
  if (!token) {
    openSettings();
    setStatus("삭제하려면 먼저 설정에서 토큰을 등록해주세요.");
    return;
  }

  const toDelete = words[currentIndex];
  const updated = words.filter((w) => w.id !== toDelete.id);

  setStatus("삭제 중...");
  el.deleteBtn.disabled = true;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_PATH}`,
      {
        method: "PUT",
        headers: { ...apiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `delete word: ${toDelete.word}`,
          content: utf8ToBase64(JSON.stringify(updated, null, 2) + "\n"),
          sha: fileSha,
          branch: BRANCH,
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body}`);
    }
    const data = await res.json();
    fileSha = data.content.sha;
    words = updated;
    setStatus(`"${toDelete.word}" 삭제됨`);
    showNextCard();
  } catch (err) {
    console.error(err);
    setStatus("삭제에 실패했어요. 토큰 권한을 확인해주세요.");
  } finally {
    el.deleteBtn.disabled = false;
  }
}

function openSettings() {
  el.tokenInput.value = getToken();
  el.tokenStatus.textContent = getToken() ? "토큰이 저장되어 있어요." : "저장된 토큰이 없어요.";
  el.settingsPanel.hidden = false;
}

function closeSettings() {
  el.settingsPanel.hidden = true;
}

el.card.addEventListener("click", toggleFlip);
el.nextBtn.addEventListener("click", showNextCard);
el.deleteBtn.addEventListener("click", deleteCurrentWord);
el.settingsBtn.addEventListener("click", openSettings);
el.closeSettingsBtn.addEventListener("click", closeSettings);

el.saveTokenBtn.addEventListener("click", () => {
  const value = el.tokenInput.value.trim();
  if (value) {
    localStorage.setItem(TOKEN_KEY, value);
    el.tokenStatus.textContent = "토큰이 저장되었어요.";
  }
});

el.clearTokenBtn.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  el.tokenInput.value = "";
  el.tokenStatus.textContent = "토큰을 삭제했어요.";
});

// swipe (mobile) -> next card. anything beyond a short horizontal or vertical
// drag counts, since the only "next" gesture needed is "move on".
let touchStartX = null;
let touchStartY = null;

el.cardArea.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
});

el.cardArea.addEventListener("touchend", (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  touchStartX = null;
  touchStartY = null;
  if (distance > 60) {
    e.preventDefault();
    showNextCard();
  }
});

loadWords();
