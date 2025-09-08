async function sendToLLM(prompt) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization:
        "Bearer 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",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistralai/mixtral-8x7b-instruct",
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that converts user prompts into CSS or summaries.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await res.json();
  return data.choices[0].message.content;
}

async function getLLMCSS(instruction) {
  const prompt = `Convert this instruction to pure CSS:\n${instruction}`;
  return await sendToLLM(prompt);
}
