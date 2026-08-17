# Placement Eligibility Predictor (Flask + Python)

Web app version of the original `PROJECT.ipynb` notebook. The model is trained
in Python (`train_model.py`) using the **exact same steps as the notebook**
(same train/test split, same LogisticRegression, same random_state) — the app
then uses the trained coefficients to serve predictions.

## Features
- **Predict** — enter CGPA & IQ, get instant placement result + confidence %
- **Tips** — if "Not Placed", get a suggestion on what CGPA would likely flip the result
- **Batch (CSV)** — upload a CSV with `cgpa`/`iq` columns, get predictions for every row
- **Dataset chart** — visual scatter plot of the training data (CGPA vs IQ, colored by placement)
- **History** — your last 50 predictions, saved in your browser (no login needed)
- **Dark mode** — toggle top-right, remembered between visits

## Project structure
```
placement-flask/
├── api/index.py          # Flask app — all routes (/, /api/predict, /api/batch, /api/model-info)
├── train_model.py        # Retrains the model exactly like the notebook
├── model.pkl              # Trained model (for reference / reuse)
├── coefficients.json      # Extracted weights the Flask app actually runs on
├── placement.csv          # Original training data
├── public/                # Frontend (plain HTML/CSS/JS, no build step)
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── dataset_sample.json
├── requirements.txt
└── vercel.json            # Deploy config for Vercel
```

## Run locally
```bash
pip install -r requirements.txt
python api/index.py
```
Open http://localhost:3000

Re-train the model any time with `python train_model.py` — it regenerates
`model.pkl`, `coefficients.json`, and the chart's dataset sample.

<img width="1920" height="826" alt="screencapture-127-0-0-1-3000-2026-08-17-23_10_04" src="https://github.com/user-attachments/assets/215e77f4-293e-4a77-8e7d-ec7d103deab2" />




## Deploy to Vercel
1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new and import the repo.
3. Vercel auto-detects `vercel.json` and deploys the Flask API as a serverless
   function, with the `public/` folder served as static files. No extra config needed.
4. Click **Deploy**.

Or via CLI:
```bash
npm i -g vercel
vercel
```
