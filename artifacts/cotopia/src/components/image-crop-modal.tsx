import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RefreshCw, Check, X, Crop } from "lucide-react";

const CW = 500;
const CH = 400;

interface ImageCropModalProps {
  imageUrl: string;
  aspectRatio?: number;
  circular?: boolean;
  title?: string;
  outputSize?: number;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export function ImageCropModal({
  imageUrl,
  aspectRatio = 1,
  circular = false,
  title,
  outputSize = 800,
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoomPct, setZoomPct] = useState(0);

  const [imgX, setImgX] = useState(0);
  const [imgY, setImgY] = useState(0);

  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchRef = useRef<number | null>(null);

  const cropBox = (() => {
    const maxW = CW * 0.88;
    const maxH = CH * 0.88;
    let w: number, h: number;
    if (aspectRatio >= 1) {
      w = Math.min(maxW, maxH * aspectRatio);
      h = w / aspectRatio;
    } else {
      h = Math.min(maxH, maxW / aspectRatio);
      w = h * aspectRatio;
    }
    return { x: (CW - w) / 2, y: (CH - h) / 2, w, h };
  })();

  const getMinScale = useCallback(() => {
    const img = imgRef.current;
    if (!img) return 1;
    return Math.max(cropBox.w / img.naturalWidth, cropBox.h / img.naturalHeight);
  }, [cropBox.w, cropBox.h]);

  const getScale = useCallback(
    (pct: number) => getMinScale() * (1 + (pct / 100) * 4),
    [getMinScale],
  );

  const clampPos = useCallback(
    (x: number, y: number, sc: number) => {
      const img = imgRef.current;
      if (!img) return { x, y };
      const iw = img.naturalWidth * sc;
      const ih = img.naturalHeight * sc;
      return {
        x: Math.max(cropBox.x + cropBox.w - iw, Math.min(cropBox.x, x)),
        y: Math.max(cropBox.y + cropBox.h - ih, Math.min(cropBox.y, y)),
      };
    },
    [cropBox],
  );

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const sc = Math.max(cropBox.w / img.naturalWidth, cropBox.h / img.naturalHeight);
      const cx = cropBox.x + (cropBox.w - img.naturalWidth * sc) / 2;
      const cy = cropBox.y + (cropBox.h - img.naturalHeight * sc) / 2;
      setImgX(cx);
      setImgY(cy);
      setZoomPct(0);
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl, cropBox.x, cropBox.y, cropBox.w, cropBox.h]);

  useEffect(() => {
    if (!imgLoaded) return;
    const sc = getScale(zoomPct);
    const { x, y } = clampPos(imgX, imgY, sc);
    if (x !== imgX) setImgX(x);
    if (y !== imgY) setImgY(y);
  }, [zoomPct]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sc = getScale(zoomPct);
    const iw = img.naturalWidth * sc;
    const ih = img.naturalHeight * sc;

    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, imgX, imgY, iw, ih);

    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.beginPath();
    ctx.rect(0, 0, CW, CH);
    if (circular) {
      ctx.arc(
        cropBox.x + cropBox.w / 2,
        cropBox.y + cropBox.h / 2,
        cropBox.w / 2,
        0,
        Math.PI * 2,
        true,
      );
    } else {
      ctx.rect(cropBox.x + cropBox.w, cropBox.y, -cropBox.w, cropBox.h);
    }
    ctx.fill("evenodd");

    ctx.save();
    if (circular) {
      ctx.beginPath();
      ctx.arc(
        cropBox.x + cropBox.w / 2,
        cropBox.y + cropBox.h / 2,
        cropBox.w / 2,
        0,
        Math.PI * 2,
      );
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
      ctx.clip();
    }
    ctx.drawImage(img, imgX, imgY, iw, ih);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    if (circular) {
      ctx.beginPath();
      ctx.arc(
        cropBox.x + cropBox.w / 2,
        cropBox.y + cropBox.h / 2,
        cropBox.w / 2,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else {
      ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cropBox.x + (cropBox.w / 3) * i, cropBox.y);
        ctx.lineTo(cropBox.x + (cropBox.w / 3) * i, cropBox.y + cropBox.h);
        ctx.moveTo(cropBox.x, cropBox.y + (cropBox.h / 3) * i);
        ctx.lineTo(cropBox.x + cropBox.w, cropBox.y + (cropBox.h / 3) * i);
        ctx.stroke();
      }
    }
  }, [imgLoaded, imgX, imgY, zoomPct, circular, cropBox, getScale]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    const sc = getScale(zoomPct);
    setImgX((x) => clampPos(x + dx, imgY, sc).x);
    setImgY((y) => clampPos(imgX, y + dy, sc).y);
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -2 : 2;
    setZoomPct((p) => Math.max(0, Math.min(100, p + delta)));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchRef.current = Math.sqrt(dx * dx + dy * dy);
    }
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && lastTouchRef.current) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const sc = getScale(zoomPct);
      setImgX((x) => clampPos(x + dx, imgY, sc).x);
      setImgY((y) => clampPos(imgX, y + dy, sc).y);
    } else if (e.touches.length === 2 && lastPinchRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / lastPinchRef.current;
      lastPinchRef.current = dist;
      setZoomPct((p) => Math.max(0, Math.min(100, p + (ratio - 1) * 60)));
    }
    e.preventDefault();
  };

  const handleReset = () => {
    const img = imgRef.current;
    if (!img) return;
    const sc = getMinScale();
    const cx = cropBox.x + (cropBox.w - img.naturalWidth * sc) / 2;
    const cy = cropBox.y + (cropBox.h - img.naturalHeight * sc) / 2;
    setImgX(cx);
    setImgY(cy);
    setZoomPct(0);
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const sc = getScale(zoomPct);
    const origX = (cropBox.x - imgX) / sc;
    const origY = (cropBox.y - imgY) / sc;
    const origW = cropBox.w / sc;
    const origH = cropBox.h / sc;

    const outW = outputSize;
    const outH = circular ? outputSize : Math.round(outputSize / aspectRatio);
    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    if (circular) {
      ctx.beginPath();
      ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(img, origX, origY, origW, origH, 0, 0, outW, outH);
    out.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.93,
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden w-full max-w-[540px]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">{title ?? "Crop Image"}</span>
          </div>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="bg-zinc-950 flex items-center justify-center overflow-hidden"
          style={{ height: CH }}
        >
          {!imgLoaded ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              className="cursor-move select-none touch-none"
              style={{ maxWidth: "100%", maxHeight: "100%", display: "block" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => {
                lastTouchRef.current = null;
                lastPinchRef.current = null;
              }}
            />
          )}
        </div>

        <div className="px-5 py-4 space-y-3.5 border-t border-border">
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoomPct]}
              onValueChange={(v) => setZoomPct(v[0])}
              min={0}
              max={100}
              step={1}
              className="flex-1"
              disabled={!imgLoaded}
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <button
              onClick={handleReset}
              title="Reset"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Drag to reposition · Scroll or pinch to zoom
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="flex-1 gap-2" onClick={handleConfirm} disabled={!imgLoaded}>
              <Check className="w-4 h-4" />
              Crop &amp; Use
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
