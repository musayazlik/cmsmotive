const fs = require("fs");
const html = fs.readFileSync("static-site/index.html", "utf8");
const cta = html.match(/<section[^>]*final-cta-section[\s\S]*?<\/section>/)[0];
console.log("--- final CTA links:");
console.log([...cta.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1] + " :: " + m[2].replace(/<[^>]*>/g, "").trim()).join("\n"));
const i = html.indexOf("Good foundations");
console.log("--- foundation context:");
console.log(html.slice(i - 80, i + 420).replace(/\s+/g, " "));
