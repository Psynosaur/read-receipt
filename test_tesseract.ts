import { recognize } from "https://raw.githubusercontent.com/DjDeveloperr/Tesseract-Deno/main/mod.ts";

const output = await recognize("spar_128.jpg");
console.log("Output:", output);