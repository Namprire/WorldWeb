import { Router } from "express";
import ContextDev from "context.dev";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { companiesSchema } from "../src/shared/startups";
import { settings } from "./config";

export const startupsRouter = Router();
const companies = companiesSchema.parse(
  JSON.parse(
    await readFile(
      new URL("../public/data/startups/companies.json", import.meta.url),
      "utf8",
    ),
  ),
);
const context = settings.contextKey
  ? new ContextDev({
      apiKey: settings.contextKey,
      timeout: 12000,
      maxRetries: 0,
    })
  : null;
const cachePath = resolve(
  import.meta.dirname,
  "../output/startup-source-cache.json",
);
type Observation = { hash: string; checkedAt: string; changed: boolean };
let observations: Record<string, Observation> = {};
try {
  observations = JSON.parse(await readFile(cachePath, "utf8"));
} catch {
  /* First run. */
}
let running: Promise<unknown> | undefined;
let lastRefresh = 0;
startupsRouter.get("/", (_req, res) =>
  res.json({ companies, observations, refreshAvailable: Boolean(context) }),
);
startupsRouter.get("/exhibits", (_req, res) =>
  res.json(
    companies
      .filter((c) => c.exhibit)
      .map((c) => ({
        id: c.id,
        url: existsSync(
          resolve(import.meta.dirname, `../public/media/exhibits/${c.id}.mp4`),
        )
          ? `/media/exhibits/${c.id}.mp4`
          : null,
        label: "Imagined visual interpretation, not company footage",
      })),
  ),
);
startupsRouter.post("/refresh", async (req, res) => {
  if (req.get("sec-fetch-site") === "cross-site") {
    res.status(403).json({ error: "Open WEBWORLD to refresh." });
    return;
  }
  if (!context) {
    res
      .status(503)
      .json({
        error:
          "Live source checks need CONTEXT_DEV_API_KEY on the server. The reviewed collection remains available.",
      });
    return;
  }
  if (Date.now() - lastRefresh < 60000 && !running) {
    res.json({ observations, message: "Using the most recent source checks." });
    return;
  }
  running ??= (async () => {
    const failed: string[] = [];
    // Bounded concurrency: two sources at a time; clients share one refresh.
    for (let i = 0; i < companies.length; i += 2)
      await Promise.all(
        companies.slice(i, i + 2).map(async (c) => {
          try {
            const page = await context.web.scrape({
              url: c.sourceUrl,
              formats: { markdown: true },
            });
            const body = page.markdown?.data;
            if (!body || body.length < 120)
              throw new Error("No source content");
            const hash = createHash("sha256")
              .update(body.replace(/\s+/g, " ").trim())
              .digest("hex");
            const previous = observations[c.id];
            observations[c.id] = {
              hash,
              checkedAt: new Date().toISOString(),
              changed: previous
                ? previous.hash !== hash || previous.changed
                : false,
            };
          } catch {
            failed.push(c.id);
          }
        }),
      );
    await mkdir(resolve(cachePath, ".."), { recursive: true });
    await writeFile(cachePath, JSON.stringify(observations));
    lastRefresh = Date.now();
    return {
      observations,
      failed,
      message: failed.length
        ? `${failed.length} sources unavailable; previous facts preserved.`
        : "Source checks complete. Changed pages are flagged for review; facts are never invented.",
    };
  })().finally(() => {
    running = undefined;
  });
  try {
    res.json(await running);
  } catch {
    res
      .status(502)
      .json({
        error: "Could not save source checks. Reviewed facts are unchanged.",
      });
  }
});
