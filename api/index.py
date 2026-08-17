import csv
import io
import json
import math
import os

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

with open(os.path.join(BASE_DIR, "coefficients.json")) as f:
    MODEL = json.load(f)

COEF_CGPA, COEF_IQ = MODEL["coef"]
INTERCEPT = MODEL["intercept"]
ACCURACY = MODEL["accuracy"]

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path="")


def predict_one(cgpa, iq):
    z = COEF_CGPA * cgpa + COEF_IQ * iq + INTERCEPT
    probability = 1 / (1 + math.exp(-z))
    return round(probability * 100, 1), probability >= 0.5


def validate(cgpa, iq):
    if cgpa is None or iq is None:
        return "CGPA and IQ are required."
    if not (0 <= cgpa <= 10):
        return "CGPA must be between 0 and 10."
    if not (40 <= iq <= 200):
        return "IQ must be between 40 and 200."
    return None


@app.route("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    try:
        cgpa = float(data.get("cgpa"))
        iq = float(data.get("iq"))
    except (TypeError, ValueError):
        return jsonify({"error": "Enter valid numeric CGPA and IQ."}), 400

    err = validate(cgpa, iq)
    if err:
        return jsonify({"error": err}), 400

    probability, placed = predict_one(cgpa, iq)

    tip = None
    if not placed:
        # rough suggestion: how much CGPA increase would flip the odds, holding IQ fixed
        needed_cgpa = None
        if COEF_CGPA > 0:
            needed_cgpa = round((-INTERCEPT - COEF_IQ * iq) / COEF_CGPA + 0.05, 2)
        if needed_cgpa and needed_cgpa > cgpa:
            tip = f"Raising CGPA to about {needed_cgpa} (with the same IQ) would likely cross the placement threshold."
        else:
            tip = "Try improving CGPA and building projects/internships to strengthen your placement chances."

    return jsonify(
        {
            "placed": placed,
            "probability": probability,
            "tip": tip,
        }
    )


@app.route("/api/batch", methods=["POST"])
def batch():
    if "file" not in request.files:
        return jsonify({"error": "Upload a CSV file with 'cgpa' and 'iq' columns."}), 400

    file = request.files["file"]
    try:
        content = file.read().decode("utf-8")
        reader = csv.DictReader(io.StringIO(content))
        fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]
        if "cgpa" not in fieldnames or "iq" not in fieldnames:
            return jsonify({"error": "CSV must have 'cgpa' and 'iq' columns."}), 400

        results = []
        for i, row in enumerate(reader):
            row = {k.strip().lower(): v for k, v in row.items()}
            try:
                cgpa = float(row["cgpa"])
                iq = float(row["iq"])
            except (TypeError, ValueError):
                continue
            err = validate(cgpa, iq)
            if err:
                continue
            probability, placed = predict_one(cgpa, iq)
            results.append(
                {"row": i + 1, "cgpa": cgpa, "iq": iq, "placed": placed, "probability": probability}
            )
            if len(results) >= 500:
                break

        return jsonify({"results": results, "count": len(results)})
    except Exception:
        return jsonify({"error": "Could not parse the CSV file."}), 400


@app.route("/api/model-info")
def model_info():
    return jsonify({"accuracy": ACCURACY, "coef": [COEF_CGPA, COEF_IQ], "intercept": INTERCEPT})


# Local dev entry point
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port, debug=True)
