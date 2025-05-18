StackZero Report API (Render-ready)

1. POST to /submit with JSON:
   {
     "name": "Your Name",
     "email": "your@email.com",
     "subscriptions": "Figma ($36/mo), Notion ($10/mo)"
   }

2. Response is a PDF with rendered content.

Start with:
npm install
npm start