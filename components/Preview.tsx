import React, { useLayoutEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ManualPage, ManualMetadata, PageDimensions, StepLayout } from '../types';

interface PreviewProps {
  pages: ManualPage[];
  originalPages?: ManualPage[];
  metadata: ManualMetadata;
  dimensions: PageDimensions;
  previewRef: React.RefObject<HTMLDivElement>;
  onPageOverflow: (pageIndex: number) => void;
  isContinuous?: boolean;
  isExporting?: boolean;
  isPdfPreview?: boolean;
}

const PageContainer: React.FC<{
  page: ManualPage;
  pageIndex: number;
  allPages: ManualPage[];
  tocSourcePages: ManualPage[];
  totalPages: number;
  metadata: ManualMetadata;
  dimensions: PageDimensions;
  onOverflow: (index: number) => void;
  isContinuous?: boolean;
  isExporting?: boolean;
  isPdfPreview?: boolean;
}> = ({ page, pageIndex, allPages, tocSourcePages, totalPages, metadata, dimensions, onOverflow, isContinuous, isExporting, isPdfPreview }) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const effectiveContinuous = isContinuous && !isExporting && !isPdfPreview;

  useLayoutEffect(() => {
    if (!effectiveContinuous && page.type === 'content' && contentRef.current) {
      const containerHeight = contentRef.current.clientHeight;
      const contentHeight = contentRef.current.scrollHeight;
      if (contentHeight > containerHeight + 1 && page.steps.length > 1) {
        const timer = setTimeout(() => { onOverflow(pageIndex); }, isExporting ? 50 : 500);
        return () => clearTimeout(timer);
      }
    }
  }, [page.steps, pageIndex, onOverflow, page.type, effectiveContinuous]);

  const currentDate = new Date().toLocaleDateString();
  const isFirstPage = pageIndex === 0;

  const scale = dimensions.width / 210;
  const virtualWidth = 210;
  const virtualHeight = effectiveContinuous ? 'auto' : dimensions.height / scale;

  const renderCover = () => {
    const style = page.layoutStyle || 'style-1';
    
    // Default Background Image Logic
    const bgImage = page.backgroundImage ? (
         <img 
            src={page.backgroundImage.url} 
            alt="封面" 
            className="object-cover" 
            style={{ 
                width: `${page.backgroundImage.width || 100}%`, 
                height: `${page.backgroundImage.height || 100}%`,
                margin: 'auto'
            }}
            crossOrigin="anonymous" 
         />
    ) : null;

    if (style === 'style-pdf') {
        return (
            <div className="h-full relative flex flex-col items-center bg-white p-12" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                <div className="w-full flex justify-center mb-24">
                    <div className="text-sm font-black tracking-widest uppercase text-zinc-900">{metadata.author || "FAVOTO"}</div>
                </div>
                
                <div className="flex-grow flex flex-col items-center justify-center w-full">
                    <h1 className="text-5xl font-black text-zinc-900 mb-12 uppercase tracking-tight text-center">{metadata.title}</h1>
                    
                    <div className="w-full max-w-md aspect-square relative mb-12">
                        {bgImage || <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-300"><i className="fas fa-image text-6xl"></i></div>}
                    </div>
                    
                    <div className="text-center">
                        <h2 className="text-2xl font-medium text-zinc-600 mb-4">{metadata.subtitle || "用户手册 / 指导指南"}</h2>
                        <div className="text-zinc-400 text-sm">
                            {metadata.version ? `版本 ${metadata.version}` : '版本 1.0'} 
                            <span className="mx-2">|</span> 
                            {currentDate}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (style === 'style-ai-generated' && page.coverDesign) {
        const { primaryColor, secondaryColor, textColor, layoutMode, fontStyle, overlayOpacity = 0.5 } = page.coverDesign;
        
        const fontFamilyClass = 
            fontStyle === 'serif' ? 'font-serif' : 
            fontStyle === 'mono' ? 'font-mono' : 'font-sans';

        const containerStyle = { backgroundColor: primaryColor, color: textColor, minHeight: effectiveContinuous ? '297mm' : '100%' };

        const renderContent = () => (
             <div className="relative z-20 h-full flex flex-col p-12">
                <div className="flex-grow flex flex-col justify-center">
                    <div className="text-sm font-bold tracking-[0.2em] uppercase opacity-80 mb-4">{metadata.version ? `v${metadata.version}` : '手册'}</div>
                    <h1 className="text-6xl font-bold leading-tight mb-6" style={{ color: textColor }}>{metadata.title || "用户手册"}</h1>
                    <h2 className="text-2xl opacity-90 font-light max-w-lg" style={{ color: textColor }}>{metadata.subtitle || "指导指南"}</h2>
                </div>
                <div className="border-t pt-6 opacity-80" style={{ borderColor: textColor }}>
                     <p className="font-bold">{metadata.author}</p>
                     <p className="text-xs mt-1">{currentDate}</p>
                </div>
             </div>
        );

        switch (layoutMode) {
            case 'centered':
                return (
                    <div className={`h-full relative flex flex-col items-center justify-center text-center p-16 ${fontFamilyClass}`} style={containerStyle}>
                         {bgImage && <div className="absolute inset-0 z-0 opacity-20"><img src={page.backgroundImage!.url} className="w-full h-full object-cover" crossOrigin="anonymous"/></div>}
                         <div className="relative z-10 border-4 p-12" style={{ borderColor: secondaryColor }}>
                             <h1 className="text-5xl font-black mb-6">{metadata.title}</h1>
                             <h2 className="text-xl opacity-80">{metadata.subtitle}</h2>
                             <div className="w-12 h-1 bg-current mx-auto my-8"></div>
                             <p className="text-sm font-bold tracking-widest uppercase">{metadata.author}</p>
                         </div>
                    </div>
                );
            case 'split':
                 return (
                     <div className={`h-full flex flex-col ${fontFamilyClass}`} style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                         <div className="h-1/2 relative bg-zinc-200 min-h-[148mm]">
                              {bgImage || <div className="w-full h-full flex items-center justify-center text-zinc-400" style={{ backgroundColor: secondaryColor }}><i className="fas fa-image text-4xl"></i></div>}
                         </div>
                         <div className="h-1/2 p-16 flex flex-col justify-center min-h-[148mm]" style={containerStyle}>
                              <h1 className="text-5xl font-bold mb-4">{metadata.title}</h1>
                              <p className="text-xl opacity-80 mb-8">{metadata.subtitle}</p>
                              <div className="mt-auto text-sm opacity-60 font-mono">{metadata.author} • {currentDate}</div>
                         </div>
                     </div>
                 );
            case 'overlay':
                return (
                    <div className={`h-full relative ${fontFamilyClass}`} style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                        <div className="absolute inset-0 z-0">
                            {bgImage || <div className="w-full h-full bg-zinc-800"></div>}
                        </div>
                        <div className="absolute inset-0 z-10" style={{ backgroundColor: primaryColor, opacity: overlayOpacity }}></div>
                        {renderContent()}
                    </div>
                );
            case 'card':
                return (
                     <div className={`h-full relative p-12 flex items-center justify-center ${fontFamilyClass}`} style={{ backgroundColor: secondaryColor, minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                         {bgImage && <div className="absolute inset-0 z-0 opacity-50"><img src={page.backgroundImage!.url} className="w-full h-full object-cover" crossOrigin="anonymous"/></div>}
                         <div className="relative z-10 bg-white p-16 shadow-2xl rounded-sm max-w-xl w-full" style={{ backgroundColor: primaryColor, color: textColor }}>
                             <div className="w-full h-2 mb-8" style={{ backgroundColor: secondaryColor }}></div>
                             <h1 className="text-4xl font-bold mb-4">{metadata.title}</h1>
                             <h2 className="text-lg opacity-70 mb-8">{metadata.subtitle}</h2>
                             <p className="text-xs font-bold uppercase tracking-widest">{metadata.author}</p>
                         </div>
                     </div>
                );
            case 'minimal':
            default:
                return (
                    <div className={`h-full relative p-16 flex flex-col justify-between ${fontFamilyClass}`} style={containerStyle}>
                         <div className="w-20 h-20 rounded-full mb-8" style={{ backgroundColor: secondaryColor }}></div>
                         <div>
                             <h1 className="text-7xl font-light tracking-tighter mb-4">{metadata.title}</h1>
                             <p className="text-xl font-medium">{metadata.subtitle}</p>
                         </div>
                         <div className="text-xs font-mono opacity-50 text-right">
                             ID: {new Date().getTime().toString().slice(-6)}
                         </div>
                    </div>
                );
        }
    }

    switch(style) {
        case 'style-2': // Modern Split (Horizontal)
            return (
                <div className="h-full flex flex-col" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                    <div className="h-[55%] relative bg-zinc-100 overflow-hidden min-h-[160mm]">
                        {bgImage || <div className="w-full h-full flex items-center justify-center text-zinc-300"><i className="fas fa-image text-4xl"></i></div>}
                    </div>
                    <div className="h-[45%] bg-white p-16 flex flex-col justify-center min-h-[130mm]">
                         <div className="text-sm font-bold tracking-widest uppercase text-brand-600 mb-2">{metadata.version ? `v${metadata.version}` : '手册'}</div>
                         <h1 className="text-5xl font-bold text-zinc-900 leading-tight mb-4">{metadata.title || "用户手册"}</h1>
                         <h2 className="text-xl text-zinc-500 font-medium mb-8">{metadata.subtitle || "指导指南"}</h2>
                         <div className="mt-auto pt-6 border-t border-zinc-100 flex justify-between items-end">
                            <div>
                                <p className="font-bold text-zinc-800">{metadata.author}</p>
                                <p className="text-xs text-zinc-400 mt-1">{currentDate}</p>
                            </div>
                            <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center text-white"><i className="fas fa-arrow-right"></i></div>
                         </div>
                    </div>
                </div>
            );
        case 'style-3': // Bold Left Vertical
             return (
                <div className="h-full flex" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                    <div className="w-[40%] bg-zinc-900 text-white p-12 flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-white/5 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] opacity-20"></div>
                        <div className="relative z-10">
                            <div className="w-16 h-1 bg-brand-500 mb-8"></div>
                            <h1 className="text-4xl font-bold leading-tight mb-6">{metadata.title || "用户手册"}</h1>
                            <p className="text-zinc-400 text-lg mb-12">{metadata.subtitle}</p>
                            <div className="text-sm font-mono text-zinc-500">
                                <p>{metadata.author}</p>
                                <p>版本 {metadata.version}</p>
                            </div>
                        </div>
                    </div>
                    <div className="w-[60%] relative bg-zinc-100">
                        {bgImage || <div className="w-full h-full flex items-center justify-center text-zinc-300"><i className="fas fa-image text-6xl"></i></div>}
                    </div>
                </div>
             );
        case 'style-4': // Technical Frame
             return (
                 <div className="h-full p-8 bg-white" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                     <div className="h-full border-4 border-zinc-900 p-8 flex flex-col relative">
                         <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-6 mb-8">
                             <div className="text-2xl font-bold uppercase tracking-tighter">手册 // <span className="text-zinc-400">{metadata.version}</span></div>
                             <div className="text-right font-mono text-xs">
                                 <p>参考: {new Date().getFullYear()}-DOC</p>
                                 <p>{currentDate}</p>
                             </div>
                         </div>
                         <div className="flex-grow relative bg-zinc-50 mb-8 border border-zinc-200 min-h-[150mm]">
                             {bgImage && <div className="absolute inset-0">{bgImage}</div>}
                         </div>
                         <div>
                             <h1 className="text-6xl font-black text-zinc-900 mb-2 uppercase">{metadata.title || "手册"}</h1>
                             <h2 className="text-xl font-mono text-zinc-600 bg-zinc-100 inline-block px-2 py-1">{metadata.subtitle}</h2>
                         </div>
                         <div className="absolute bottom-0 right-0 p-2 bg-zinc-900 text-white font-mono text-xs">{metadata.author}</div>
                     </div>
                 </div>
             );
        case 'style-5': // Magazine Overlay
              return (
                <div className="h-full relative" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                    <div className="absolute inset-0 z-0">
                         {bgImage || <div className="w-full h-full bg-zinc-200"></div>}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 z-10"></div>
                    <div className="relative z-20 h-full flex flex-col justify-between p-12">
                        <div className="text-center border-b border-white/30 pb-6">
                            <span className="text-white/80 tracking-[0.5em] text-sm uppercase">{metadata.author} 呈献</span>
                        </div>
                        <div className="text-center">
                            <h1 className="text-7xl font-serif italic text-white mb-4 drop-shadow-lg">{metadata.title || "手册"}</h1>
                            <p className="text-white/90 text-xl font-light tracking-wide">{metadata.subtitle}</p>
                        </div>
                        <div className="flex justify-between items-end text-white/70 text-xs font-bold uppercase tracking-widest border-t border-white/30 pt-6">
                            <span>版本 {metadata.version}</span>
                            <span>{new Date().getFullYear()} 版</span>
                        </div>
                    </div>
                </div>
              );
        case 'style-1': // Classic (Default)
        default:
            return (
                <div className="h-full relative flex flex-col" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                    {page.backgroundImage && (
                        <div className="absolute inset-0 z-0 flex items-center justify-center">
                            <img 
                                src={page.backgroundImage.url} 
                                alt="Cover" 
                                className="object-cover" 
                                style={{ 
                                    width: `${page.backgroundImage.width || 100}%`, 
                                    height: `${page.backgroundImage.height || 100}%`
                                }}
                                crossOrigin="anonymous" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/50 to-transparent h-1/2"></div>
                        </div>
                    )}
                    <div className="relative z-10 p-16 flex flex-col h-full items-center text-center pt-32">
                        <div className="mb-4 inline-block px-4 py-1.5 bg-zinc-900 text-white rounded text-sm font-bold tracking-widest uppercase">{metadata.version ? `版本 ${metadata.version}` : '手册'}</div>
                        <h1 className="text-6xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-6 drop-shadow-sm">{metadata.title || "用户手册"}</h1>
                        <h2 className="text-2xl text-zinc-600 font-light max-w-lg leading-relaxed">{metadata.subtitle || "指导指南"}</h2>
                        <div className="mt-auto pb-12 w-full border-t border-zinc-900/10 pt-8">
                            <p className="font-bold text-zinc-800">{metadata.author}</p>
                            <p className="text-sm text-zinc-500 mt-1">{currentDate}</p>
                        </div>
                    </div>
                </div>
            );
    }
  };

  const renderBackCover = () => {
     const style = page.layoutStyle || 'style-1';
     const bgImage = page.backgroundImage ? <img src={page.backgroundImage.url} alt="Back" className="w-full h-full object-cover" crossOrigin="anonymous" /> : null;
     const customText = page.customText || "感谢您选择我们的产品。\n\n如需支持，请访问我们的网站或联系我们的客户服务团队。";

     switch(style) {
         case 'style-pdf':
             return (
                 <div className="h-full flex flex-col items-center justify-center p-20 text-center" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                     <div className="text-4xl font-black text-zinc-900 mb-8 uppercase tracking-widest">{metadata.author || "FAVOTO"}</div>
                     <div className="w-24 h-1 bg-red-600 mb-8"></div>
                     <div className="text-zinc-600 whitespace-pre-wrap leading-relaxed max-w-md mx-auto">{customText}</div>
                     <div className="mt-20 text-xs text-zinc-400 font-bold uppercase tracking-widest">
                         版本 {metadata.version || "1.0"} | {new Date().getFullYear()}
                     </div>
                 </div>
             );
         case 'style-2': // Centered
             return (
                 <div className="h-full relative flex flex-col justify-center items-center text-center p-20" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                     {page.backgroundImage && <div className="absolute inset-0 z-0 opacity-20">{bgImage}</div>}
                     <div className="relative z-10">
                         <div className="w-20 h-20 bg-zinc-900 text-white rounded-full flex items-center justify-center text-3xl mb-8 mx-auto"><i className="fas fa-check"></i></div>
                         <h3 className="text-3xl font-bold text-zinc-900 mb-6">谢谢</h3>
                         <div className="text-zinc-600 whitespace-pre-wrap leading-relaxed max-w-md mx-auto mb-12">{customText}</div>
                         <div className="text-sm font-bold text-brand-600">{metadata.author}</div>
                     </div>
                 </div>
             );
         case 'style-3': // Dark Mode
             return (
                 <div className="h-full bg-zinc-900 text-white p-16 flex flex-col justify-between relative overflow-hidden" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                     {page.backgroundImage && <div className="absolute inset-0 z-0 opacity-30 mix-blend-overlay">{bgImage}</div>}
                     <div className="relative z-10 border-l-4 border-brand-500 pl-6">
                         <h2 className="text-4xl font-bold mb-2">{metadata.title}</h2>
                         <p className="text-zinc-400">用户手册结束</p>
                     </div>
                     <div className="relative z-10">
                         <h4 className="text-zinc-500 uppercase tracking-widest text-sm mb-4">支持</h4>
                         <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed">{customText}</div>
                     </div>
                 </div>
             );
         case 'style-4': // Split
              return (
                  <div className="h-full flex" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                      <div className="w-1/2 bg-zinc-100 relative">
                          {bgImage || <div className="w-full h-full flex items-center justify-center text-zinc-300"><i className="fas fa-image text-5xl"></i></div>}
                      </div>
                      <div className="w-1/2 bg-white p-12 flex flex-col justify-center">
                          <h3 className="text-2xl font-bold text-zinc-900 mb-6">联系我们</h3>
                          <div className="w-12 h-1 bg-brand-500 mb-6"></div>
                          <div className="text-zinc-600 whitespace-pre-wrap leading-relaxed mb-8">{customText}</div>
                          <div className="mt-auto text-xs text-zinc-400">© {new Date().getFullYear()} {metadata.author}</div>
                      </div>
                  </div>
              );
         case 'style-5': // Minimal
              return (
                  <div className="h-full flex flex-col items-center justify-between p-24 bg-surface-50" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                       <div className="text-center pt-20">
                            <div className="text-4xl font-black tracking-tighter text-zinc-200 mb-4 uppercase">结束</div>
                       </div>
                       <div className="text-center max-w-sm">
                            <div className="text-zinc-500 text-sm whitespace-pre-wrap">{customText}</div>
                       </div>
                       <div className="text-xs font-mono text-zinc-300">{metadata.author} • {new Date().getFullYear()}</div>
                  </div>
              );
         case 'style-1': // Simple (Default)
         default:
            return (
                <div className="h-full relative flex flex-col justify-end" style={{ minHeight: effectiveContinuous ? '297mm' : '100%' }}>
                    {page.backgroundImage && (
                        <div className="absolute inset-0 z-0"><img src={page.backgroundImage.url} alt="Back Cover" className="w-full h-full object-cover" crossOrigin="anonymous" /></div>
                    )}
                    <div className="relative z-10 bg-white p-16 pt-12">
                        <div className="w-16 h-2 bg-zinc-900 mb-8"></div>
                        <h3 className="text-2xl font-bold text-zinc-900 mb-4">联系与支持</h3>
                        <div className="text-zinc-600 whitespace-pre-wrap leading-relaxed">{customText}</div>
                        <div className="mt-8 pt-8 border-t border-zinc-200 text-xs text-zinc-400">© {new Date().getFullYear()} {metadata.author}. 版权所有。</div>
                    </div>
                </div>
            );
     }
  };

  const renderTOC = () => {
    // If we are in continuous mode (PDF preview or export), we need to find the actual page numbers
    // in the paginated pdfPages array.
    const isContinuousView = isPdfPreview || isExporting || isContinuous;

    const contentPages = tocSourcePages.map((p, idx) => {
      let actualPageNumber = idx + 1;
      
      if (isContinuousView && allPages.length > 0) {
        // Find the page in the current rendered pages (pdfPages) that contains this section's header
        const headerId = `header-${p.id}`;
        const pageWithHeader = allPages.findIndex(page => 
          page.steps.some(step => step.id === headerId)
        );
        if (pageWithHeader !== -1) {
          actualPageNumber = pageWithHeader + 1;
        }
      }
      
      return { ...p, originalIndex: idx, actualPageNumber };
    }).filter(p => p.type !== 'cover' && p.type !== 'back_cover' && p.type !== 'toc');
    
    const typeLabels: Record<string, string> = {
        preface: 'Preface',
        specifications: 'Specifications',
        safety: 'Safety Instructions',
        parameters: 'Technical Parameters',
        package_list: 'Package List',
        diagram: 'Product Diagram',
        maintenance: 'Maintenance',
        troubleshooting: 'Troubleshooting',
        compliance: 'Compliance Information'
    };

    return (
      <div className="flex flex-col h-full" style={{ minHeight: effectiveContinuous ? '150mm' : 'auto' }}>
         <h1 className="text-3xl font-bold text-zinc-900 mb-6 mt-4">Table of Contents</h1>
         <div className="flex-grow space-y-2">
             {contentPages.map((contentPage) => {
                 let label = contentPage.title;
                 if (!label) label = typeLabels[contentPage.type];
                 if (!label && contentPage.steps.length > 0) label = contentPage.steps[0].title;
                 if (!label) label = `Chapter ${contentPage.originalIndex + 1}`;
                 
                 return (
                    <div key={contentPage.id} className="flex items-end text-sm">
                        <div className="text-zinc-800">• Ch. {contentPage.originalIndex + 1}: {label}</div>
                        <div className="flex-grow border-b border-dotted border-zinc-300 mx-2 relative top-[-4px]"></div>
                        <div className="text-zinc-600">Page {contentPage.actualPageNumber}</div>
                    </div>
                 );
             })}
         </div>
      </div>
    );
  };

  if (page.type === 'cover' || page.type === 'back_cover') {
       return (
        <div 
            id={`preview-page-${pageIndex}`}
            ref={pageRef}
            className={`bg-white relative shrink-0 mx-auto overflow-hidden transition-all duration-300 border border-surface-200 ${effectiveContinuous ? 'mb-4' : (isExporting ? 'mb-0' : 'shadow-lg mb-12 hover:shadow-xl')}`}
            style={{ width: `${dimensions.width}mm`, height: effectiveContinuous ? 'auto' : `${dimensions.height}mm` }}
        >
            <div 
                style={{ 
                    transform: `scale(${scale})`, 
                    transformOrigin: 'top left', 
                    width: `${virtualWidth}mm`, 
                    height: effectiveContinuous ? 'auto' : `${virtualHeight}mm`,
                    position: effectiveContinuous ? 'relative' : 'absolute',
                    top: 0,
                    left: 0
                }}
                className="flex flex-col"
            >
                {/* Header for Covers (Optional, but PDF has logo at top) */}
                {page.type === 'cover' && (
                    <div className="h-16 px-8 flex justify-center items-center">
                        <div className="text-[8px] font-black uppercase tracking-widest text-zinc-400">{metadata.author || "FAVOTO"}</div>
                    </div>
                )}

                <div className="flex-grow">
                    {page.type === 'cover' ? renderCover() : renderBackCover()}
                </div>

                {/* Footer for Covers */}
                <footer className="h-[10mm] flex items-center justify-center bg-white">
                </footer>
            </div>
        </div>
       )
  }

  return (
    <div 
      id={`preview-page-${pageIndex}`}
      ref={pageRef}
      className={`bg-white relative shrink-0 mx-auto overflow-hidden transition-all duration-300 border border-surface-200 ${effectiveContinuous ? 'mb-4' : (isExporting ? 'mb-0' : 'shadow-lg mb-12 hover:shadow-xl')}`}
      style={{ width: `${dimensions.width}mm`, height: effectiveContinuous ? 'auto' : `${dimensions.height}mm` }}
    >
      <div 
        style={{ 
            transform: `scale(${scale})`, 
            transformOrigin: 'top left', 
            width: `${virtualWidth}mm`, 
            height: effectiveContinuous ? 'auto' : `${virtualHeight}mm`,
            position: effectiveContinuous ? 'relative' : 'absolute',
            top: 0,
            left: 0
        }}
        className="flex flex-col"
      >
        {/* Content */}
        <div ref={contentRef} className={`p-8 flex flex-col ${effectiveContinuous ? 'relative' : 'absolute top-0 left-0 right-0 bottom-0'}`}>
          {page.type === 'toc' ? renderTOC() : (
            <>
              <main className="space-y-4">
                {page.steps.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 text-zinc-300 border-2 border-dashed border-zinc-100 rounded-xl m-8">
                    <p className="font-medium text-sm">Empty Page</p>
                  </div>
                )}
                {page.steps.map((step, idx) => {
                    if (step.isSectionHeader) {
                      if (step.sourcePageType === 'package_list') {
                        return (
                          <div key={step.id} id={`preview-step-${step.id}`} className="mb-4 mt-6 cursor-pointer" onClick={() => {
                            const editorElement = document.getElementById(`editor-step-${step.id}`);
                            if (editorElement) {
                                editorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }}>
                            <h3 className="text-xl font-bold text-zinc-900 border-b border-zinc-200 pb-2">{step.title}</h3>
                          </div>
                        );
                      }
                      return (
                        <div key={step.id} id={`preview-step-${step.id}`} className="manual-chapter-title animate-slide-up cursor-pointer" onClick={() => {
                          const editorElement = document.getElementById(`editor-step-${step.id}`);
                          if (editorElement) {
                              editorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                      }}>
                          {step.title}
                        </div>
                      );
                    }
                    
                    const isProfessional = metadata.mode === 'professional';
                    const isCompact = isProfessional && page.steps.length < 5;

                    const isSafetyWarning = 
                        (step.title?.includes('DANGER') || step.title?.includes('WARNING') || step.title?.includes('CAUTION')) ||
                        (step.description?.includes('DANGER') || step.description?.includes('WARNING') || step.description?.includes('CAUTION'));

                    const isTable = step.description?.includes('|') && step.description?.includes('---');

                    if (isTable) {
                        return (
                            <div key={step.id} id={`preview-step-${step.id}`} className="mb-6 cursor-pointer" onClick={() => {
                          const editorElement = document.getElementById(`editor-step-${step.id}`);
                          if (editorElement) {
                              editorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                      }}>
                                <div className="manual-section-header">
                                    <div className="manual-section-bar"></div>
                                    <h3 className="manual-section-title">{step.title}</h3>
                                </div>
                                <div className="manual-table-container overflow-hidden rounded-sm border border-zinc-200">
                                    <div className="markdown-body">
                                        <Markdown remarkPlugins={[remarkGfm]}>{step.description}</Markdown>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (isSafetyWarning) {
                        const isDanger = step.title?.includes('DANGER') || step.description?.includes('DANGER');
                        const isWarning = step.title?.includes('WARNING') || step.description?.includes('WARNING');
                        const isCaution = step.title?.includes('CAUTION') || step.description?.includes('CAUTION');
                        
                        const typeClass = isDanger ? 'danger' : isWarning ? 'warning' : 'caution';
                        
                        return (
                            <div key={step.id} id={`preview-step-${step.id}`} className={`manual-warning-box ${typeClass} cursor-pointer`} onClick={() => {
                          const editorElement = document.getElementById(`editor-step-${step.id}`);
                          if (editorElement) {
                              editorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                      }}>
                                <div className="manual-warning-icon">
                                    <i className={`fas ${isDanger ? 'fa-exclamation-triangle' : isWarning ? 'fa-exclamation-circle' : 'fa-info-circle'}`}></i>
                                </div>
                                <div className="manual-warning-content">
                                    <div className="font-bold mb-1 uppercase tracking-wide">{step.title}</div>
                                    <Markdown remarkPlugins={[remarkGfm]}>{step.description}</Markdown>
                                </div>
                            </div>
                        );
                    }

                    // Special rendering for Package List items to avoid "title" format
                    if (step.sourcePageType === 'package_list') {
                        return (
                            <div key={step.id} id={`preview-step-${step.id}`} className="mb-4 pb-4 border-b border-zinc-100 last:border-0 cursor-pointer" onClick={() => {
                                const editorElement = document.getElementById(`editor-step-${step.id}`);
                                if (editorElement) {
                                    editorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            }}>
                                <div className="flex gap-4 items-start">
                                    {step.images.length > 0 && (
                                        <div className="w-16 h-16 flex-shrink-0 bg-zinc-50 rounded p-1 border border-zinc-100">
                                            <img 
                                                src={step.images[0].url} 
                                                alt="Part" 
                                                className="w-full h-full object-contain" 
                                                crossOrigin="anonymous" 
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="font-bold text-zinc-900 text-sm">{step.title}</span>
                                            {/* If description is short, we can put it here, but it's markdown */}
                                        </div>
                                        <div className="markdown-body text-xs text-zinc-500 leading-relaxed">
                                            <Markdown remarkPlugins={[remarkGfm]}>{step.description}</Markdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                      <div key={step.id} id={`preview-step-${step.id}`} className="mb-6 cursor-pointer" onClick={() => {
                          const editorElement = document.getElementById(`editor-step-${step.id}`);
                          if (editorElement) {
                              editorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                      }}>
                          <div className="manual-section-header">
                              <div className="manual-section-bar"></div>
                              <h3 className="manual-section-title">{step.title}</h3>
                          </div>
                          
                          <div className={`flex gap-4 ${step.layout === 'image_left_text_right' ? 'flex-row' : step.layout === 'text_left_image_right' ? 'flex-row-reverse' : step.layout === 'image_top_text_bottom' ? 'flex-col' : step.layout === 'text_top_image_bottom' ? 'flex-col-reverse' : 'flex-col'}`}>
                              <div className="markdown-body text-sm text-zinc-700 leading-relaxed flex-1">
                                  <Markdown remarkPlugins={[remarkGfm]}>{step.description}</Markdown>
                              </div>

                              {step.images.length > 0 && (
                                <div className="grid gap-4 justify-center" style={{ gridTemplateColumns: `repeat(${step.imagesPerRow || (metadata.imagesPerRow || 2)}, minmax(0, 1fr))` }}>
                                    {step.images.map((img) => (
                                        <div key={img.id} className="max-w-full">
                                            <img 
                                                src={img.url} 
                                                alt="Step" 
                                                className="max-h-[150mm] w-auto object-contain rounded-sm" 
                                                crossOrigin="anonymous" 
                                            />
                                        </div>
                                    ))}
                                </div>
                              )}
                          </div>
                      </div>
                    );
                })}
              </main>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Preview: React.FC<PreviewProps> = ({
  pages,
  originalPages,
  metadata,
  dimensions,
  previewRef,
  onPageOverflow,
  isContinuous = false,
  isExporting = false,
  isPdfPreview = false,
}) => {
  const tocSourcePages = originalPages || pages;
  return (
    <div ref={previewRef} className={`flex flex-col items-center pt-8 pb-12 w-full ${isContinuous && !isExporting && !isPdfPreview ? 'bg-white shadow-soft-lg max-w-[210mm] mx-auto' : ''}`}>
      {pages.map((page, index) => (
        <PageContainer
          key={page.id}
          page={page}
          pageIndex={index}
          allPages={pages}
          tocSourcePages={tocSourcePages}
          totalPages={pages.length}
          metadata={metadata}
          dimensions={dimensions}
          onOverflow={onPageOverflow}
          isContinuous={isContinuous}
          isExporting={isExporting}
          isPdfPreview={isPdfPreview}
        />
      ))}
    </div>
  );
};

export default Preview;
