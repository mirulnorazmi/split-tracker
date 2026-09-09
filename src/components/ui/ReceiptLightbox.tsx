import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { getReceiptUrl } from '@/lib/api';

interface ReceiptLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl?: string | null;
  title?: string;
  payerName?: string;
  amount?: number;
}

export function ReceiptLightbox({
  isOpen,
  onClose,
  receiptUrl,
  title = 'Payment Receipt',
  payerName,
  amount,
}: ReceiptLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const resolvedUrl = getReceiptUrl(receiptUrl);
  const [imgSrc, setImgSrc] = useState(resolvedUrl);
  const hasFallbackAttempted = useRef(false);

  // Reset zoom & position whenever opened or URL changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsLoading(true);
      setHasError(false);
      setImgSrc(resolvedUrl);
      hasFallbackAttempted.current = false;
    }
  }, [isOpen, receiptUrl, resolvedUrl]);

  const handleImageError = () => {
    if (!hasFallbackAttempted.current && receiptUrl) {
      hasFallbackAttempted.current = true;
      // If currently using absolute URL, try relative URL (which proxies through Vite or same-origin)
      if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://')) {
        const relative = receiptUrl.startsWith('/') ? receiptUrl : `/${receiptUrl}`;
        if (relative !== imgSrc) {
          setImgSrc(relative);
          return;
        }
      } else {
        // If currently using relative URL, try direct backend port 3001
        const fallbackBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
        const fallbackUrl = `${fallbackBase}${receiptUrl.startsWith('/') ? '' : '/'}${receiptUrl}`;
        if (fallbackUrl !== imgSrc) {
          setImgSrc(fallbackUrl);
          return;
        }
      }
    }
    setIsLoading(false);
    setHasError(true);
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 0.25, 3));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(z - 0.25, 0.5));
      } else if (e.key === '0') {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !receiptUrl) return null;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDownload = async () => {
    const targetUrl = imgSrc || resolvedUrl;
    try {
      const response = await fetch(targetUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = receiptUrl.split('.').pop()?.split('?')[0] || 'jpg';
      a.download = `receipt_${payerName ? payerName.replace(/\s+/g, '_') : 'payment'}_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(targetUrl, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Header Bar */}
      <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
            <ImageIcon className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-medium text-sm sm:text-base truncate">{title}</h3>
            {(payerName || amount !== undefined) && (
              <p className="text-xs text-zinc-400 truncate">
                {payerName && <span>Paid by <strong className="text-zinc-300 font-medium">{payerName}</strong></span>}
                {payerName && amount !== undefined && <span> • </span>}
                {amount !== undefined && <span className="text-accent font-semibold">RM {amount.toFixed(2)}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5 mr-2">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              title="Zoom Out (-)"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono text-zinc-400 px-2 min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              title="Zoom In (+)"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoom !== 1 && (
              <button
                onClick={handleResetZoom}
                title="Reset Zoom (0)"
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors border-l border-zinc-800 ml-0.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleDownload}
            title="Download receipt image"
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>

          <a
            href={imgSrc || resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open original in new tab"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="relative flex-1 w-full flex items-center justify-center p-4 sm:p-8 overflow-hidden select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-accent animate-spin" />
            <span className="text-xs">Loading receipt...</span>
          </div>
        )}

        {hasError ? (
          <div className="p-8 text-center max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400">
            <ImageIcon className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-medium text-white mb-1">Receipt Image Unavailable</p>
            <p className="text-xs text-zinc-500 mb-4">Could not load the image from storage.</p>
            <a
              href={imgSrc || resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              Try opening raw link
            </a>
          </div>
        ) : (
          <img
            src={imgSrc || resolvedUrl}
            alt={title}
            draggable={false}
            onLoad={() => setIsLoading(false)}
            onError={handleImageError}
            className="max-h-[82vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-100 ease-out pointer-events-auto"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            }}
          />
        )}
      </div>

      {/* Bottom Hint / Bar */}
      <div className="w-full py-2.5 px-4 text-center border-t border-zinc-800/50 bg-zinc-950/40 text-[11px] text-zinc-500 flex items-center justify-center gap-4">
        <span>Click outside or press <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[10px]">Esc</kbd> to close</span>
        {zoom > 1 && <span className="hidden sm:inline">• Click and drag to pan</span>}
      </div>
    </div>
  );
}
