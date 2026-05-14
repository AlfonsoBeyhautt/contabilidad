# Contabilidad Web

App web de contabilidad construida con Next.js y Supabase.

## Requisitos

- Node.js 20+
- npm 10+

## Variables de entorno

1. Copiar el archivo de ejemplo:

```bash
cp .env.example .env.local
```

2. Completar los valores en `.env.local` con tus credenciales de Supabase.

3. **Analista empresarial (OpenAI, opcional):** agregá `OPENAI_API_KEY` con tu clave de la [API de OpenAI](https://platform.openai.com/api-keys). Es una variable **solo servidor** (no uses el prefijo `NEXT_PUBLIC_`). En Vercel: **Project Settings → Environment Variables → `OPENAI_API_KEY`**.

> `.env.local` no se versiona en git.

## Desarrollo local

```bash
npm install
npm run dev
```

La app corre en `http://localhost:3001`.

## Build de producción

```bash
npm run build
npm run start
```

## Subir a GitHub

Si es la primera vez que conectas este proyecto a GitHub:

```bash
git init
git add .
git commit -m "chore: prepare project for production deployment"
git branch -M main
git remote add origin <TU_REPO_GITHUB_URL>
git push -u origin main
```

Si ya tenías el repo inicializado:

```bash
git add .
git commit -m "chore: update project for deployment"
git push
```

## Deploy en Vercel

1. Importar el repositorio en [Vercel](https://vercel.com/new).
2. Framework Preset: `Next.js`.
3. Definir variables de entorno en Vercel con los mismos valores que `.env.local`.
4. Deploy.

También podés usar Vercel CLI:

```bash
npm i -g vercel
vercel
vercel --prod
```
