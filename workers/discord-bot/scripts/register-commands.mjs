import fs from 'node:fs';
import path from 'node:path';
import { COMMAND_DEFINITIONS } from '../src/commands.mjs';

function loadLocalEnvFile() {
  const envFilePath = path.resolve(import.meta.dirname, '..', '.dev.vars');
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const fileContents = fs.readFileSync(envFilePath, 'utf8');
  for (const rawLine of fileContents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function buildRegistrationUrl(scope) {
  const applicationId = requireEnv('DISCORD_APPLICATION_ID');

  if (scope === 'guild') {
    const guildId = requireEnv('DISCORD_GUILD_ID');
    return `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
  }

  return `https://discord.com/api/v10/applications/${applicationId}/commands`;
}

async function main() {
  loadLocalEnvFile();
  const scope = process.argv[2] === 'guild' ? 'guild' : 'global';
  const botToken = requireEnv('DISCORD_BOT_TOKEN');
  const registrationUrl = buildRegistrationUrl(scope);

  const response = await fetch(registrationUrl, {
    method: 'PUT',
    headers: {
      authorization: `Bot ${botToken}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(COMMAND_DEFINITIONS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord command registration failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const registeredNames = payload.map((command) => command.name).join(', ');
  console.log(`Registered ${payload.length} ${scope} command(s): ${registeredNames}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
