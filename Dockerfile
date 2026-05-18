# Étape 1 — Builder le frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 — Image finale (Python + frontend buildé)
FROM python:3.11-slim
WORKDIR /app

# Dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code backend
COPY backend/ ./backend/

# Frontend buildé (depuis l'étape 1)
COPY --from=frontend /app/dist/ ./dist/

EXPOSE 8080

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
