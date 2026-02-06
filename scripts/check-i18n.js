const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '../messages');
const LOCALES = ['ar', 'en'];

function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function check() {
    console.log('--- i18n Consistency Check ---');

    const results = {};
    LOCALES.forEach(locale => {
        const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
        if (!fs.existsSync(filePath)) {
            console.error(`Error: Missing file ${filePath}`);
            process.exit(1);
        }
        let rawContent = fs.readFileSync(filePath, 'utf8');
        // Strip BOM if present
        if (rawContent.charCodeAt(0) === 0xFEFF) {
            rawContent = rawContent.slice(1);
        }
        const content = JSON.parse(rawContent);
        results[locale] = {
            keys: getKeys(content),
            content
        };
    });

    const arKeys = new Set(results.ar.keys);
    const enKeys = new Set(results.en.keys);

    const missingInEn = [...arKeys].filter(key => !enKeys.has(key));
    const missingInAr = [...enKeys].filter(key => !arKeys.has(key));

    let hasErrors = false;

    if (missingInEn.length > 0) {
        console.error(`\x1b[31mMissing in en.json:\x1b[0m`);
        missingInEn.forEach(key => console.error(`  - ${key}`));
        hasErrors = true;
    }

    if (missingInAr.length > 0) {
        console.error(`\x1b[31mMissing in ar.json:\x1b[0m`);
        missingInAr.forEach(key => console.error(`  - ${key}`));
        hasErrors = true;
    }

    if (!hasErrors) {
        console.log('\x1b[32m✔ All translation keys are synchronized across locales.\x1b[0m');
        console.log(`Total keys per locale: ${arKeys.size}`);
    } else {
        console.error(`\n\x1b[31m✖ i18n check failed with ${missingInEn.length + missingInAr.length} mismatches.\x1b[0m`);
        process.exit(1);
    }
}

try {
    check();
} catch (err) {
    console.error('An unexpected error occurred during i18n check:', err);
    process.exit(1);
}
