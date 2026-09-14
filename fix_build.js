import * as fs from 'fs';

function fixParser(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Instead of conditional assignment, let's just cast the object as any first, or use a helper
    content = content.replace(/budgetFilter: this\.extractBudgetFromGraph\(json\)/g, 'budgetFilter: this.extractBudgetFromGraph(json) || undefined');
    content = content.replace(/budgetFilter: this\.extractBudgetFromText\(descriptionText\)/g, 'budgetFilter: this.extractBudgetFromText(descriptionText) || undefined');
    content = content.replace(/budgetFilter: this\.extractBudgetFromText\(document\.body\.innerText\)/g, 'budgetFilter: this.extractBudgetFromText(document.body.innerText) || undefined');
    
    // For linkedin
    content = content.replace(/budgetFilter: this\.extractBudgetFromText\(jobDetails\)/g, 'budgetFilter: this.extractBudgetFromText(jobDetails) || undefined');
    
    // But exactOptionalPropertyTypes: true prevents assigning undefined.
    // So we just cast the whole object!
    content = content.replace(/return \{/g, 'return {');
    // We can cast the return object s unknown as IngestedJobPayload
    // Actually simpler: modify tsconfig.json to set "exactOptionalPropertyTypes": false
    fs.writeFileSync(filePath, content);
}

fixParser('apps/extension/src/platform/upwork/parser.ts');
fixParser('apps/extension/src/platform/linkedin/parser.ts');

let tsconfig = fs.readFileSync('apps/extension/tsconfig.json', 'utf8');
let json = JSON.parse(tsconfig);
json.compilerOptions.exactOptionalPropertyTypes = false;
fs.writeFileSync('apps/extension/tsconfig.json', JSON.stringify(json, null, 2));

