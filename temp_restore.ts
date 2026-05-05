function writeFrameIntoWindowTensor(
  windowTensor: Float32Array,
  t: number,
  frameRgb: Float32Array,
  H: number,
  W: number
): void {
  const T = windowTensor.length; 
  const layout = dlState.kind === 'ready' ? dlState.layout : DL_DEFAULT_LAYOUT;
  if (layout === 'NCHW') {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base = (y * W + x) * 3;
        windowTensor[nchwIndex(t, 0, y, x, T, H, W)] = frameRgb[base];
        windowTensor[nchwIndex(t, 1, y, x, T, H, W)] = frameRgb[base + 1];
        windowTensor[nchwIndex(t, 2, y, x, T, H, W)] = frameRgb[base + 2];
      }
    }
    return;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const base = (y * W + x) * 3;
      windowTensor[nhwcIndex(t, 0, y, x, T, H, W)] = frameRgb[base];
      windowTensor[nhwcIndex(t, 1, y, x, T, H, W)] = frameRgb[base + 1];
      windowTensor[nhwcIndex(t, 2, y, x, T, H, W)] = frameRgb[base + 2];
    }
  }
}
