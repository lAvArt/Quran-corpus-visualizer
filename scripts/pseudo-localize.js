const fs = require('fs');
const path = require('path');

const EN_PATH = path.join(__dirname, '../messages/en.json');
const PSEUDO_PATH = path.join(__dirname, '../messages/pseudo.json');

const charMap = {
    'a': 'â', 'b': 'ḃ', 'c': 'ç', 'd': 'ḋ', 'e': 'è', 'f': 'ḟ', 'g': 'ġ', 'h': 'ħ',
    'i': 'î', 'j': 'ĵ', 'k': 'ķ', 'l': 'ļ', 'm': 'ṁ', 'n': 'ñ', 'o': 'ô', 'p': 'ṗ',
    'q': 'q', 'r': 'ṛ', 's': 'ṡ', 't': 'ť', 'u': 'û', 'v': 'v', 'w': 'ŵ', 'x': 'ẋ',
    'y': 'ý', 'z': 'ž',
    'A': 'Â', 'B': 'Ḃ', 'C': 'Ç', 'D': 'Ḋ', 'E': 'È', 'F': 'Ḟ', 'G': 'Ġ', 'H': 'Ħ',
    'I': 'Î', 'J': 'Ĵ', 'K': 'Ķ', 'L': 'Ļ', 'M': 'Ṁ', 'N': 'Ñ', 'O': 'Ô', 'P': 'Ṗ',
    'Q': 'Q', 'R': 'Ṛ', 'S': 'Ṡ', 'T': 'Ť', 'U': 'Û', 'V': 'V', 'W': 'Ŵ', 'X': 'Ẋ',
    'Y': 'Ý', 'Z': 'Ž'
};

function pseudoLocalizeString(str) {
    // Handle variables like {count}
    return str.split(/(\{[^}]+\})/).map(part => {
        if (part.startsWith('{') && part.endsWith('}')) return part;
        return part.split('').map(char => charMap[char] || char).join('');
    }).join('');
}

function processObject(obj) {
    const result = {};
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            result[key] = processObject(obj[key]);
        } else if (typeof obj[key] === 'string') {
            result[key] = `[!! ${pseudoLocalizeString(obj[key])} !!]`;
        } else {
            result[key] = obj[key];
        }
    }
    return result;
}

function generate() {
    console.log('--- Generating Pseudo-localization Map ---');

    if (!fs.existsSync(EN_PATH)) {
        console.error('Error: en.json not found');
        process.exit(1);
    }

    const enContent = JSON.parse(fs.readFileSync(EN_PATH, 'utf8').replace(/^\uFEFF/, ''));
    const pseudoContent = processObject(enContent);

    fs.writeFileSync(PSEUDO_PATH, JSON.stringify(pseudoContent, null, 4), 'utf8');
    console.log(`\x1b[32m✔ Pseudo-localization file generated at ${PSEUDO_PATH}\x1b[0m`);
    console.log('\x1b[33mTip: Any normal English text you see in the UI now is a localization leak!\x1b[0m');
}

generate();
