'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Crop, Sliders, ZoomIn, ZoomOut, Eraser, RotateCcw } from 'lucide-react';

interface Point { x: number; y: number }
interface Area { x: number; y: number; width: number; height: number }

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
}

interface Props {
  imageSrc: string;
  onApply: (blob: Blob) => void;
  onCancel: () => void;
}

const ASPECTS = [
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: 'Free', value: null },
] as const;

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
}

async function buildCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  adj: Adjustments,
): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;

  ctx.filter = [
    `brightness(${adj.brightness}%)`,
    `contrast(${adj.contrast}%)`,
    `saturate(${adj.saturation}%)`,
  ].join(' ');

  ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);

  if (adj.sharpness > 0) {
    const amount = adj.sharpness / 100;
    const blurred = document.createElement('canvas');
    blurred.width = canvas.width;
    blurred.height = canvas.height;
    const bCtx = blurred.getContext('2d')!;
    bCtx.filter = 'blur(1px)';
    bCtx.drawImage(canvas, 0, 0);
    const orig = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const blurData = bCtx.getImageData(0, 0, blurred.width, blurred.height);
    for (let i = 0; i < orig.data.length; i++) {
      if ((i + 1) % 4 === 0) continue;
      orig.data[i] = Math.min(255, Math.max(0, orig.data[i] + amount * (orig.data[i] - blurData.data[i])));
    }
    ctx.putImageData(orig, 0, 0);
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas empty'))), 'image/webp', 0.85),
  );
}

