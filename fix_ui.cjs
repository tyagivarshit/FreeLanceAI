const fs = require("fs");

let file = "apps/frontend/src/pages/Prompts.jsx";
let content = fs.readFileSync(file, "utf8");

content = content.replace("import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';", "");

content = content.replace(/<Card className="([^"]*)">/g, '<div className={`rounded-xl shadow-sm border ${"$1"}`}>');
content = content.replace(/<Card>/g, '<div className="rounded-xl shadow-sm border">');
content = content.replace(/<\/Card>/g, '</div>');

content = content.replace(/<CardHeader className="([^"]*)">/g, '<div className={`p-6 ${"$1"}`}>');
content = content.replace(/<CardHeader>/g, '<div className="p-6">');
content = content.replace(/<\/CardHeader>/g, '</div>');

content = content.replace(/<CardContent className="([^"]*)">/g, '<div className={`p-6 ${"$1"}`}>');
content = content.replace(/<CardContent>/g, '<div className="p-6">');
content = content.replace(/<\/CardContent>/g, '</div>');

content = content.replace(/<CardTitle className="([^"]*)">([^<]*)<\/CardTitle>/g, '<h3 className={`font-semibold ${"$1"}`}>$2</h3>');
content = content.replace(/<CardTitle>([^<]*)<\/CardTitle>/g, '<h3 className="font-semibold">$1</h3>');

content = content.replace(/<CardDescription>([^<]*)<\/CardDescription>/g, '<p className="text-sm text-slate-500">$1</p>');

fs.writeFileSync(file, content);
console.log("Removed UI component dependencies");
