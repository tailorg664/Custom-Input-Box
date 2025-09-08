document.getElementById("execute-btn").addEventListener("click", async () => {
  console.log("Execute button clicked");

  const mode = document.getElementById("mode-select").value;
  const instruction = document.getElementById("llm-input").value;

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  chrome.tabs.sendMessage(
    tab.id,
    {
      action: mode,
      instruction: instruction,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Failed to send message:",
          chrome.runtime.lastError.message
        );
        alert(chrome.runtime.lastError.message);
      } else {
        console.log("Response from content script:", response);
      }
    }
  );
});
