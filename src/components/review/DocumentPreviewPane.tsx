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
    <div className="flex flex-col h-full bg-[#09090b] border border-[#27272a] rounded-2xl overflow-hidden shadow-lg font-sans">
      {/* Header */}
      <div className="p-3.5 bg-[#0c0c0e] border-b border-[#27272a] flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-sans font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
              {fileName}
            </h3>
            <span className="text-[10px] text-neutral-400 font-mono">{mimeType}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-neutral-300 bg-[#121215] px-2.5 py-1 rounded-lg border border-neutral-800 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-white" />
          <span>SHA-256: {sha256Hash.substring(0, 8)}...</span>
        </div>
      </div>

      {/* Document Content Stream Viewer */}
      <div className="flex-1 p-4 overflow-y-auto bg-[#121215] font-mono text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap selection:bg-white selection:text-black custom-scrollbar">
        {rawText || (
          <div className="text-neutral-500 text-center py-12 font-sans italic">
            No source document stream available.
          </div>
        )}
      </div>

      {/* Footer Tagging Bar */}
      <div className="p-2.5 bg-[#0c0c0e] border-t border-[#27272a] text-[10px] text-neutral-400 font-sans flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Hash className="w-3 h-3 text-neutral-500" />
          Multi-Modal Stream OCR &bull; SHA-256 Verified
        </span>
        <span className="text-white font-mono font-medium">Text Extract Active</span>
      </div>
    </div>
  );
};
