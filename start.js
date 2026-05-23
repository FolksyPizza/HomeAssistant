#!/usr/bin/env node
/**
 * Production start script that loads .env file and starts SvelteKit server
 * This ensures environment variables are available to the application
 */

import 'dotenv/config.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import and start the SvelteKit built server
const { handler } = await import(join(__dirname, 'build/index.js'));

// The build/index.js exports the built server and starts it automatically
// But we've already imported it, so we just need to ensure dotenv is loaded above
console.log('Smart Display Dashboard server started with environment variables loaded');
