import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../social/schema/social-post.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

test('valid-single.yaml should be valid', () => {
  const content = YAML.parse(fs.readFileSync(path.resolve(__dirname, '../../social/fixtures/valid-single.yaml'), 'utf8'));
  const valid = validate(content);
  assert.ok(valid, ajv.errorsText(validate.errors));
});

test('valid-thread.yaml should be valid', () => {
  const content = YAML.parse(fs.readFileSync(path.resolve(__dirname, '../../social/fixtures/valid-thread.yaml'), 'utf8'));
  const valid = validate(content);
  assert.ok(valid, ajv.errorsText(validate.errors));
});

test('invalid-schema.yaml should fail validation', () => {
  const content = YAML.parse(fs.readFileSync(path.resolve(__dirname, '../../social/fixtures/invalid/invalid-schema.yaml'), 'utf8'));
  const valid = validate(content);
  assert.strictEqual(valid, false);
});
