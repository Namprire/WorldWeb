/** Explicit, operator-run generation. Never called by the game or source refresh. */
import { GoogleGenAI } from "@google/genai";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { companiesSchema } from "../src/shared/startups";
import { settings } from "./config";

export function exhibitPrompt(id: string) {
  const motifs: Record<string, string> = {
    aiven: "rivers of luminous data flowing through translucent glass islands",
    varjo:
      "nested windows opening into impossible, beautifully painted landscapes",
    oura: "a floating golden ring orbiting a quiet moon, with soft breathing light",
  };
  if (!motifs[id]) throw new Error("Choose aiven, varjo or oura.");
  return `Create an eight-second silent art film for a gallery screen inside a Helsinki night game. ${motifs[id]}. Oil paint impasto, deep navy, luminous jade, restrained gold, northern lights. Fixed camera, slow graceful movement, no sudden flashes. Seamless-looking loop, widescreen. No text, logos, people, product claims or advertising. This is an imagined artistic interpretation, not company footage.`;
}
export async function generateExhibit(id: string) {
  const prompt = exhibitPrompt(id);
  if (!settings.geminiKey)
    throw new Error("Set GEMINI_API_KEY in the server .env file.");
  const directory = resolve(import.meta.dirname, "../public/media/exhibits");
  const jobs = resolve(import.meta.dirname, "../output/video-jobs");
  await mkdir(directory, { recursive: true });
  await mkdir(jobs, { recursive: true });
  const target = resolve(directory, `${id}.mp4`),
    jobPath = resolve(jobs, `${id}.json`);
  try {
    await readFile(target);
    console.info(`Cached exhibit already exists: ${id}`);
    return;
  } catch {}
  const client = new GoogleGenAI({ apiKey: settings.geminiKey });
  let saved: { interactionId: string; prompt: string } | undefined;
  try {
    saved = JSON.parse(await readFile(jobPath, "utf8"));
  } catch {}
  // Resume the exact operation after restarts instead of paying for another.
  let interaction = saved
    ? await client.interactions.get(saved.interactionId)
    : await client.interactions.create(
        {
          model: "gemini-omni-1.2-flash",
          input: prompt,
          background: true,
          store: true,
        },
        { maxRetries: 0 },
      );
  await writeFile(
    jobPath,
    JSON.stringify(
      { interactionId: interaction.id, prompt: saved?.prompt || prompt },
      null,
      2,
    ),
  );
  const deadline = Date.now() + 15 * 60 * 1000;
  while (["in_progress", "queued"].includes(interaction.status)) {
    if (Date.now() > deadline)
      throw new Error(
        "Still generating. Run the same command to resume this saved operation; no new generation will be submitted.",
      );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    interaction = await client.interactions.get(interaction.id);
  }
  if (interaction.status !== "completed" || !interaction.output_video?.data)
    throw new Error(
      `Video not available (${interaction.status}). Saved operation retained; no automatic regeneration.`,
    );
  const bytes = Buffer.from(interaction.output_video.data, "base64");
  if (bytes.length < 32 || bytes.toString("ascii", 4, 8) !== "ftyp")
    throw new Error(
      "Provider returned an unsupported video container. Original operation retained.",
    );
  await writeFile(`${target}.tmp`, bytes);
  await rename(`${target}.tmp`, target);
  await writeFile(
    resolve(directory, `${id}.json`),
    JSON.stringify(
      {
        model: "gemini-omni-1.2-flash",
        prompt,
        generatedAt: new Date().toISOString(),
        label: "AI-generated artistic interpretation; not company footage",
      },
      null,
      2,
    ),
  );
  console.info(
    `Saved ${id} exhibit. Reload WEBWORLD to play it in the nearest gallery screen.`,
  );
}
// The manifest is independent of generation. API credentials never reach public assets.
export async function exhibitIds() {
  return companiesSchema
    .parse(
      JSON.parse(
        await readFile(
          new URL("../public/data/startups/companies.json", import.meta.url),
          "utf8",
        ),
      ),
    )
    .filter((c) => c.exhibit)
    .map((c) => c.id);
}
