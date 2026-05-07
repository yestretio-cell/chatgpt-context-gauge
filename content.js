const PANEL_ID = "gpt-token-counter-panel";
const STORAGE_KEY = "gptTokenCounterState";
const TOKENIZER_ENCODING = "o200k_base";

const DEFAULT_STATE = {
  collapsed: false,
  closed: false,
  includeComposer: true,
  x: null,
  y: null
};

let state = { ...DEFAULT_STATE };
let debounceTimer = null;
let observer = null;
let drag = null;

function textFromElement(element) {
  if (typeof element?.value === "string") return element.value;
  return element?.innerText || element?.textContent || "";
}

function uniqueTexts(elements) {
  const seen = new Set();
  const values = [];

  for (const element of elements) {
    const text = textFromElement(element);
    if (text.length === 0 || seen.has(text)) continue;
    seen.add(text);
    values.push(text);
  }

  return values;
}

function getConversationTexts() {
  const selectors = [
    "[data-message-author-role]",
    "[data-testid^='conversation-turn-']",
    "article"
  ];

  for (const selector of selectors) {
    const elements = [...document.querySelectorAll(selector)]
      .filter((element) => !element.closest(`#${PANEL_ID}, .gtc-raw-backdrop`));
    const texts = uniqueTexts(elements);
    if (texts.length > 0) return texts;
  }

  const main = document.querySelector("main");
  return main ? [textFromElement(main)] : [];
}

function getComposerText() {
  const candidates = [
    "#prompt-textarea",
    "textarea",
    "[contenteditable='true']"
  ];

  for (const selector of candidates) {
    const element = document.querySelector(selector);
    const text = textFromElement(element);
    if (text) return text;
  }

  return "";
}

function getRawText() {
  const conversationTexts = getConversationTexts();
  const composerText = state.includeComposer ? getComposerText() : "";
  const totalText = [conversationTexts.join("\n\n"), composerText].filter(Boolean).join("\n\n");

  return {
    conversationTexts,
    composerText,
    totalText
  };
}

function estimateTokens(text) {
  return globalThis.GPT_TOKEN_COUNTER_TOKENIZER.count(text);
}

