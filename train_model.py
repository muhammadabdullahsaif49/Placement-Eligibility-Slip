"""
Replicates the training steps from PROJECT.ipynb exactly:
- Load placement.csv
- Split cgpa/iq (x) and placement (y)
- train_test_split(test_size=0.3, random_state=2)
- Fit LogisticRegression
- Save model + coefficients + a dataset sample for the chart
"""
import json
import pickle

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

df = pd.read_csv("placement.csv")

x = df.iloc[:, 1:3]  # cgpa, iq
y = df.iloc[:, -1]   # placement

x_train, x_test, y_train, y_test = train_test_split(
    x, y, test_size=0.3, random_state=2
)

clf = LogisticRegression()
clf.fit(x_train, y_train)

accuracy = clf.score(x_test, y_test)
print(f"Test accuracy: {accuracy:.4f}")

with open("model.pkl", "wb") as f:
    pickle.dump(clf, f)

coefficients = {
    "coef": clf.coef_[0].tolist(),
    "intercept": clf.intercept_[0],
    "accuracy": round(accuracy, 4),
}
with open("coefficients.json", "w") as f:
    json.dump(coefficients, f, indent=2)

# Sample dataset for the chart (cap at 300 points for a light payload)
sample = df.sample(min(300, len(df)), random_state=1)[["cgpa", "iq", "placement"]]
sample.to_json("public/dataset_sample.json", orient="records")

print("Saved model.pkl, coefficients.json, public/dataset_sample.json")
