import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  APPEARANCE_DEFAULTS,
  APPEARANCE_RANGES,
  APPLY_MODES,
  EMBED_URL_MAX_LENGTH,
  PROFILE_ANSWER_VERSION,
} from './profile-contract.mjs';
import { validateProfileAnswers } from './profile-answers.mjs';

const [schemaText, exampleText, contentConfig] = await Promise.all([
  readFile(new URL('../docs/profile-answers.schema.json', import.meta.url), 'utf8'),
  readFile(new URL('../profile.answers.example.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/content.config.ts', import.meta.url), 'utf8'),
]);
const schema = JSON.parse(schemaText);
const example = JSON.parse(exampleText);
const appearance = schema.properties.appearance.properties;

assert.equal(schema.properties.version.const, PROFILE_ANSWER_VERSION);
assert.deepEqual(schema.properties.applyMode.enum, APPLY_MODES);
assert.equal(schema.properties.applyMode.default, 'replace');
assert.equal(schema.properties.identity.required, undefined);
assert.equal(schema.properties.fortune.required, undefined);
assert.equal(schema.allOf[0].else.properties.identity.required.includes('displayName'), true);
assert.equal(appearance.sectionsLayout.default, APPEARANCE_DEFAULTS.sectionsLayout);
assert.equal(appearance.bodyFont.default, APPEARANCE_DEFAULTS.bodyFont);
assert.equal(appearance.displayFont.default, APPEARANCE_DEFAULTS.displayFont);
assert.equal(appearance.mainColor.default, APPEARANCE_DEFAULTS.mainColor);
assert.deepEqual(
  [appearance.fontScale.minimum, appearance.fontScale.maximum, appearance.fontScale.default],
  [APPEARANCE_RANGES.fontScale.minimum, APPEARANCE_RANGES.fontScale.maximum, APPEARANCE_DEFAULTS.fontScale],
);
assert.deepEqual(
  [appearance.smallTextScale.minimum, appearance.smallTextScale.maximum, appearance.smallTextScale.default],
  [APPEARANCE_RANGES.smallTextScale.minimum, APPEARANCE_RANGES.smallTextScale.maximum, APPEARANCE_DEFAULTS.smallTextScale],
);
assert.equal(schema.properties.embedBlocks.items.properties.url.maxLength, EMBED_URL_MAX_LENGTH);
assert.equal(contentConfig.includes("from '../scripts/profile-contract.mjs'"), true);

const validatedExample = validateProfileAnswers(example);
assert.equal(validatedExample.applyMode, 'replace');
assert.equal(validatedExample.appearance.fontScale, example.appearance.fontScale);
assert.equal(validatedExample.appearance.smallTextScale, example.appearance.smallTextScale);

console.log('Profile contract check passed (runtime, JSON Schema, example, and content defaults agree).');