function getTokenizerEncoding() {
  return globalThis.GPT_TOKEN_COUNTER_TOKENIZER?.encoding || TOKENIZER_ENCODING;
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function getStatsForRawText(rawText) {
  const { conversationTexts, composerText, totalText } = rawText;
  const conversationText = conversationTexts.join("\n\n");
  const messageTokens = conversationTexts.map(estimateTokens);
  const promptTokens = estimateTokens(composerText);

  return {
    totalTokens: estimateTokens(totalText),
    conversationTokens: estimateTokens(conversationText),
    promptTokens,
    messages: conversationTexts.length,
    chars: totalText.length,
    exportedRawTextChars: totalText.length,
    countedStringChars: totalText.length,
    tokenizerEncoding: getTokenizerEncoding(),
    countedStringStart: totalText.slice(0, 200),
    countedStringEnd: totalText.slice(-200),
    maxMessageTokens: messageTokens.length ? Math.max(...messageTokens) : 0,
    updatedAt: new Date()
  };
}

function getStats() {
  return getStatsForRawText(getRawText());
}

function createPanel() {
  if (state.closed) return;
  if (document.getElementById(PANEL_ID)) return;

  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <header class="gtc-header">
      <button class="gtc-drag" type="button" title="Move panel" aria-label="Move panel">::</button>
      <div class="gtc-title">Tokens</div>
      <button class="gtc-collapse" type="button" title="Collapse" aria-label="Collapse">-</button>
      <button class="gtc-close" type="button" title="Close panel" aria-label="Close panel">x</button>
    </header>
    <div class="gtc-body">
      <div class="gtc-total" data-field="total">0</div>
      <div class="gtc-subtitle">o200k_base tokens in this chat</div>
      <div class="gtc-grid">
        <span>Messages</span><strong data-field="messages">0</strong>
        <span>Chars</span><strong data-field="chars">0</strong>
        <span>Prompt</span><strong data-field="prompt">0</strong>
        <span>Largest</span><strong data-field="largest">0</strong>
      </div>
      <label class="gtc-toggle">
        <input type="checkbox" data-action="include-composer" checked>
        <span>Include draft prompt</span>
      </label>
      <div class="gtc-actions">
        <button type="button" data-action="refresh">Refresh</button>
        <button type="button" data-action="copy">Copy</button>
        <button type="button" data-action="raw">Raw text</button>
      </div>
      <div class="gtc-note" data-field="note">Counting exported raw text with o200k_base.</div>
    </div>
  `;

  document.documentElement.appendChild(panel);
  applyPanelState(panel);
  bindPanelEvents(panel);
  scheduleUpdate();
}

function applyPanelState(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return;

  panel.classList.toggle("gtc-collapsed", state.collapsed);
  const collapseButton = panel.querySelector(".gtc-collapse");
  if (collapseButton) collapseButton.textContent = state.collapsed ? "+" : "-";

  const checkbox = panel.querySelector("[data-action='include-composer']");
  if (checkbox) checkbox.checked = state.includeComposer;

  if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
    panel.style.left = `${state.x}px`;
    panel.style.top = `${state.y}px`;
    panel.style.right = "auto";
  }
}

function closePanel() {
  state.closed = true;
  saveState();
  document.getElementById(PANEL_ID)?.remove();
  document.querySelector(".gtc-raw-backdrop")?.remove();
}

function showPanel() {
  state.closed = false;
  saveState();
  createPanel();
  updatePanel();
}

function bindPanelEvents(panel) {
  panel.querySelector(".gtc-collapse").addEventListener("click", () => {
    state.collapsed = !state.collapsed;
    saveState();
    applyPanelState(panel);
  });

  panel.querySelector(".gtc-close").addEventListener("click", () => {
    closePanel();
  });

  panel.querySelector("[data-action='include-composer']").addEventListener("change", (event) => {
    state.includeComposer = event.target.checked;
    saveState();
    scheduleUpdate();
  });

  panel.querySelector("[data-action='refresh']").addEventListener("click", () => {
    updatePanel();
  });

  panel.querySelector("[data-action='copy']").addEventListener("click", async () => {
    const stats = getStats();
    const text = `Total: ${stats.totalTokens} tokens\nMessages: ${stats.messages}\nCharacters: ${stats.chars}\nDraft prompt: ${stats.promptTokens} tokens\nLargest message: ${stats.maxMessageTokens} tokens\nEncoding: ${stats.tokenizerEncoding}`;
    await navigator.clipboard.writeText(text);
    setNote("Copied");
  });

  panel.querySelector("[data-action='raw']").addEventListener("click", () => {
    openRawTextDialog();
  });

  const dragHandle = panel.querySelector(".gtc-drag");
  dragHandle.addEventListener("pointerdown", (event) => {
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      panelX: panel.offsetLeft,
      panelY: panel.offsetTop
    };
    dragHandle.setPointerCapture(event.pointerId);
  });

  dragHandle.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const nextX = Math.min(window.innerWidth - panel.offsetWidth - 8, Math.max(8, drag.panelX + event.clientX - drag.startX));
    const nextY = Math.min(window.innerHeight - panel.offsetHeight - 8, Math.max(8, drag.panelY + event.clientY - drag.startY));
    panel.style.left = `${nextX}px`;
    panel.style.top = `${nextY}px`;
    panel.style.right = "auto";
    state.x = nextX;
    state.y = nextY;
  });

  dragHandle.addEventListener("pointerup", () => {
    if (!drag) return;
    drag = null;
    saveState();
  });
}

function openRawTextDialog() {
  document.querySelector(".gtc-raw-backdrop")?.remove();

  const rawText = getRawText();
  const stats = getStatsForRawText(rawText);
  const backdrop = document.createElement("div");
  backdrop.className = "gtc-raw-backdrop";
  backdrop.innerHTML = `
    <section class="gtc-raw-dialog" role="dialog" aria-modal="true" aria-label="Raw text used for token count">
      <header class="gtc-raw-header">
        <strong>Raw text used for count</strong>
        <button type="button" data-action="close-raw" aria-label="Close">x</button>
      </header>
      <textarea class="gtc-raw-text" readonly spellcheck="false"></textarea>
      <details class="gtc-debug">
        <summary>Debug details</summary>
        <div class="gtc-debug-grid">
          <span>Export chars</span><strong data-field="debug-export-chars">0</strong>
          <span>Counted chars</span><strong data-field="debug-counted-chars">0</strong>
          <span>Encoding</span><strong data-field="debug-encoding">o200k_base</strong>
          <span>Token count</span><strong data-field="debug-token-count">0</strong>
        </div>
        <label>First 200 chars</label>
        <textarea data-field="debug-first" readonly spellcheck="false"></textarea>
        <label>Last 200 chars</label>
        <textarea data-field="debug-last" readonly spellcheck="false"></textarea>
      </details>
      <footer class="gtc-raw-footer">
        <span data-field="raw-count">0 chars</span>
        <button type="button" data-action="copy-raw">Copy raw text</button>
      </footer>
    </section>
  `;

  const textarea = backdrop.querySelector(".gtc-raw-text");
  textarea.value = rawText.totalText;
  backdrop.querySelector("[data-field='raw-count']").textContent = `${formatNumber(rawText.totalText.length)} chars`;
  backdrop.querySelector("[data-field='debug-export-chars']").textContent = formatNumber(stats.exportedRawTextChars);
  backdrop.querySelector("[data-field='debug-counted-chars']").textContent = formatNumber(stats.countedStringChars);
  backdrop.querySelector("[data-field='debug-encoding']").textContent = stats.tokenizerEncoding;
  backdrop.querySelector("[data-field='debug-token-count']").textContent = formatNumber(stats.totalTokens);
  backdrop.querySelector("[data-field='debug-first']").value = stats.countedStringStart;
  backdrop.querySelector("[data-field='debug-last']").value = stats.countedStringEnd;

  backdrop.querySelector("[data-action='close-raw']").addEventListener("click", () => {
    backdrop.remove();
  });

  backdrop.querySelector("[data-action='copy-raw']").addEventListener("click", async () => {
    await navigator.clipboard.writeText(textarea.value);
    setNote("Raw text copied");
  });

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) backdrop.remove();
  });

  document.addEventListener("keydown", function closeOnEscape(event) {
    if (event.key !== "Escape") return;
    backdrop.remove();
    document.removeEventListener("keydown", closeOnEscape);
  });

  document.documentElement.appendChild(backdrop);
  textarea.focus();
}

function setNote(text) {
  const note = document.querySelector(`#${PANEL_ID} [data-field='note']`);
  if (!note) return;
  note.textContent = text;
  window.setTimeout(() => {
    if (note.textContent === text) {
      note.textContent = "Counting exported raw text with o200k_base.";
    }
  }, 1800);
}

function updatePanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const stats = getStats();
  panel.querySelector("[data-field='total']").textContent = formatNumber(stats.totalTokens);
  panel.querySelector("[data-field='messages']").textContent = formatNumber(stats.messages);
  panel.querySelector("[data-field='chars']").textContent = formatNumber(stats.chars);
  panel.querySelector("[data-field='prompt']").textContent = formatNumber(stats.promptTokens);
  panel.querySelector("[data-field='largest']").textContent = formatNumber(stats.maxMessageTokens);
}

function scheduleUpdate() {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(updatePanel, 250);
}

function startObserver() {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    const onlyExtensionUiChanged = mutations.every((mutation) => {
      const target = mutation.target.nodeType === Node.ELEMENT_NODE
        ? mutation.target
        : mutation.target.parentElement;
      return target?.closest(`#${PANEL_ID}, .gtc-raw-backdrop`);
    });

    if (!onlyExtensionUiChanged) scheduleUpdate();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  document.addEventListener("input", scheduleUpdate, true);
  window.addEventListener("popstate", scheduleUpdate);
}

function saveState() {
  chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  state = { ...DEFAULT_STATE, ...(result[STORAGE_KEY] || {}) };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GPT_TOKEN_COUNTER_SHOW_PANEL") {
    showPanel();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "GPT_TOKEN_COUNTER_GET_STATE") {
    sendResponse({
      ok: true,
      closed: state.closed,
      present: Boolean(document.getElementById(PANEL_ID))
    });
    return true;
  }

  return false;
});

async function init() {
  await loadState();
  createPanel();
  startObserver();
}

init();
