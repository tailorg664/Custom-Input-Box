console.log("✅ content.js loaded in page");

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("Received message:", message);

  if (message.action === "normal") {
    addFloatingInput();
  } else if (message.action === "css") {
    const css = await getLLMCSS(message.instruction);
    console.log("Generated CSS:", css);
    applyCSS(css);
  } else if (message.action === "summarize") {
    addFloatingInput(); // Ensure the floating box is visible
    const summary = await summarizePage();
    textarea = document
      .getElementById("floating-input-box")
      ?.querySelector("textarea");
    if (textarea) {
      textarea.value = summary;
    }

    alert("Summary:\n" + summary);
  }

  sendResponse({ status: "done" });
});

// Flag to avoid re-attaching event
let floatingBoxInitialized = false;

function addTriggerForFloatingBox() {
  if (floatingBoxInitialized) return;

  document.addEventListener("click", (e) => {
    const isInput =
      e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";

    if (isInput && !document.getElementById("floating-input-box")) {
      addFloatingInput();
    }
  });

  floatingBoxInitialized = true;
}

addTriggerForFloatingBox();

let activeInput = null;
let textarea = null;

function addFloatingInput() {
  try {
    if (document.getElementById("floating-input-box")) {
      console.log("Floating input box already exists");
      return;
    }

    const box = document.createElement("div");
    box.id = "floating-input-box";
    box.className = "floating-box"; // Apply base class

    // Set only dynamic values via JS
    box.style.top = localStorage.getItem("floatingBoxTop") || "200px";
    box.style.left = localStorage.getItem("floatingBoxLeft") || "";
    box.style.right = localStorage.getItem("floatingBoxRight") || "500px";

    textarea = document.createElement("textarea");
    textarea.className = "floating-textarea"; // Apply base class
    textarea.placeholder = "Type here...";

    const buttonsRow = document.createElement("div");
    buttonsRow.className = "floating-buttons-row";

    const closeButton = document.createElement("button");
    closeButton.innerText = "X";
    closeButton.className = "floating-close-button";

    const tabListener = (e) => {
      if (e.key === "Tab" && activeInput) {
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll("input, textarea"));
        const index = inputs.indexOf(activeInput);
        if (index !== -1) {
          const next = inputs[(index + 1) % inputs.length];
          next.focus(); // triggers focusin
        }
      } else if (e.key === "Escape") {
        closeButton.click();
      }
    };

    closeButton.onclick = () => {
      document.removeEventListener("keydown", tabListener);
      box.remove();
      textarea = null;
      activeInput = null;
    };

    buttonsRow.appendChild(closeButton);
    box.appendChild(buttonsRow);
    box.appendChild(textarea);
    document.body.appendChild(box);

    document.addEventListener("keydown", tabListener);

    // Floating ➝ Input sync (live)
    textarea.addEventListener("input", () => {
      if (activeInput && document.body.contains(activeInput)) {
        activeInput.value = textarea.value;
        activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    // ✅ DRAGGING FUNCTIONALITY
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    buttonsRow.onmousedown = (e) => {
      isDragging = true;
      const rect = box.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      document.body.style.userSelect = "none"; // prevent text selection
    };

    document.onmousemove = (e) => {
      if (!isDragging) return;

      const newLeft = e.clientX - offsetX;
      const newTop = e.clientY - offsetY;

      box.style.left = `${newLeft}px`;
      box.style.top = `${newTop}px`;
      box.style.right = "auto"; // stop using 'right' once moved

      // Save to localStorage
      localStorage.setItem("floatingBoxLeft", box.style.left);
      localStorage.setItem("floatingBoxTop", box.style.top);
      localStorage.setItem("floatingBoxRight", "auto");
    };

    document.onmouseup = () => {
      isDragging = false;
      document.body.style.userSelect = "";
    };

    console.log("Floating input box created");
  } catch (error) {
    console.error("Error creating floating input box:", error);
  }
}

// Reuse your working logic here:
document.addEventListener("focusin", (e) => {
  const target = e.target;

  if (
    (target.tagName === "TEXTAREA" ||
      (target.tagName === "INPUT" &&
        ["text", "search", "url", "email", "tel"].includes(target.type))) &&
    target !== textarea
  ) {
    if (!document.getElementById("floating-input-box")) {
      addFloatingInput();
    }

    activeInput = target;

    if (textarea) {
      textarea.value = target.value;
      textarea.focus();
    }
  }
});

function applyCSS(css) {
  try {
    if (typeof css !== "string" || css.includes("<script")) return;

    let existing = document.getElementById("custom-cib-style");
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = "custom-cib-style";
    style.innerText = css;
    document.head.appendChild(style);
  } catch (e) {
    console.error("Failed to apply CSS:", e);
  }
}
async function summarizePage() {
  try {
    // Extract only real text content (not headers, menus)
    const elements = Array.from(document.querySelectorAll("p"))
      .filter((e) => e.offsetHeight > 0 && e.offsetWidth > 0) // visible only
      .map((e) => e.innerText.trim())
      .filter(
        (t) =>
          t.length > 50 &&
          !t.toLowerCase().includes("cookie") &&
          !t.toLowerCase().includes("privacy")
      );

    const uniqueContent = [...new Set(elements)].slice(0, 20); // limit to 20 paragraphs
    const combinedText = uniqueContent.join("\n\n");
    const MAX_CHARS = 1000;
    const truncatedText = combinedText.slice(0, MAX_CHARS);
    if (!combinedText) return "No meaningful content to summarize.";

    const prompt = `Summarize this Wikipedia article in 3-5 bullet points:\n\n"""${truncatedText}"""`;
      console.log("Generated prompt for LLM:", prompt);
      
    const summary = await sendToLLM(prompt);
    return summary || "Could not generate summary.";
  } catch (err) {
    console.error("summarizePage error:", err);
    return "Error occurred while summarizing.";
  }
}
async function sendToLLM(prompt) {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization":
            "Bearer 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",
        },
        body: JSON.stringify({
          model: "google/gemma-2-9b-it:free", // or another available model
          messages: [
            { role: "system", content: "You are a helpful summarizer." },
            { role: "user", content: prompt },
          ],
        }),
      }
    );

    const data = await response.json();
    console.log("LLM raw response:", data); // Log entire response for debugging

    if (!data.choices || !data.choices[0]) {
      const errorMsg =
        data.error?.message || "No valid choices returned by LLM.";
      throw new Error(errorMsg);
    }

    return data.choices[0].message.content;
  } catch (err) {
    console.error("sendToLLM error:", err);
    return "Failed to get a summary.";
  }
}


async function getLLMCSS(instruction) {
  const prompt = `
You are modifying styles for a floating input box. Only return valid CSS.
Do not include any <style> tags, JavaScript, or HTML.
Use only these selectors: #floating-input-box and #floating-input-box textarea.
Instruction: ${instruction}
`;
  const response = await sendToLLM(prompt);
  return response.trim();
}
