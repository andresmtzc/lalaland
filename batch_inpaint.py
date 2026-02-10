#!/usr/bin/env python3
"""
Batch inpaint/repair images using a mask.

Usage:
    python3 batch_inpaint.py <input_folder> <mask_file> <output_folder>

Example:
    python3 batch_inpaint.py ./frames/2 ./mask.png ./frames/2_repaired

Requirements:
    pip3 install opencv-python numpy
"""

import cv2
import numpy as np
import os
import sys
import glob

def inpaint_image(image_path, mask, radius=5, method="telea"):
    """Load an image, apply inpainting with the given mask, return result."""
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")

    # Resize mask to match image if dimensions differ
    if mask.shape[:2] != img.shape[:2]:
        resized_mask = cv2.resize(mask, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
    else:
        resized_mask = mask

    # Inpaint using Telea (fast marching) or Navier-Stokes
    if method == "telea":
        result = cv2.inpaint(img, resized_mask, radius, cv2.INPAINT_TELEA)
    else:
        result = cv2.inpaint(img, resized_mask, radius, cv2.INPAINT_NS)

    return result

def main():
    if len(sys.argv) < 4:
        print("Usage: python3 batch_inpaint.py <input_folder> <mask_file> <output_folder>")
        print()
        print("  input_folder  — folder with your source images")
        print("  mask_file     — black/white mask (white = area to repair)")
        print("  output_folder — where to save the JPGs")
        sys.exit(1)

    input_folder = sys.argv[1]
    mask_path = sys.argv[2]
    output_folder = sys.argv[3]

    # Optional: inpaint radius (default 5)
    radius = int(sys.argv[4]) if len(sys.argv) > 4 else 5

    # JPG quality (0-100, default 95)
    jpg_quality = int(sys.argv[5]) if len(sys.argv) > 5 else 95

    # Validate inputs
    if not os.path.isdir(input_folder):
        print(f"Error: Input folder not found: {input_folder}")
        sys.exit(1)

    if not os.path.isfile(mask_path):
        print(f"Error: Mask file not found: {mask_path}")
        sys.exit(1)

    # Create output folder
    os.makedirs(output_folder, exist_ok=True)

    # Load mask as grayscale and threshold to pure black/white
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        print(f"Error: Could not read mask: {mask_path}")
        sys.exit(1)

    # Threshold: anything above 128 becomes white (255), rest black (0)
    _, mask = cv2.threshold(mask, 128, 255, cv2.THRESH_BINARY)

    # Find all image files
    extensions = ("*.png", "*.jpg", "*.jpeg", "*.tiff", "*.tif", "*.bmp", "*.heic")
    image_files = []
    for ext in extensions:
        image_files.extend(glob.glob(os.path.join(input_folder, ext)))
        image_files.extend(glob.glob(os.path.join(input_folder, ext.upper())))
    image_files = sorted(set(image_files))

    if not image_files:
        print(f"No image files found in: {input_folder}")
        sys.exit(1)

    print(f"Found {len(image_files)} images")
    print(f"Mask: {mask_path} ({mask.shape[1]}x{mask.shape[0]})")
    print(f"Output: {output_folder}")
    print(f"Inpaint radius: {radius}")
    print(f"JPG quality: {jpg_quality}")
    print()

    processed = 0
    failed = 0

    for i, image_path in enumerate(image_files, 1):
        filename = os.path.basename(image_path)
        base_name = os.path.splitext(filename)[0]
        output_path = os.path.join(output_folder, base_name + ".jpg")

        try:
            result = inpaint_image(image_path, mask, radius=radius)
            cv2.imwrite(output_path, result, [cv2.IMWRITE_JPEG_QUALITY, jpg_quality])
            processed += 1
            print(f"  [{i}/{len(image_files)}] {filename} -> {base_name}.jpg")
        except Exception as e:
            failed += 1
            print(f"  [{i}/{len(image_files)}] FAILED {filename}: {e}")

    print()
    print(f"Done! {processed} processed, {failed} failed.")

if __name__ == "__main__":
    main()
