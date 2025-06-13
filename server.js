const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { generatePDF } = require('./generate-pdf.js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Обслуживаем клиентскую папку
app.use(express.static(path.join(__dirname, 'client')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Обработка формы
app.post('/submit', async (req, res) => {
  const { name, email, subscriptions, type } = req.body;

  if (!name || !email || !subscriptions) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('✅ Incoming request:', { name, email, subscriptions, type });

    const file = await generatePDF({ name, email, subscriptions, type });
    const buffer = fs.readFileSync(file);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="StackZero_Report.pdf"');
    res.send(buffer);
  } catch (err) {
    console.error('❌ PDF generation failed:', err);
    console.error('🔥 Full error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 StackZero server running at http://localhost:${PORT}`);
});
