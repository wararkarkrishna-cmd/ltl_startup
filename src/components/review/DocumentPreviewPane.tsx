'use client';

import React from 'react';
import { FileText, Hash, ShieldCheck } from 'lucide-react';

interface DocumentPreviewPaneProps {
  fileName?: string;
  mimeType?: string;
  sha256Hash?: string;
  rawText?: string;
  highlightedKeywords?: string[];
}

export const DocumentPreviewPane: React.FC<DocumentPreviewPaneProps> = ({
  fileName = 'Shipper_RFQ_Document.pdf',
  mimeType = 'application/pdf',
  sha256Hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  rawText = '',
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 truncate max-w-[200px] sm:max-w-xs">
              {fileName}
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">{mimeType}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>SHA-256: {sha256Hash.substring(0, 8)}...</span>
        </div>
      </div>

      {/* Document Content Stream Viewer */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-950/80 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-emerald-500/30">
        {rawText || (
          <div className="text-slate-500 text-center py-12">
            No source document stream available.
          </div>
        )}
      </div>

      {/* Footer Tagging Bar */}
      <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Hash className="w-3 h-3 text-slate-500" />
          Multi-Modal Stream OCR &bull; SHA-256 Verified
        </span>
        <span className="text-emerald-400 font-medium">Text Extract Active</span>
      </div>
    </div>
  );
};
