import { SIGNATURE_MIN_COVERAGE_THRESHOLD } from '@documenso/lib/constants/signatures';
import type { RefObject } from 'react';

/**
 * Checks whether the signature covers enough of the canvas to be considered
 * valid, by measuring the percentage of non-transparent pixels against
 * SIGNATURE_MIN_COVERAGE_THRESHOLD.
 */
export const checkSignatureValidity = (element: RefObject<HTMLCanvasElement | null>) => {
  if (!element.current) {
    return false;
  }

  const ctx = element.current.getContext('2d');

  if (!ctx) {
    return false;
  }

  const imageData = ctx.getImageData(0, 0, element.current.width, element.current.height);
  const data = imageData.data;
  let filledPixels = 0;
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      filledPixels++;
    }
  }

  const filledPercentage = filledPixels / totalPixels;
  const isValid = filledPercentage > SIGNATURE_MIN_COVERAGE_THRESHOLD;

  return isValid;
};

/**
 * Export the canvas as a PNG cropped to the signature, so empty space around it doesn't
 * make the signature look small once it is placed in a field.
 */
export const toTrimmedDataURL = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');

  if (!ctx || canvas.width === 0 || canvas.height === 0) {
    return canvas.toDataURL();
  }

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }

  if (right < 0) {
    return canvas.toDataURL();
  }

  const padding = Math.round(Math.max(right - left, bottom - top) * 0.02);

  const cropX = Math.max(0, left - padding);
  const cropY = Math.max(0, top - padding);
  const cropWidth = Math.min(width, right + padding + 1) - cropX;
  const cropHeight = Math.min(height, bottom + padding + 1) - cropY;

  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = cropWidth;
  trimmedCanvas.height = cropHeight;

  trimmedCanvas.getContext('2d')?.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  return trimmedCanvas.toDataURL();
};

export const average = (a: number, b: number) => (a + b) / 2;

export const getSvgPathFromStroke = (points: number[][], closed = true) => {
  const len = points.length;

  if (len < 4) {
    return ``;
  }

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(
    2,
  )} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
  }

  if (closed) {
    result += 'Z';
  }

  return result;
};
