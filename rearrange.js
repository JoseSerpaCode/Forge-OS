// NOTE: One-time dev helper script — NOT part of the build pipeline.
// Run manually with: node rearrange.js (requires matching index.astro structure).
// rearrange.cjs was a duplicate of this file and has been removed.
const fs = require('fs');
let content = fs.readFileSync('src/pages/index.astro', 'utf8');

// 1. Extract Banner
const bannerRegex = /(<!-- Welcome \/ Collaboration Banner -->\s*<div class="mb-10 bg-gradient-to-r[\s\S]*?<\/div>\n      <\/div>\n    <\/div>)/;
const bannerMatch = content.match(bannerRegex);
if (!bannerMatch) { console.error("Banner not found!"); process.exit(1); }
const bannerStr = bannerMatch[1];
content = content.replace(bannerStr, '');

// 2. Extract Tasks
const tasksRegex = /(<section>\s*<h2 class="text-xl font-bold text-forge-text mb-4 border-b border-forge-border pb-2">\{t\('hub.pending_tasks'\)\}<\/h2>\s*<div class="bg-forge-panel border border-forge-border rounded-lg overflow-hidden max-h-\[320px\] flex flex-col">\s*<div class="overflow-y-auto custom-scrollbar flex-1">\s*<TaskTable tasks=\{myTasks\} \/>\s*<\/div>\s*<\/div>\s*<\/section>)/;
const tasksMatch = content.match(tasksRegex);
if (!tasksMatch) { console.error("Tasks not found!"); process.exit(1); }
const tasksStr = tasksMatch[1];
content = content.replace(tasksStr, '');

// 3. Now we have grid with just Workspaces and Social. Let's add mb-10 to the grid.
content = content.replace('<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">', '<div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">');

// 4. Inject Tasks and Banner before the closing div of max-w-5xl
const injection = `
    <!-- Pending Tasks Section -->
    ${tasksStr.replace('<section>', '<section class="mb-10">')}
    
    ${bannerStr}
`;

content = content.replace(/    <\/div>\n<\/MainLayout>/, injection + '\n    </div>\n</MainLayout>');

fs.writeFileSync('src/pages/index.astro', content);
console.log("Done rearranging.");
