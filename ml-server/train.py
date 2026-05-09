"""
Trace ML — Training Script

Fine-tunes a MobileNetV3 model on the combined Bug Bite Images +
Lyme EM Rashes datasets. Runs on your GPU.

Datasets to download (place inside the data/ folder):
  - https://www.kaggle.com/datasets/moonfallidk/bug-bite-images
  - https://www.kaggle.com/datasets/sshikamaru/lyme-disease-full-dataset

Expected folder structure:

  ml-server/
    data/
      ant/         <- from Bug Bite Images
      bed_bug/
      chigger/
      flea/
      mosquito/
      spider/
      tick/
      no_bite/     <- "uninfected skin" class
      erythema_migrans/  <- merge Lyme EM dataset here

Usage:
    python train.py --epochs 15 --batch-size 32

Outputs:
    model.pt        — the trained model (loaded by server.py)
    classes.txt     — list of class names in order
"""

import argparse
import os
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, models, transforms


def build_model(num_classes: int) -> nn.Module:
    """MobileNetV3-Large with a fresh classifier head for our classes."""
    model = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.DEFAULT)
    # Replace the final classifier layer
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    return model


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', default='data', help='Folder with class subfolders')
    parser.add_argument('--epochs', type=int, default=15)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--lr', type=float, default=1e-4)
    parser.add_argument('--output', default='model.pt')
    args = parser.parse_args()

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Training on: {device}')
    if device.type == 'cuda':
        print(f'GPU: {torch.cuda.get_device_name(0)}')

    # ── Data transforms ──
    train_tf = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])
    val_tf = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    # ── Load dataset ──
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        raise FileNotFoundError(
            f'{data_dir} not found. Download the Kaggle datasets and arrange '
            f'them as described in this script\'s docstring.'
        )

    full_dataset = datasets.ImageFolder(data_dir, transform=train_tf)
    classes = full_dataset.classes
    num_classes = len(classes)
    print(f'Classes ({num_classes}): {classes}')

    # 80/20 train/val split
    train_size = int(0.8 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    train_set, val_set = random_split(full_dataset, [train_size, val_size])
    val_set.dataset.transform = val_tf  # use val transforms for val split

    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False, num_workers=4)

    # ── Model, optimizer, loss ──
    model = build_model(num_classes).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=args.lr)

    best_val_acc = 0.0

    for epoch in range(args.epochs):
        # Train
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * imgs.size(0)
            _, preds = outputs.max(1)
            correct += preds.eq(labels).sum().item()
            total += labels.size(0)
        train_loss = running_loss / total
        train_acc = 100.0 * correct / total

        # Validate
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                outputs = model(imgs)
                _, preds = outputs.max(1)
                val_correct += preds.eq(labels).sum().item()
                val_total += labels.size(0)
        val_acc = 100.0 * val_correct / val_total

        print(f'[Epoch {epoch+1}/{args.epochs}] '
              f'train_loss={train_loss:.4f} train_acc={train_acc:.2f}% '
              f'val_acc={val_acc:.2f}%')

        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({
                'state_dict': model.state_dict(),
                'classes': classes,
                'num_classes': num_classes,
            }, args.output)
            print(f'  -> saved new best model ({val_acc:.2f}%)')

    # Save class list
    with open('classes.txt', 'w') as f:
        for c in classes:
            f.write(f'{c}\n')

    print(f'\nDone! Best val accuracy: {best_val_acc:.2f}%')
    print(f'Model saved to: {args.output}')


if __name__ == '__main__':
    main()
