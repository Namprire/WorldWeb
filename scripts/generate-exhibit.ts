import { exhibitPrompt, generateExhibit } from "../server/exhibit-video";
const id = process.argv[2] || "aiven";
console.info(exhibitPrompt(id));
if (!process.argv.includes("--accept-charges")) {
  console.info(
    "\nPreview only. To submit this paid generation after reviewing your Google pricing and quota: npm run generate:exhibit -- " +
      id +
      " --accept-charges",
  );
} else {
  try {
    await generateExhibit(id);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Generation failed");
    process.exitCode = 1;
  }
}
