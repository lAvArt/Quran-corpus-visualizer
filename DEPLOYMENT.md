# Deployment Guide (Vercel)

This project is a Next.js application designed to be deployed on Vercel with minimal configuration.

## Prerequisites

- A [Vercel](https://vercel.com) account.
- Access to the GitHub repository.

## Environment Variables

This application performs client-side data fetching from the public `api.quran.com` and caches it using IndexedDB.

**No server-side environment variables are required** for the core functionality.

## Deployment Steps

1. **Push to GitHub**: Ensure your latest code is pushed to the repository.
2. **Import to Vercel**:
    - Go to your Vercel Dashboard.
    - Click **"Add New..."** > **"Project"**.
    - Import the `quran-corpus-visualizer` repository.
3. **Configure Project**:
    - **Framework Preset**: Select **Next.js**.
    - **Root Directory**: `./` (Default)
    - **Build Command**: `next build` (Default)
    - **Output Directory**: `.next` (Default)
    - **Install Command**: `npm install` (Default)
4. **Deploy**: Click **Deploy**.

## Post-Deployment Verification

Once deployed, verify the following:

1. **Initial Load**: The app should load the UI immediately.
2. **Data Fetching**: The dashboard will start initializing. Check the console logs for "CorpusLoader" messages.
3. **Caching**: Refresh the page after the initial load. It should load significantly faster as it retrieves data from the browser's IndexedDB locally.
