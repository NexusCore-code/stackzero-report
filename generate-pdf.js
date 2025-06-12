import puppeteer from 'puppeteer';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function mask(text) {
  return text.replace(/[a-zA-Z0-9]/g, '*');
}

function toTable(data, headers, maskFlag) {
  if (!Array.isArray(data)) return '<p>⚠️ Invalid data</p>';
  const head = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const rows = data.map(row =>
    `<tr>${headers.map(key => `<td>${maskFlag ? mask(row[key]) : row[key]}</td>`).join('')}</tr>`
  );
  return `<table>${head}${rows.join('')}</table>`;
}

export async function generatePDF({ name, email, subscriptions, type }) {
  const isFree = type === 'free';

  const prompt = `
You are a SaaS analyst. For the tool "${subscriptions}", return a JSON with:
- plans: { plan, price, for, features }
- alternatives: { tool, plan, price, goodFor, limitations }
- comparison: { figmaPlan, figmaPrice, alternative, altPrice, savings }
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

  const template = await fs.readFile(path.join('server', 'report_template.html'), 'utf-8');

  const plans = toTable(parsed.plans, ['plan', 'price', 'for', 'features'], isFree);
  const alts = toTable(parsed.alternatives, ['tool', 'plan', 'price', 'goodFor', 'limitations'], isFree);
  const cmp = toTable(parsed.comparison, ['figmaPlan', 'figmaPrice', 'alternative', 'altPrice', 'savings'], isFree);

  const filled = template
    .replace('{{subscriptions}}', subscriptions)
    .replace('{{figmaPlans}}', plans)
    .replace('{{alternatives}}', alts)
    .replace('{{comparison}}', cmp);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(filled, { waitUntil: 'networkidle0' });

  const filename = `./pdf/report_${Date.now()}.pdf`;
  await page.pdf({ path: filename, format: 'A4' });

  await browser.close();
  return filename;
}
