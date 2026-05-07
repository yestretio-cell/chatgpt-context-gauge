document.getElementById("open-chatgpt").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://chatgpt.com/" });
});

document.getElementById("show-panel").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    status.textContent = "No active tab found.";
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "GPT_TOKEN_COUNTER_SHOW_PANEL" });
    status.textContent = "Panel shown on this tab.";
  } catch {
    status.textContent = "Open a ChatGPT conversation tab first.";
  }
});
