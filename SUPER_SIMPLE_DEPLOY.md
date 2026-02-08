# 🚀 Super Simple Deployment Guide
## (No Technical Knowledge Needed!)

Follow these steps exactly - just copy and paste! ⬇️

---

## STEP 1: Open Terminal (2 minutes)

1. Press `Command + Space` on your Mac
2. Type: `terminal`
3. Press `Enter`
4. A black or white window will open - this is your terminal!

---

## STEP 2: Go to Your Project Folder (Copy & Paste This)

Copy this entire command and paste it into the terminal, then press Enter:

```bash
cd /Users/etsy/Library/Mobile\ Documents/com~apple~CloudDocs/Docs/Co-Work/sidehustle-engine
```

✅ You're now in your project folder!

---

## STEP 3: Set Up Git (Copy & Paste These One by One)

Copy and paste each command below, **pressing Enter after each one:**

```bash
git init
```
*(Press Enter, wait for it to finish)*

```bash
git branch -m main
```
*(Press Enter)*

```bash
git config user.email "admin@wissam.co.nz"
```
*(Press Enter)*

```bash
git config user.name "Samofy"
```
*(Press Enter)*

```bash
git add .
```
*(Press Enter - this might take 10-20 seconds)*

```bash
git commit -m "Initial commit: Voice AI app"
```
*(Press Enter)*

✅ Your code is now saved in Git!

---

## STEP 4: Create GitHub Repository (Web Browser)

1. Open your web browser
2. Go to: **https://github.com/new**
3. You should see "Create a new repository"
4. In the "Repository name" box, type: `sidehustle-engine`
5. Leave everything else as default (don't check any boxes)
6. Click the green **"Create repository"** button at the bottom

✅ Your GitHub repo is created!

---

## STEP 5: Push Your Code to GitHub

After creating the repo, GitHub will show you some commands. **IGNORE THOSE.**

Instead, copy and paste these commands into your terminal (one by one):

```bash
git remote add origin https://github.com/Samofy/sidehustle-engine.git
```
*(Press Enter)*

```bash
git push -u origin main
```
*(Press Enter - this will take 30-60 seconds to upload your code)*

When it asks for credentials, use:
- **Username:** Samofy
- **Password:** Use a GitHub personal access token (not your regular password)
  - If you don't have one, go to: https://github.com/settings/tokens/new
  - Click "Generate token"
  - Check "repo" box
  - Copy the token and paste it as your password

✅ Your code is now on GitHub!

---

## STEP 6: Deploy Backend to Railway

1. Go to: **https://railway.app/new**
2. Click **"Deploy from GitHub repo"**
3. Click **"Configure GitHub App"** (if needed)
4. Select **"sidehustle-engine"** repository
5. Railway will start deploying automatically

### Add Environment Variables to Railway:

1. Click on your new project
2. Click on the service card (it will say "sidehustle-engine")
3. Go to **"Variables"** tab
4. Click **"+ New Variable"**
5. Add these **5 variables** one by one:

| Variable Name | Value |
|---------------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DEEPGRAM_API_KEY` | `936ae366cbfaa3fa049df132051843554547b817` |
| `CARTESIA_API_KEY` | `sk_car_zdHxGKsvosKkctSVr1TNoy` |
| `CARTESIA_VOICE_ID` | `5ee9feff-1265-424a-9d7f-8e4d431a12c7` |

### Configure Root Directory:

1. Still in Railway, go to **"Settings"** tab
2. Scroll down to **"Root Directory"**
3. Type: `server`
4. Railway will redeploy automatically

### Get Your Railway URL:

1. Go to **"Settings"** tab
2. Scroll to **"Networking"**
3. Click **"Generate Domain"**
4. **Copy this URL** - you'll need it in the next step!
   - It will look like: `https://something.railway.app`

✅ Your backend is deployed!

---

## STEP 7: Deploy Frontend to Vercel

1. Go to: **https://vercel.com/new**
2. Click **"Import Project"**
3. Click **"Import Git Repository"**
4. Select **"sidehustle-engine"**
5. Before deploying, configure:
   - **Framework Preset:** Vite (should auto-detect)
   - **Root Directory:** Click "Edit" and type: `client`
   - **Environment Variables:** Click "Add" and enter:
     - **Name:** `VITE_API_URL`
     - **Value:** Your Railway URL from Step 6 (paste it here)
6. Click **"Deploy"**

Vercel will build and deploy your app (takes 2-3 minutes).

✅ Your frontend is deployed!

---

## STEP 8: Get Your Live App URL

Once Vercel finishes:
1. You'll see a **"Congratulations"** screen
2. Click **"Visit"** or copy the URL
3. Your app is now live! 🎉

The URL will look like: `https://sidehustle-engine.vercel.app`

---

## 🎯 You're Done!

Your voice AI app is now:
- ✅ On GitHub
- ✅ Backend deployed on Railway
- ✅ Frontend deployed on Vercel
- ✅ Live and accessible!

---

## 🐛 If Something Goes Wrong

### "Authentication failed" when pushing to GitHub:
- You need a personal access token, not your password
- Go to: https://github.com/settings/tokens/new
- Generate a token and use that as your password

### Railway deployment failed:
- Check the **"Deployments"** tab for error messages
- Make sure you set `server` as the Root Directory

### Vercel deployment failed:
- Check that Root Directory is set to `client`
- Make sure `VITE_API_URL` environment variable is set

---

## 📞 Need Help?

If you get stuck at any step, just tell me:
- Which step number you're on
- What you see on your screen
- Any error messages

I'll help you through it! 🙂
