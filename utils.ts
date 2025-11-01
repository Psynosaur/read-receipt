// utils.ts
import { join } from "https://deno.land/std@0.201.0/path/mod.ts"; 

export async function extractTextFromImage(buffer: Uint8Array): Promise<string> {
  const tempPath = join(Deno.cwd(), "temp_receipt.jpg");
  await Deno.writeFile(tempPath, buffer);

  const process = new Deno.Command("tesseract", {
    args: [tempPath, "stdout"],
  });

  const { stdout } = await process.output();
  const text = new TextDecoder().decode(stdout);
  await Deno.remove(tempPath);
  return text.trim();
}

export async function sendToLmStudio(text: string): Promise<any> {
  const prompt = `
You are a receipt parser. Extract the following information:

- Location (business name/address)
- Date and time of transaction
- List of items bought (name, quantity, price per unit, total if available)
- Total amount paid

Return only JSON format.

Receipt Text:
${text}
`;

  const response = await fetch("http://192.168.1.129:1234/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "undefined",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  const data = await response.json();

  try {
    const content = data.choices[0].message.content;
    // Try to parse JSON from LLM output
    return JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
  } catch (e) {
    return { raw_output: data.choices[0].message.content };
  }
}