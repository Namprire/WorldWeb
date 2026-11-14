import { loadServerEnv } from './config/env.js';
import { createWebWorldApp } from './app.js';

const env = loadServerEnv();
const app = createWebWorldApp({ env });

app.listen(env.port, () => {
  console.log('====================================================');
  console.log(`  WEBWORLD Backend Online -> http://localhost:${env.port}`);
  console.log(`  Gemini Model           -> ${env.geminiModel}`);
  console.log(
    `  Credentials            -> GEMINI=${env.geminiApiKey ? 'SET' : 'MISSING'}, CONTEXT_DEV=${
      env.contextDevApiKey ? 'SET' : 'MISSING'
    }`
  );
  if (env.modelWarning) {
    console.warn(`  Model Note             -> ${env.modelWarning}`);
  }
  console.log(
    `  Default Operating Mode -> ${
      env.geminiApiKey && env.contextDevApiKey ? 'LIVE READY' : 'DEMO MODE (Simulated)'
    }`
  );
  console.log('====================================================');
});
