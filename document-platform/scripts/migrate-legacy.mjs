#!/usr/bin/env node

/**
 * Migration Script
 * Maps legacy schemas from tanmay-sahoo/Blog-generator into AppToolkitLab native structure.
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const sourceFile = args[0];

if (!sourceFile) {
  console.error('Usage: ./migrate-legacy.mjs <path-to-legacy-export.json>');
  process.exit(1);
}

function migrateLegacyBlog(legacyItem) {
  return {
    title: legacyItem.title || 'Untitled',
    topic: legacyItem.topic || '',
    language: legacyItem.language || 'English',
    content: legacyItem.content || '',
    wordCount: legacyItem.wordCount || 0,
    seoScore: legacyItem.seoScore || 0,
    // Add missing metadata required by AppToolkitLab
    status: legacyItem.status || 'DRAFT',
    providerId: 'gpt-4o',
    promptTemplateId: 'default',
    organizationId: null, // To be filled by the import context
  };
}

async function main() {
  try {
    const data = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));
    console.log(`Found ${data.length} legacy items to migrate.`);
    
    const migrated = data.map(migrateLegacyBlog);
    
    const outFile = path.join(process.cwd(), 'migrated-blogs.json');
    fs.writeFileSync(outFile, JSON.stringify(migrated, null, 2));
    
    console.log(`✅ Successfully migrated data to ${outFile}`);
  } catch (err) {
    console.error('Error during migration:', err.message);
    process.exit(1);
  }
}

main();
