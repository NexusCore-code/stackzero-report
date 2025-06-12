const puppeteer = require('puppeteer');
const OpenAI = require('openai');
const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generatePDF({ name, email, subscriptions, type }) {
  const prompt = `
You are a SaaS analyst. For the tool(s): "${subscriptions}", return a JSON with:
{
  "plans": [{ "plan": "Pro", "price": "$12", "features": ["collaboration", "design exports"] }],
  "alternatives": [{ "tool": "Sketch", "plan": "Basic", "price": "$9", "goodFor": "UI design" }],
  "comparison": [{ "figmaPlan": "Pro", "figmaPrice": "$12", "alternative": "Sketch", "altPrice": "$9", "savings": "$3" }]
}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5
  });

  let parsed = { plans: [], alternatives: [], comparison: [] };

  try {
    parsed = JSON.parse(response.choices[0].message.content);
    console.log('✅ Parsed GPT:', parsed);
  } catch (err) {
    console.error('❌ Failed to parse GPT JSON:', err.message);
  }

  // Генерация HTML
  const html = `
    <html>
      <head><title>StackZero Report</title></head>
      <body>
        <h1>Hello, ${name}</h1>
        <p>Email: ${email}</p>
        <h2>Your Subscriptions</h2>
        <ul>${subscriptions.split(',').map(s => `<li>${s.trim()}</li>`).join('')}</ul>
        <h2>Plan Suggestions (from GPT)</h2>
        <pre>${JSON.stringify(parsed, null, 2)}</pre>
      </body>
    </html>
  `;

  // Сохраняем PDF
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const filename = `report_${uuidv4()}.pdf`;
  const filepath = path.join(__dirname, 'pdf', filename);
  await page.pdf({ path: filepath, format: 'A4' });

  await browser.close();
  return filepath;
}

module.exports = { generatePDF };
