import { chromium } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const VIZ_TARGETS = [
    {
        id: 'RADIAL_SURA',
        vizMode: 'radial-sura',
        switcherLabel: 'Radial Sura',
        filename: 'radial-sura.png',
        alt: 'Quran Corpus Visualizer – Radial Surah Map'
    },
    {
        id: 'ROOT_NETWORK',
        vizMode: 'root-network',
        switcherLabel: 'Root Network',
        filename: 'root-network.png',
        alt: 'Root Network Graph'
    },
    {
        id: 'KNOWLEDGE_GRAPH',
        vizMode: 'knowledge-graph',
        switcherLabel: 'Knowledge Graph',
        filename: 'knowledge-graph.png',
        alt: 'Knowledge Graph Visualization'
    },
    {
        id: 'SURAH_DISTRIBUTION',
        vizMode: 'surah-distribution',
        switcherLabel: 'Surah Distribution',
        filename: 'surah-distribution.png',
        alt: 'Surah Distribution'
    },
    {
        id: 'ARC_FLOW',
        vizMode: 'arc-flow',
        switcherLabel: 'Arc Flow',
        filename: 'arc-flow.png',
        alt: 'Arc Flow Diagram'
    },
    {
        id: 'DEPENDENCY_TREE',
        vizMode: 'dependency-tree',
        switcherLabel: 'Dependency',
        filename: 'dependency-tree.png',
        alt: 'Ayah Dependency Graph'
    },
    {
        id: 'SANKEY_FLOW',
        vizMode: 'sankey-flow',
        switcherLabel: 'Sankey Flow',
        filename: 'sankey-flow.png',
        alt: 'Root Flow Sankey'
    },
    {
        id: 'CORPUS_ARCHITECTURE',
        vizMode: 'corpus-architecture',
        switcherLabel: 'Corpus Architecture',
        filename: 'corpus-architecture.png',
        alt: 'Corpus Architecture Map'
    }
];

async function generateDocumentationScreenshots() {
    console.log('Starting Playwright screenshot generation...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 2560, height: 1260 },
        deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // 1. Navigate to home ONCE
    await page.goto('http://localhost:3000');

    // 2. Set LocalStorage State for onboarding to be completed
    await page.evaluate(() => {
        localStorage.setItem('quran-corpus-viz-state', JSON.stringify({
            vizMode: 'radial-sura',
            theme: 'dark',
            selectedSurahId: 1
        }));
        localStorage.setItem('quran-corpus-onboarding', JSON.stringify({
            version: "2",
            showOnStartup: false,
            completed: true
        }));
    });

    // 3. Reload once to apply state and start caching
    console.log('Reloading to apply state and start caching...');
    await page.reload({ waitUntil: 'domcontentloaded' });

    // 4. Wait for the graph container to exist
    await page.waitForSelector('.immersive-viewport', { state: 'visible' });

    // 5. Wait for the corpus loading to finish (loading indicator should disappear)
    console.log(`Waiting for corpus caching to finish (this may take a bit on first run)...`);
    await page.waitForTimeout(1000); // give the loading indicator time to mount
    await page.waitForSelector('.loading-indicator', { state: 'hidden', timeout: 300000 });
    console.log(`Corpus caching complete!`);

    for (const target of VIZ_TARGETS) {
        console.log(`Processing ${target.vizMode}...`);

        // Switch visualization using the UI
        console.log(`Clicking switcher current...`);
        await page.locator('.viz-switcher-current').click({ force: true });

        await page.waitForSelector('.viz-switcher-dropdown', { state: 'visible', timeout: 5000 });

        console.log(`Clicking option ${target.vizMode}...`);
        // Click the specific option in the dropdown using the new data-mode attribute
        await page.locator(`.viz-switcher-option[data-mode="${target.vizMode}"]`).click({ force: true });

        // Wait until dropdown is closed
        try {
            await page.waitForSelector('.viz-switcher-dropdown', { state: 'hidden', timeout: 3000 });
        } catch {
            console.log(`Dropdown stuck, pressing Escape...`);
            await page.keyboard.press('Escape');
        }

        // Wait for the new graph to enter the DOM and its animations to settle
        console.log(`Waiting for ${target.vizMode} layout to stabilize...`);
        await page.waitForTimeout(4000);

        // 6. Take screenshot
        const imagePath = path.join(process.cwd(), 'public', 'docs', 'images', target.filename);
        await page.screenshot({ path: imagePath, fullPage: false });
        console.log(`Saved screenshot to ${imagePath}`);
    }

    await browser.close();

    // 7. Update README.md
    console.log('Updating README.md with generated screenshots...');
    const readmePath = path.join(process.cwd(), 'README.md');
    let readme = await fs.readFile(readmePath, 'utf-8');

    for (const target of VIZ_TARGETS) {
        const regex = new RegExp(`<!-- GRAPH:${target.id} -->[\\s\\S]*?<!-- END:GRAPH -->`, 'g');
        const newImageMarkdown = `<!-- GRAPH:${target.id} -->\n<img width="2560" height="1260" alt="${target.alt}" src="public/docs/images/${target.filename}" />\n<!-- END:GRAPH -->`;
        readme = readme.replace(regex, newImageMarkdown);
    }

    await fs.writeFile(readmePath, readme);
    console.log('README.md successfully updated!');
}

generateDocumentationScreenshots().catch(console.error);
