// routes.ts
import { extractTextFromImage } from "./utils.ts";
import { sendToLmStudio } from "./utils.ts";

export async function processReceipt(req: Request): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return new Response(JSON.stringify({ error: "No file uploaded" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  try {
    const rawText = await extractTextFromImage(buffer);
    const parsedData = await sendToLmStudio(rawText);

    return new Response(
      JSON.stringify({
        status: "success",
        parsed_data: parsedData,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ status: "error", message: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}