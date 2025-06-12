import puppeteer from 'puppeteer';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { GoogleSearch } = require('serpapi');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const serpapi = new GoogleSearch(process.env.SERPAPI_KEY);

function mask(text) {
  if (typeof text === 'string') {
    return text.replace(/[a-zA-Z0-9]/g, '*');
  }
  if (Array.isArray(text)) {
    return text.map(mask).join(', ');
  }
  if (typeof text === 'object' && text !== null) {
    return Object.entries(text).map(([k, v]) => `${k}: ${mask(v)}`).join(', ');
  }
  if (typeof text === 'number') {
    return '*'.repeat(text.toString().length);
  }
  return '***';
}

function toTable(data, headers, maskToolNames) {
  if (!Array.isArray(data)) return '<p>⚠️ Invalid data</p>';
  const head = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const rows = data.map(row => {
    return `<tr>${headers.map(key => {
      const value = row[key];
      const shouldMask = (key === 'tool');
      return `<td>${maskToolNames && shouldMask ? mask(value) : value}</td>`;
    }).join('')}</tr>`;
  });
  return `<table>${head}${rows.join('')}</table>`;
}

export async function generatePDF({ name, email, subscriptions, type }) {
  const isFree = type === 'free';

  const serpSnippet = await new Promise((resolve, reject) => {
    serpapi.json({
      q: `${subscriptions} pricing alternatives`,
      location: 'United States',
      hl: 'en',
      gl: 'us'
    }, (data) => {
      resolve(data.organic_results?.[0]?.snippet || '');
    });
  });

  const prompt = `
You are a SaaS pricing analyst.
Based on the following context from a search snippet:
"${serpSnippet}"
For the tool "${subscriptions}", reply ONLY with a valid JSON object (do NOT explain anything).
The JSON must include 3 arrays:
"plans": [ { "plan": string, "price": string, "for": string, "features": string } ],
"alternatives": [ { "tool": string, "plan": string, "price": string, "goodFor": string, "limitations": string } ],
"comparison": [ { "figmaPlan": string, "figmaPrice": string, "alternative": string, "altPrice": string, "savings": string } ]
Strictly reply with only raw JSON — no preface, no markdown, no code block.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
  });

  let parsed = { plans: [], alternatives: [], comparison: [] };
  try {
    parsed = JSON.parse(response.choices[0].message.content);
  } catch (e) {
    console.error('❌ JSON parse failed:', e.message);
  }

  const template = await fs.readFile('report_template.html', 'utf-8');

  const plans = toTable(parsed.plans, ['plan', 'price', 'for', 'features'], isFree);
  const alts = toTable(parsed.alternatives, ['tool', 'plan', 'price', 'goodFor', 'limitations'], isFree);
  const cmp = toTable(parsed.comparison, ['figmaPlan', 'figmaPrice', 'alternative', 'altPrice', 'savings'], isFree);

  const filled = template
    .replace('{{subscriptions}}', subscriptions)
    .replace('{{figmaPlans}}', plans)
    .replace('{{alternatives}}', alts)
    .replace('{{comparison}}', cmp);

  await fs.mkdir('pdf', { recursive: true });
  const filename = `./pdf/report_${Date.now()}.pdf`;

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(filled, { waitUntil: 'networkidle0' });
  await page.pdf({ path: filename, format: 'A4' });
  await browser.close();

  return filename;
}
