const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'https://stackzero.ai' })); // разрешаем только с твоего домена
app.use(bodyParser.json());

app.post('/submit', async (req, res) => {
  const { name, email, subscriptions } = req.body;

  const html = `
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: sans-serif; padding: 40px; }
        h1 { color: #007AFF; }
        ul { margin-top: 20px; }
        li { margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <h1>StackZero Report</h1>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <h2>Subscriptions:</h2>
      <ul>
        ${subscriptions.split(',').map(sub => `<li>${sub.trim()}</li>`).join('')}
      </ul>
    </body>
    </html>
  `;

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=\"report.pdf\"');
    res.send(pdf);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating PDF');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
