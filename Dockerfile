# Используем Node.js 18
FROM node:18

# Рабочая директория
WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем всё остальное
COPY . .

# Указываем порт (DigitalOcean App Platform ожидает 8080)
EXPOSE 8080

# Запуск приложения
CMD ["npm", "start"]
