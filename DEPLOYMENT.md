# SnapTick Deployment Guide - 100% FREE

Deploy SnapTick with zero cost using Render + Hugging Face Spaces + MongoDB Atlas.

## Architecture

| Service | Platform | Cost | RAM |
|---------|----------|------|-----|
| Frontend | Render (Static) | **FREE** | N/A |
| Backend | Render (Web Service) | **FREE** | 512MB |
| DeepFace | Hugging Face Spaces | **FREE** | 2GB |
| Database | MongoDB Atlas | **FREE** | 512MB |

**Total Cost: $0/month**

---

## Quick Start (15 minutes)

### Step 1: Set Up MongoDB Atlas (2 min)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create free account > Create Cluster (M0 Free)
3. Database Access > Add user with password
4. Network Access > Add IP `0.0.0.0/0`
5. Connect > Get connection string:
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/snaptick
   ```

### Step 2: Deploy DeepFace to Hugging Face (5 min)

1. Go to [huggingface.co](https://huggingface.co) > Sign up
2. New Space > Choose **Docker** SDK
3. Name it: `snaptick-deepface`
4. Upload these files from `deepface-hf/` folder:
   - `app.py`
   - `requirements.txt`
   - `Dockerfile`
   - `README.md`
5. Wait for build (~5-10 min first time)
6. Your URL will be: `https://<username>-snaptick-deepface.hf.space`

**Test it:**
```bash
curl https://<username>-snaptick-deepface.hf.space/health
```

### Step 3: Deploy Backend to Render (5 min)

1. Push code to GitHub
2. Go to [render.com](https://render.com) > New > Web Service
3. Connect GitHub repo
4. Configure:
   - **Name:** `snaptick-backend`
   - **Root Directory:** `Backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

5. Add Environment Variables:
   ```
   NODE_ENV = production
   PORT = 5000
   MONGO_URI = mongodb+srv://... (from Step 1)
   JWT_SECRET = generate-a-random-32-char-string-here
   BASE_URL = https://snaptick-backend.onrender.com
   ALLOWED_ORIGINS = https://snaptick-frontend.onrender.com
   DEEPFACE_URL = https://<username>-snaptick-deepface.hf.space
   ```

6. Add Disk (optional, for uploaded images):
   - Mount Path: `/opt/render/project/src/Backend/uploads`
   - Size: 1GB

7. Click **Create Web Service**

### Step 4: Deploy Frontend to Render (3 min)

1. New > Static Site
2. Connect same GitHub repo
3. Configure:
   - **Name:** `snaptick-frontend`
   - **Root Directory:** `Frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

4. Add Environment Variable:
   ```
   VITE_API_URL = https://snaptick-backend.onrender.com
   ```

5. Click **Create Static Site**

---

## Verify Deployment

1. Visit `https://snaptick-frontend.onrender.com`
2. Register a teacher account
3. Create a classroom
4. Enroll a student with photo (tests DeepFace)
5. Take attendance with group photo

---

## Troubleshooting

### "Face processing failed"
- Check DeepFace is running: `curl https://your-hf-space.hf.space/health`
- Hugging Face free tier sleeps after inactivity - first request takes 30-60s
- Check `DEEPFACE_URL` env var is correct (no trailing slash)

### CORS errors
- Ensure `ALLOWED_ORIGINS` matches your frontend URL exactly
- No trailing slash: `https://app.com` not `https://app.com/`

### Backend crashes
- Check Render logs for errors
- Verify `MONGO_URI` is correct
- Free tier has 512MB RAM - should be sufficient

### Slow first request
- Both Render free tier and HF Spaces sleep after inactivity
- First request after sleep takes 30-60 seconds
- This is normal for free tier

---

## Free Tier Limitations

| Platform | Limitation | Workaround |
|----------|------------|------------|
| Render Backend | Sleeps after 15 min | First request wakes it (~30s) |
| HF Spaces | Sleeps after inactivity | First request wakes it (~60s) |
| MongoDB Atlas | 512MB storage | Sufficient for ~1000 students |
| Render Static | None | Unlimited |

---

## Upgrading Later

When you need more performance:

1. **Render Starter ($7/mo)**: Backend doesn't sleep
2. **HF Spaces Upgrade**: Faster CPU/GPU options
3. **MongoDB M2 ($9/mo)**: More storage and performance

---

## File Structure for Deployment

```
your-repo/
├── Frontend/              → Render Static Site
├── Backend/               → Render Web Service
├── deepface-hf/           → Hugging Face Space (separate repo)
│   ├── app.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
├── render.yaml            → Optional: Blueprint deployment
└── DEPLOYMENT.md          → This file
```

---

## Alternative: Using render.yaml Blueprint

For automated deployment (Frontend + Backend only):

1. Push to GitHub
2. Render Dashboard > Blueprints > New Blueprint Instance
3. Select repo > Render reads `render.yaml`
4. Fill in environment variables
5. Deploy!

Note: DeepFace still needs manual Hugging Face setup.
