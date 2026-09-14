import * as fs from 'fs';

function fixParser(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace budgetFilter: this.extractBudget... with a conditional assignment or casting
    content = content.replace(/budgetFilter: this\.extractBudgetFromGraph\(json\)/g, '...(this.extractBudgetFromGraph(json) ? { budgetFilter: this.extractBudgetFromGraph(json) } : {})');
    content = content.replace(/budgetFilter: this\.extractBudgetFromText\(descriptionText\)/g, '...(this.extractBudgetFromText(descriptionText) ? { budgetFilter: this.extractBudgetFromText(descriptionText) } : {})');
    content = content.replace(/budgetFilter: this\.extractBudgetFromText\(document\.body\.innerText\)/g, '...(this.extractBudgetFromText(document.body.innerText) ? { budgetFilter: this.extractBudgetFromText(document.body.innerText) } : {})');
    
    // For linkedin
    content = content.replace(/budgetFilter: this\.extractBudgetFromText\(jobDetails\)/g, '...(this.extractBudgetFromText(jobDetails) ? { budgetFilter: this.extractBudgetFromText(jobDetails) } : {})');
    
    fs.writeFileSync(filePath, content);
}

fixParser('apps/extension/src/platform/upwork/parser.ts');
fixParser('apps/extension/src/platform/linkedin/parser.ts');
