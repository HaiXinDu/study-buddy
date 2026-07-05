import json, csv, numpy as np, re, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train_emotion_model import load_wordlist, forward_max_match, tokenize, SimpleTfidf, SimpleNaiveBayes

base = os.path.dirname(os.path.abspath(__file__))
dataset_path = os.path.join(base, 'emotion_dataset.csv')

texts, labels = [], []
with open(dataset_path, 'r', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        if r['text'] and r['emotion'] and not re.search(r'[a-zA-Z]', r['text']):
            texts.append(r['text'].strip())
            labels.append(r['emotion'].strip())

docs = [tokenize(t) for t in texts]
tfidf = SimpleTfidf(max_features=500, min_df=2)
tfidf.fit(docs)
X = tfidf.transform(docs)
y = np.array(labels)
model = SimpleNaiveBayes(class_weight={'crisis': 2.0, 'depressed': 1.5})
model.fit(X, y)
y_pred = model.predict(X)

classes = sorted(set(y))

# Header
header = '{:>12}'.format('')
for c in classes:
    header += ' {:>8}'.format(c[:8])
print(header)

for c_true in classes:
    mask = y == c_true
    row = '{:>12}'.format(c_true[:12])
    for c_pred in classes:
        count = int(np.sum(y_pred[mask] == c_pred))
        row += ' {:>8}'.format(count)
    print(row)

print()
print('=== Confusion pairs (>=5) ===')
confusions = []
for c_true in classes:
    mask = y == c_true
    for c_pred in classes:
        if c_true != c_pred:
            count = int(np.sum(y_pred[mask] == c_pred))
            if count >= 5:
                confusions.append((count, c_true, c_pred))

confusions.sort(reverse=True)
for count, c_true, c_pred in confusions:
    print(f'  {c_true} -> {c_pred}: {count}')
