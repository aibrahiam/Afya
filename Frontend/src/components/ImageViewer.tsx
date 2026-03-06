import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { ZoomIn, ZoomOut, Maximize2, RotateCw, Eye, EyeOff, Minimize2, RefreshCw, Hand } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Dialog, DialogContent } from './ui/dialog';
import { BACKEND_BASE_URL } from '../services/api';
import { ImageIcon } from 'lucide-react';

export interface HeatmapRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  label: string;
}

export interface HeatmapData {
  width: number;
  height: number;
  regions: HeatmapRegion[];
}

interface ImageViewerProps {
  caseId: string;
  scanType: string;
  imageUrl?: string;
  heatmapData?: HeatmapData | null;
}



function regionColor(intensity: number) {
  if (intensity >= 0.7) return '#ef4444';
  if (intensity >= 0.4) return '#f97316';
  return '#facc15';
}

interface HeatmapOverlayProps {
  heatmapData?: HeatmapData | null;
  opacity: number;
  /** suffix to keep gradient IDs unique between normal and fullscreen SVGs */
  idSuffix?: string;
}

function HeatmapOverlay({ heatmapData, opacity, idSuffix = '' }: HeatmapOverlayProps) {
  const regions = heatmapData?.regions;

  // Only render when there is real AI-generated heatmap data
  if (!regions || regions.length === 0) return null;

  const vw = heatmapData!.width;
  const vh = heatmapData!.height;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity }}>
      <svg
        className="w-full h-full"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
      >
          <defs>
            {regions.map((r, i) => {
              const c = regionColor(r.intensity);
              return (
                <radialGradient key={i} id={`hg${idSuffix}${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor={c} stopOpacity={Math.min(0.95, r.intensity * 1.1)} />
                  <stop offset="45%"  stopColor={c} stopOpacity={r.intensity * 0.55} />
                  <stop offset="100%" stopColor={c} stopOpacity="0" />
                </radialGradient>
              );
            })}
          </defs>

          {regions.map((r, i) => {
            const cx = r.x + r.width / 2;
            const cy = r.y + r.height / 2;
            const rx = Math.max(r.width / 2, 10);
            const ry = Math.max(r.height / 2, 10);
            const c = regionColor(r.intensity);
            const labelText = `${r.label.slice(0, 18)}: ${Math.round(r.intensity * 100)}%`;
            const labelW = labelText.length * 6.2 + 12;
            const labelY = Math.max(r.y - 6, 14);
            return (
              <g key={i}>
                <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#hg${idSuffix}${i})`}
                  className="animate-pulse"
                  style={{ animationDuration: `${3 + i * 0.4}s`, animationDelay: `${i * 0.3}s` }}
                />
                <rect x={cx - labelW / 2} y={labelY - 13} width={labelW} height={16}
                  rx={3} fill={c} fillOpacity={0.9} />
                <text x={cx} y={labelY} textAnchor="middle" fill="white"
                  fontSize={Math.max(9, Math.min(11, vw / 90))} fontFamily="sans-serif">
                  {labelText}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
  );
}

export function ImageViewer({ caseId, scanType, imageUrl, heatmapData }: ImageViewerProps) {
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.6);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);

  // Determine image source — use real uploaded image if available
  const resolvedImageUrl = imageUrl ? `${BACKEND_BASE_URL}${imageUrl}` : null;

  const hasRealHeatmap = !!(heatmapData?.regions?.length);

  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
  const handleReset = () => { setZoom(100); setPanPosition({ x: 0, y: 0 }); setRotation(0); };
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPanMode || zoom > 100) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) setPanPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const imgTransform = `scale(${zoom / 100}) translate(${panPosition.x / (zoom / 100)}px, ${panPosition.y / (zoom / 100)}px) rotate(${rotation}deg)`;
  const imgTransition = isDragging ? 'none' : 'transform 0.2s ease';

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Toolbar */}
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-slate-700 text-slate-100 border-slate-600">
            {scanType}
          </Badge>
          <span className="text-slate-300 text-sm">Case ID: {caseId}</span>
          {hasRealHeatmap && (
            <Badge variant="outline" className="bg-slate-700 text-slate-300 border-slate-600 text-xs">
              AI Heatmap Active
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            title={isPanMode ? 'Pan mode on (click to disable)' : 'Pan mode (grab & move)'}
            onClick={() => setIsPanMode((p) => !p)}
            className={isPanMode
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'}>
            <Hand className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-slate-600" />
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
            onClick={() => setZoom(Math.max(50, zoom - 25))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-slate-300 text-sm min-w-16 text-center">{zoom}%</span>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
            onClick={() => setZoom(Math.min(300, zoom + 25))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-slate-600 mx-2" />
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
            onClick={handleRotate}>
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
            onClick={toggleFullscreen}>
            <Maximize2 className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-slate-600 mx-2" />
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
            onClick={handleReset} title="Reset View">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Image Display Area */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center p-6 min-h-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: (isPanMode || zoom > 100) ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {resolvedImageUrl ? (
          <div className="relative w-full h-full" style={{ transform: imgTransform, transition: imgTransition }}>
            <ImageWithFallback
              src={resolvedImageUrl}
              alt={scanType}
              className="w-full h-full object-contain rounded block"
            />
            {showHeatmap && (
              <HeatmapOverlay heatmapData={heatmapData} opacity={heatmapOpacity} idSuffix="main" />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <ImageIcon className="w-16 h-16 text-slate-600" />
            <span className="text-sm">No image uploaded</span>
            <span className="text-xs text-slate-600">Upload a DICOM image to begin analysis</span>
          </div>
        )}
      </div>

      {/* XAI Heatmap Controls */}
      <div className="p-4 bg-slate-800 border-t border-slate-700 flex-shrink-0">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-300" />
              <span className="text-slate-200 text-sm">XAI Heatmap Overlay</span>
              {hasRealHeatmap && (
                <span className="text-slate-400 text-xs">
                  ({heatmapData!.regions.length} AI region{heatmapData!.regions.length !== 1 ? 's' : ''})
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={showHeatmap
                ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
                : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'}
            >
              {showHeatmap ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
              {showHeatmap ? 'Hide' : 'Show'}
            </Button>
          </div>

          {showHeatmap && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-xs min-w-16">Opacity:</span>
              <Slider
                value={[heatmapOpacity * 100]}
                onValueChange={(value) => setHeatmapOpacity(value[0] / 100)}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-slate-300 text-xs min-w-12 text-right">
                {Math.round(heatmapOpacity * 100)}%
              </span>
            </div>
          )}

          <div className="flex items-center gap-4 pt-2 border-t border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-slate-400">High Risk (70%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-xs text-slate-400">Medium (40-69%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-xs text-slate-400">Low (&lt;40%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-slate-900 border-slate-700">
          <div className="flex flex-col h-[95vh]">
            <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-slate-700 text-slate-100 border-slate-600">
                  {scanType}
                </Badge>
                <span className="text-slate-300 text-sm">Case ID: {caseId}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  title={isPanMode ? 'Pan mode on (click to disable)' : 'Pan mode (grab & move)'}
                  onClick={() => setIsPanMode((p) => !p)}
                  className={isPanMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'}>
                  <Hand className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-slate-600" />
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={() => setZoom(Math.max(50, zoom - 25))}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-slate-300 text-sm min-w-16 text-center">{zoom}%</span>
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={() => setZoom(Math.min(300, zoom + 25))}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-slate-600 mx-2" />
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={handleRotate}>
                  <RotateCw className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={handleReset}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-slate-600 mx-2" />
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={() => setIsFullscreen(false)}>
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div
              className="flex-1 relative overflow-hidden flex items-center justify-center p-6"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: (isPanMode || zoom > 100) ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {resolvedImageUrl ? (
                <div className="relative w-full h-full" style={{ transform: imgTransform, transition: imgTransition }}>
                  <ImageWithFallback
                    src={resolvedImageUrl}
                    alt={scanType}
                    className="w-full h-full object-contain rounded block"
                  />
                  {showHeatmap && (
                    <HeatmapOverlay heatmapData={heatmapData} opacity={heatmapOpacity} idSuffix="fs" />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <ImageIcon className="w-16 h-16 text-slate-600" />
                  <span className="text-sm">No image uploaded</span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
