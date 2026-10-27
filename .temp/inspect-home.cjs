const fs = require("fs");
const html = fs.readFileSync("static-site/index.html", "utf8");
// section bodies
const sections = [...html.matchAll(/<section[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/section>/g)];
for (const [, cls, body] of sections) {
  const texts = [...body.matchAll(/<(h1|h2|h3|p|li|summary|span class="stat-number")[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  console.log(`\n=== ${cls} ===`);
  console.log(texts.slice(0, 40).join("\n"));
}
// faq details
const faqs = [...html.matchAll(/<details[^>]*faq-item[^>]*>([\s\S]*?)<\/details>/g)].map((m) => m[1]);
console.log("\n=== FAQ items ===", faqs.length);
for (const f of faqs) {
  const q = (f.match(/faq-question[^>]*>([\s\S]*?)<\/span>/) || [])[1]?.replace(/<[^>]*>/g, "").trim();
  const a = (f.match(/faq-answer[^>]*>([\s\S]*?)<\/div>/) || [])[1]?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  console.log("Q:", q, "\nA:", a, "\n");
}
// data-product cards
const products = [...html.matchAll(/data-product="([^"]*)"/g)].map((m) => m[1]);
console.log("data-product slugs:", products.join(", "));
// links in hero
const hero = html.match(/<section[^>]*class="hero"[\s\S]*?<\/section>/)?.[0] ?? "";
console.log("\nhero links:", [...hero.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1] + " :: " + m[2].replace(/<[^>]*>/g, "").trim()).join("\n"));
