"""Quick smoke test of the inference server across all classes."""
import base64
import os
import random

import requests

random.seed(42)
classes = ['ants', 'bed_bugs', 'chiggers', 'fleas', 'mosquitos',
           'no_bites', 'spiders', 'ticks']
correct = 0
total = 0
for cls in classes:
    cls_dir = f'data/{cls}'
    samples = random.sample(os.listdir(cls_dir), 3)
    for s in samples:
        with open(os.path.join(cls_dir, s), 'rb') as f:
            b64 = base64.b64encode(f.read()).decode()
        r = requests.post(
            'http://localhost:8000/classify',
            json={'image': b64}, timeout=10,
        )
        data = r.json()
        pred = data['label']
        conf = data['confidence']
        ok = '[ok]' if pred == cls else '[XX]'
        print(f'{ok} actual={cls:12s} pred={pred:12s} ({conf*100:.1f}%)')
        if pred == cls:
            correct += 1
        total += 1
print(f'\nTOTAL: {correct}/{total} = {100*correct/total:.1f}%')
