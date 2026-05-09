"""
Trace ML — Data Prep

Downloads the eceunal/bug-bite-images-aug_v3 dataset from Hugging Face
(public, no login required) and saves it as a regular ImageFolder
directory structure for train.py.

8 classes, ~8,276 images:
  ants, bed_bugs, chiggers, fleas, mosquitos, no_bites, spiders, ticks

Run once:
    python prep_data.py
"""

import io
import os
from pathlib import Path

from datasets import load_dataset
from PIL import Image
from tqdm import tqdm


def main():
    out_dir = Path('data')
    out_dir.mkdir(exist_ok=True)

    print('Downloading eceunal/bug-bite-images-aug_v3 from Hugging Face...')
    ds = load_dataset('eceunal/bug-bite-images-aug_v3')

    # Get class names from the dataset features
    label_names = ds['train'].features['label'].names
    print(f'Classes ({len(label_names)}): {label_names}')

    # Create class subdirs
    for name in label_names:
        (out_dir / name).mkdir(exist_ok=True)

    # Save train + validation splits into the same ImageFolder
    # (train.py does its own train/val split)
    total = 0
    for split_name in ['train', 'validation']:
        split = ds[split_name]
        print(f'\nSaving {split_name} split ({len(split)} images)...')

        for i, row in enumerate(tqdm(split, desc=split_name)):
            label_idx = row['label']
            class_name = label_names[label_idx]

            img = row['image']
            if isinstance(img, dict) and 'bytes' in img:
                img = Image.open(io.BytesIO(img['bytes']))

            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')

            filename = f'{split_name}_{i:05d}.jpg'
            img.save(out_dir / class_name / filename, 'JPEG', quality=90)
            total += 1

    print(f'\n✓ Saved {total} images to {out_dir.resolve()}')
    print('\nClass counts:')
    for name in label_names:
        count = len(list((out_dir / name).iterdir()))
        print(f'  {name}: {count}')

    print('\nReady to train! Run: python train.py')


if __name__ == '__main__':
    main()
