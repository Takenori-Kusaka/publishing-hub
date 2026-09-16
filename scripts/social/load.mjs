import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const schemaPath = path.join(ROOT, 'social/schema/social-post.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

/**
 * Loads and schema-validates a social post YAML file.
 *
 * @param {string} filePath
 * @returns {object}
 */
export function loadPostFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = YAML.parse(content);
  } catch (err) {
    return {
      filePath,
      valid: false,
      errors: [{ message: `YAML parse error: ${err.message}` }]
    };
  }

  const valid = validateSchema(data);
  return {
    filePath,
    data,
    valid,
    errors: validateSchema.errors ? validateSchema.errors.map(err => ({
      path: err.instancePath,
      message: err.message
    })) : []
  };
}

/**
 * Lists all YAML post files in a directory.
 *
 * @param {string} dirPath
 * @returns {string[]}
 */
export function listPostFiles(dirPath = path.join(ROOT, 'social/posts')) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => path.join(dirPath, f));
}
