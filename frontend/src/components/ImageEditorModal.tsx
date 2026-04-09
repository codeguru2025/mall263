'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Crop, Sliders, ZoomIn, ZoomOut } from 'lucide-react';

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

async function buildCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  adj: Adjustments,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = imageSrc;
  });

  // Render crop with adjustments onto a canvas
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;

  ctx.filter = [
    `brightness(${adj.brightness}%)`,
    `contrast(${adj.contrast}%)`,
    `saturate(${adj.saturation}%)`,
  ].join(' ');

  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  // Sharpness via a lightweight unsharp-mask pass
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
      if ((i + 1) % 4 === 0) continue; // skip alpha
      orig.data[i] = Math.min(255, Math.max(0,
        orig.data[i] + amount * (orig.data[i] - blurData.data[i]),
      ));
    }
    ctx.putImageData(orig, 0, 0);
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas empty'))),
      'image/webp',
      0.92,
    ),
  );
}

const DEFAULT_ADJ: Adjustments = { brightness: 100, contrast: 100, saturation: 100, sharpness: 0 };

export function ImageEditorModal({ imageSrc, onApply, onCancel }: Props) {
  const [tab, setTab] = useState<'crop' | 'adjust'>('crop');

  // Crop state
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectKey, setAspectKey] = useState<number>(0); // index into ASPECTS
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Adjust state
  const [adj, setAdj] = useState<Adjustments>(DEFAULT_ADJ);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const set = (key: keyof Adjustments) => (val: number) =>
    setAdj((a) => ({ ...a, [key]: val }));

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const blob = await buildCroppedBlob(imageSrc, croppedAreaPixels, adj);
      onApply(blob);
    } catch {
      setApplying(false);
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="font-black text-navy-700">Edit Image</span>
          <button
            onClick={handleApply}
            disabled={applying || !croppedAreaPixels}
            className="flex items-center gap-1.5 bg-brand-green text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {applying
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Check className="w-4 h-4" />}
            Apply
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['crop', 'adjust'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-brand-green text-brand-green'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'crop' ? <Crop className="w-4 h-4" /> : <Sliders className="w-4 h-4" />}
              {t === 'crop' ? 'Crop' : 'Adjust'}
            </button>
          ))}
        </div>

        {/* ── Crop Tab ── */}
        {tab === 'crop' && (
          <div>
            {/* Aspect ratio chips */}
            <div className="flex gap-2 p-3 bg-gray-50 border-b border-gray-100">
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

            {/* Cropper canvas */}
            <div className="relative h-64 bg-gray-900">
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
            <div className="flex items-center gap-3 px-5 py-4 bg-gray-50">
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
          <div>
            {/* Live preview */}
            <div className="h-40 bg-black flex items-center justify-center overflow-hidden">
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
                  {/* Tick marks */}
                  <div className="flex justify-between mt-0.5 px-0.5">
                    <span className="text-[9px] text-gray-300">{min}{key !== 'sharpness' ? '%' : ''}</span>
                    <span className="text-[9px] text-gray-300">{key !== 'sharpness' ? '100%' : '50'}</span>
                    <span className="text-[9px] text-gray-300">{max}{key !== 'sharpness' ? '%' : ''}</span>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setAdj(DEFAULT_ADJ)}
                className="text-xs text-gray-400 hover:text-brand-red font-semibold transition-colors mt-1"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