async function removeBackground(imageSrc: string, tolerance: number): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  // Sample corners to determine background color
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  const bgR = corners.reduce((s, i) => s + data[i], 0) / 4;
  const bgG = corners.reduce((s, i) => s + data[i + 1], 0) / 4;
  const bgB = corners.reduce((s, i) => s + data[i + 2], 0) / 4;

  const inRange = (pidx: number) => {
    const r = data[pidx * 4] - bgR;
    const g = data[pidx * 4 + 1] - bgG;
    const b = data[pidx * 4 + 2] - bgB;
    return Math.sqrt(r * r + g * g + b * b) <= tolerance;
  };

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];

  const tryAdd = (idx: number) => {
    if (idx < 0 || idx >= w * h || visited[idx]) return;
    if (inRange(idx)) { visited[idx] = 1; stack.push(idx); }
  };

  // Seed from all edges
  for (let x = 0; x < w; x++) { tryAdd(x); tryAdd((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { tryAdd(y * w); tryAdd(y * w + w - 1); }

  while (stack.length > 0) {
    const idx = stack.pop()!;
    data[idx * 4 + 3] = 0; // transparent
    const x = idx % w, y = Math.floor(idx / w);
    if (x > 0) tryAdd(idx - 1);
    if (x < w - 1) tryAdd(idx + 1);
    if (y > 0) tryAdd(idx - w);
    if (y < h - 1) tryAdd(idx + w);
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas empty'))), 'image/webp', 0.85),
  );
}

const DEFAULT_ADJ: Adjustments = { brightness: 100, contrast: 100, saturation: 100, sharpness: 0 };

export function ImageEditorModal({ imageSrc, onApply, onCancel }: Props) {
  const [tab, setTab] = useState<'crop' | 'adjust' | 'bg'>('crop');

  // Crop state
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectKey, setAspectKey] = useState<number>(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Adjust state
  const [adj, setAdj] = useState<Adjustments>(DEFAULT_ADJ);

  // Background removal state
  const [bgTolerance, setBgTolerance] = useState(30);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);

  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const set = (key: keyof Adjustments) => (val: number) =>
    setAdj((a) => ({ ...a, [key]: val }));

  const handleApply = async () => {
    setApplying(true);
    try {
      let blob: Blob;
      if (tab === 'bg' && bgPreview) {
        // Apply the already-processed bg-removed preview
        const res = await fetch(bgPreview);
        blob = await res.blob();
      } else if (tab === 'bg') {
        // No preview yet — run removal then apply
        blob = await removeBackground(imageSrc, bgTolerance);
      } else {
        if (!croppedAreaPixels) { setApplying(false); return; }
        blob = await buildCroppedBlob(imageSrc, croppedAreaPixels, adj);
      }
      onApply(blob);
    } catch {
      setApplying(false);
    }
  };

  const handlePreviewBgRemoval = async () => {
    setBgProcessing(true);
    setBgPreview(null);
    try {
      const blob = await removeBackground(imageSrc, bgTolerance);
      setBgPreview(URL.createObjectURL(blob));
    } finally {
      setBgProcessing(false);
    }
  };

  const previewFilter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`;
  const currentAspect = ASPECTS[aspectKey].value ?? undefined;

  const sliders = [
    { key: 'brightness' as const, label: 'Brightness', min: 50, max: 150, value: adj.brightness },
    { key: 'contrast'   as const, label: 'Contrast',   min: 50, max: 150, value: adj.contrast },
    { key: 'saturation' as const, label: 'Saturation', min: 0,  max: 200, value: adj.saturation },
    { key: 'sharpness'  as const, label: 'Sharpness',  min: 0,  max: 100, value: adj.sharpness },
  ];

  const TABS = [
    { key: 'crop' as const,   label: 'Crop',       icon: Crop },
    { key: 'adjust' as const, label: 'Adjust',     icon: Sliders },
    { key: 'bg' as const,     label: 'Remove BG',  icon: Eraser },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh"
    >
      {/* Header — pt-safe-top keeps Apply / close clear of the device status bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0 pt-safe-top">
        <button
          onClick={onCancel}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="font-black text-navy-700 text-base">Edit Image</span>
        <button
          onClick={handleApply}
          disabled={applying || (tab !== 'bg' && !croppedAreaPixels)}
          className="flex items-center gap-1.5 bg-brand-green text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors"
        >
          {applying
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Check className="w-4 h-4" />}
          Apply
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 flex-shrink-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold border-b-2 transition-colors ${
              tab === key
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Crop Tab ── */}
      {tab === 'crop' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Aspect ratio chips */}
          <div className="flex gap-2 p-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            {ASPECTS.map((a, i) => (
              <button
                key={a.label}
                onClick={() => setAspectKey(i)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  aspectKey === i
                    ? 'bg-navy-700 text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-400'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Cropper canvas — fills remaining space */}
          <div className="relative flex-1 bg-gray-900">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={currentAspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{ containerStyle: { borderRadius: 0 } }}
            />
          </div>

          {/* Zoom control */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 flex-shrink-0">
            <ZoomOut className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#16a34a]"
            />
            <ZoomIn className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>
        </div>
      )}

      {/* ── Adjust Tab ── */}
      {tab === 'adjust' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {/* Live preview */}
          <div className="flex-shrink-0 h-56 bg-black flex items-center justify-center overflow-hidden">
            <img
              src={imageSrc}
              alt="Preview"
              className="max-h-full max-w-full object-contain"
              style={{ filter: previewFilter }}
            />
          </div>

          <div className="p-5 space-y-4">
            {sliders.map(({ key, label, min, max, value }) => (
              <div key={key}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-gray-600">{label}</span>
                  <span className="text-xs font-black text-navy-700 tabular-nums w-10 text-right">
                    {key === 'sharpness' ? value : `${value}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(e) => set(key)(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full accent-[#16a34a] cursor-pointer"
                />
                <div className="flex justify-between mt-0.5 px-0.5">
                  <span className="text-[9px] text-gray-300">{min}{key !== 'sharpness' ? '%' : ''}</span>
                  <span className="text-[9px] text-gray-300">{key !== 'sharpness' ? '100%' : '50'}</span>
                  <span className="text-[9px] text-gray-300">{max}{key !== 'sharpness' ? '%' : ''}</span>
                </div>
              </div>
            ))}

            <button
              onClick={() => setAdj(DEFAULT_ADJ)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-red font-semibold transition-colors mt-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to defaults
            </button>
          </div>
        </div>
      )}

      {/* ── Remove BG Tab ── */}
      {tab === 'bg' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {/* Preview area */}
          <div className="flex-shrink-0 flex-1 min-h-0 bg-checkerboard flex items-center justify-center overflow-hidden" style={{ minHeight: '240px' }}>
            {bgProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-brand-green border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500 font-medium">Removing background...</span>
              </div>
            ) : bgPreview ? (
              <img src={bgPreview} alt="BG removed" className="max-h-full max-w-full object-contain" />
            ) : (
              <img src={imageSrc} alt="Original" className="max-h-full max-w-full object-contain opacity-60" />
            )}
          </div>

          <div className="p-5 space-y-4 flex-shrink-0">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-gray-600">Tolerance</span>
                <span className="text-xs font-black text-navy-700 tabular-nums">{bgTolerance}</span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                value={bgTolerance}
                onChange={(e) => { setBgTolerance(Number(e.target.value)); setBgPreview(null); }}
                className="w-full h-1.5 rounded-full accent-[#16a34a] cursor-pointer"
              />
              <div className="flex justify-between mt-0.5 px-0.5">
                <span className="text-[9px] text-gray-300">Low</span>
                <span className="text-[9px] text-gray-300">Medium</span>
                <span className="text-[9px] text-gray-300">High</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Works best on images with a solid or white background. Adjust tolerance if too much or too little is removed.
            </p>

            <button
              onClick={handlePreviewBgRemoval}
              disabled={bgProcessing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-brand-green text-brand-green text-sm font-bold hover:bg-green-50 disabled:opacity-50 transition-colors"
            >
              <Eraser className="w-4 h-4" />
              {bgPreview ? 'Re-run Removal' : 'Remove Background'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
