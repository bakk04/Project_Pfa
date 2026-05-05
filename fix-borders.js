const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) { 
            results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src/app/(main)/profile'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace basic full borders
    content = content.replace(/\bborder border-border(\/\d+)?\b/g, 'ring-1 ring-inset ring-border$1 border-0');
    
    // Replace border-b / border-t
    content = content.replace(/\bborder-b border-border(\/\d+)?\b/g, 'border-b-[1px] border-solid border-border$1');
    content = content.replace(/\bborder-t border-border(\/\d+)?\b/g, 'border-t-[1px] border-solid border-border$1');

    // Fix buttons in Sidebar and BottomNav
    if (file.includes('Sidebar.tsx') || file.includes('BottomNav.tsx')) {
        content = content.replace(/className={\`relative flex/g, 'className={`appearance-none border-none bg-transparent relative flex');
    }

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log('Updated', file);
    }
});
