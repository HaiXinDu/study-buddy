# -*- coding: utf-8 -*-
"""
学伴小管家 - 情绪识别模型训练脚本
使用 TF-IDF + 朴素贝叶斯训练轻量文本分类模型
"""

import json
import numpy as np
from collections import Counter
import csv
import re
import os

# ========== 配置 ==========
DATASET_PATH = "emotion_dataset.csv"
OUTPUT_DIR = "../ai-engine"
MIN_DF = 2          # 最小文档频率
MAX_FEATURES = 500  # 最大特征数（控制模型大小）

# ========== 加载与前端相同的词表 ==========
WORDLIST_PATH = os.path.join(OUTPUT_DIR, "chinese_words.json")
_word_set = None
_word_list_sorted = None

def load_wordlist():
    global _word_set, _word_list_sorted
    if _word_set is None:
        with open(WORDLIST_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        _word_set = set(data['words'])
        # 按长度降序排列，用于前向最大匹配
        _word_list_sorted = sorted(_word_set, key=len, reverse=True)
    return _word_set, _word_list_sorted

def forward_max_match(text):
    """前向最大匹配分词（与前端 emotion-classifier.js 一致）"""
    _, sorted_words = load_wordlist()
    result = []
    i = 0
    while i < len(text):
        matched = False
        for word in sorted_words:
            if text[i:i+len(word)] == word:
                result.append(word)
                i += len(word)
                matched = True
                break
        if not matched:
            # 单字处理：2字以上才保留
            if len(text[i]) >= 1 and '\u4e00' <= text[i] <= '\u9fff':
                # 单个中文字不作为词保留（与前端一致，前端 minWordLength=2）
                pass
            i += 1
    return result

# ========== 中文分词 + 预处理 ==========
STOP_WORDS = set([
    "的", "了", "是", "我", "你", "在", "和", "就", "都", "要", "会", "能",
    "这", "那", "有", "个", "也", "很", "但", "而", "对", "为", "与", "及",
    "等", "或", "其", "它", "们", "吧", "啊", "呢", "哦", "嗯", "哈", "吗",
    "什么", "怎么", "这样", "那么", "一下", "一直", "一天", "一个", "一种",
    "今天", "明天", "最近", "现在", "感觉", "觉得", "但是", "因为", "所以",
    "虽然", "还是", "就是", "不是", "没有", "知道", "想", "做", "去", "来",
    "好", "太", "真", "挺", "又", "还", "可", "得", "着", "过", "把", "给"
])

def tokenize(text):
    """中文分词 + 清洗（使用与前端相同的前向最大匹配）"""
    text = re.sub(r'[^\u4e00-\u9fa5a-zA-Z]', ' ', text)
    words = forward_max_match(text)
    words = [w.strip() for w in words if len(w.strip()) > 1 and w.strip() not in STOP_WORDS]
    return words

def load_dataset(path):
    """加载训练数据"""
    texts = []
    labels = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['text'] and row['emotion']:
                text = row['text'].strip()
                # 过滤中英混合样本（含ASCII字母的样本）
                if re.search(r'[a-zA-Z]', text):
                    continue
                texts.append(text)
                labels.append(row['emotion'].strip())
    return texts, labels

# ========== 自定义 TF-IDF ==========
class SimpleTfidf:
    def __init__(self, max_features=500, min_df=2):
        self.max_features = max_features
        self.min_df = min_df
        self.vocab = {}        # word -> index
        self.idf = None
        self.vocab_list = []

    def fit(self, docs):
        """学习词汇表和IDF"""
        # 统计词频和文档频率
        df = Counter()
        word_counts = []
        for doc in docs:
            unique_words = set(doc)
            word_counts.append(Counter(doc))
            for w in unique_words:
                df[w] += 1

        # 过滤低频词，选择高频词作为特征
        valid_words = {w: c for w, c in df.items() if c >= self.min_df}
        top_words = sorted(valid_words.items(), key=lambda x: x[1], reverse=True)[:self.max_features]

        self.vocab = {w: i for i, (w, _) in enumerate(top_words)}
        self.vocab_list = [w for w, _ in top_words]

        N = len(docs)
        self.idf = np.zeros(len(self.vocab))
        for w, idx in self.vocab.items():
            self.idf[idx] = np.log((N + 1) / (df[w] + 1)) + 1

        return self

    def transform(self, docs):
        """将文档转换为 TF-IDF 向量"""
        X = np.zeros((len(docs), len(self.vocab)))
        for i, doc in enumerate(docs):
            word_count = Counter(doc)
            total = sum(word_count.values())
            if total == 0:
                continue
            for w, count in word_count.items():
                if w in self.vocab:
                    idx = self.vocab[w]
                    tf = count / total
                    X[i, idx] = tf * self.idf[idx]
        return X

# ========== 自定义朴素贝叶斯 ==========
class SimpleNaiveBayes:
    def __init__(self, class_weight=None):
        self.classes = []
        self.class_prior = {}
        self.feature_log_prob = {}
        self.epsilon = 1e-10
        self.class_weight = class_weight or {}

    def fit(self, X, y):
        """训练模型"""
        self.classes = sorted(list(set(y)))
        n_samples, n_features = X.shape

        for c in self.classes:
            X_c = X[y == c]
            # 应用类别权重（过采样效果）
            weight = self.class_weight.get(c, 1.0)
            effective_count = len(X_c) * weight
            self.class_prior[c] = np.log(effective_count / n_samples)
            # 计算每个特征在每个类别下的条件概率（使用平滑）
            smoothed_fc = X_c.sum(axis=0) * weight + self.epsilon
            smoothed_cc = smoothed_fc.sum() + n_features * self.epsilon
            self.feature_log_prob[c] = np.log(smoothed_fc / smoothed_cc)

        return self

    def predict(self, X):
        """预测类别"""
        results = []
        for i in range(X.shape[0]):
            scores = {}
            for c in self.classes:
                score = self.class_prior[c] + np.dot(X[i], self.feature_log_prob[c])
                scores[c] = score
            results.append(max(scores, key=scores.get))
        return np.array(results)

    def predict_proba(self, X):
        """预测概率"""
        results = []
        for i in range(X.shape[0]):
            scores = {}
            for c in self.classes:
                score = self.class_prior[c] + np.dot(X[i], self.feature_log_prob[c])
                scores[c] = score
            # softmax
            exp_scores = {k: np.exp(v - max(scores.values())) for k, v in scores.items()}
            total = sum(exp_scores.values())
            probs = {k: v / total for k, v in exp_scores.items()}
            results.append(probs)
        return results

# ========== 模型评估 ==========
def evaluate(y_true, y_pred):
    """简单评估"""
    accuracy = np.mean(y_true == y_pred)
    print(f"\n模型准确率: {accuracy:.2%}")
    print("\n各类别表现:")
    for c in sorted(set(y_true)):
        mask = y_true == c
        if mask.sum() > 0:
            class_acc = np.mean(y_pred[mask] == c)
            print(f"  {c}: {class_acc:.2%} ({mask.sum()} 条)")
    return accuracy

# ========== 导出模型为 JSON ==========
def export_model(tfidf, model, output_path):
    """导出为前端可用的 JSON"""
    export_data = {
        "version": "1.0",
        "model_type": "naive_bayes",
        "classes": model.classes,
        "vocab": tfidf.vocab_list,
        "idf": tfidf.idf.tolist(),
        "class_prior": {k: float(v) for k, v in model.class_prior.items()},
        "feature_log_prob": {k: v.tolist() for k, v in model.feature_log_prob.items()}
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, ensure_ascii=False, separators=(',', ':'))

    size_kb = os.path.getsize(output_path) / 1024
    print(f"\n模型已导出: {output_path}")
    print(f"模型大小: {size_kb:.2f} KB")
    print(f"词汇量: {len(tfidf.vocab_list)}")
    print(f"类别数: {len(model.classes)}")

# ========== 主流程 ==========
def main():
    print("=" * 50)
    print("学伴小管家 - 情绪识别模型训练")
    print("=" * 50)

    # 1. 加载数据
    print("\n[1/5] 加载训练数据...")
    texts, labels = load_dataset(DATASET_PATH)
    print(f"  共 {len(texts)} 条训练数据")
    print(f"  类别分布: {Counter(labels)}")

    # 2. 分词
    print("\n[2/5] 分词处理...")
    docs = [tokenize(t) for t in texts]
    print(f"  示例: {' | '.join(docs[0][:5])}")

    # 3. 训练 TF-IDF
    print("\n[3/5] 训练 TF-IDF...")
    tfidf = SimpleTfidf(max_features=MAX_FEATURES, min_df=MIN_DF)
    tfidf.fit(docs)
    X = tfidf.transform(docs)
    print(f"  特征维度: {X.shape[1]}")

    # 4. 训练朴素贝叶斯
    print("\n[4/5] 训练朴素贝叶斯分类器...")
    y = np.array(labels)
    model = SimpleNaiveBayes(class_weight={'crisis': 1.5, 'depressed': 1.0, 'angry': 1.1, 'neutral': 1.3, 'stressed': 1.1})
    model.fit(X, y)
    print(f"  类别: {model.classes}")

    # 5. 评估
    print("\n[5/5] 模型评估...")
    y_pred = model.predict(X)
    evaluate(y, y_pred)

    # 6. 导出
    print("\n[导出] 保存模型文件...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    export_model(tfidf, model, os.path.join(OUTPUT_DIR, "emotion_model.json"))

    print("\n" + "=" * 50)
    print("训练完成！模型已准备好用于前端推理。")
    print("=" * 50)

if __name__ == "__main__":
    main()
