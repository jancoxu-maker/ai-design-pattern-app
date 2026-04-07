import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ManualStep, StepLayout, StepImage, ManualMetadata } from '../types';
import { generateDescriptionFromImages, generateStepTitle } from '../services/geminiService';
import TableEditor from './TableEditor';
import AutoResizeTextarea from './AutoResizeTextarea';

interface StepEditorProps {
  step: ManualStep;
  index: number;
  metadata: ManualMetadata;
  onUpdate: (id: string, updates: Partial<ManualStep>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  totalSteps: number;
}

const StepEditor: React.FC<StepEditorProps> = ({ 
  step, index, metadata, onUpdate, onDelete, onMoveUp, onMoveDown, totalSteps
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [showTableEditor, setShowTableEditor] = useState(false);

  const imagesContainerRef = useRef<HTMLDivElement>(null);
  const isTable = step.description?.includes('|') && step.description?.includes('---');

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = (Array.from(e.target.files) as File[]).filter(file => {
        if (file.size > 3 * 1024 * 1024) {
          alert(`文件 ${file.name} 太大 (最大 3MB)。`);
          return false;
        }
        return true;
      }).map(file => ({
        id: uuidv4(),
        url: URL.createObjectURL(file),
        file,
        // No default width set, will fallback to metadata settings
      }));
      onUpdate(step.id, { images: [...step.images, ...newImages] });
    }
  };

  const handleRemoveImage = (imageId: string) => {
    onUpdate(step.id, { images: step.images.filter(img => img.id !== imageId) });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('draggedImageIndex', index.toString());
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('draggedImageIndex'));
    if (draggedIndex === targetIndex) return;

    const newImages = [...step.images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(targetIndex, 0, draggedImage);
    onUpdate(step.id, { images: newImages });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleLayoutChange = (newLayout: StepLayout) => {
      console.log("handleLayoutChange called with:", newLayout);
      const isVertical = newLayout === 'image_top_text_bottom' || newLayout === 'text_top_image_bottom';
      const updates: Partial<ManualStep> = { layout: newLayout };
      
      // If switching to vertical and imagesPerRow is not set, default to 6 as requested
      if (isVertical && !step.imagesPerRow) {
          updates.imagesPerRow = 6;
      }
      
      onUpdate(step.id, updates);
  };

  const handleAnalyzeImages = async () => {
    if (step.images.length === 0) return;
    setIsAnalyzing(true);
    try {
      const files = step.images.map(img => img.file);
      const description = await generateDescriptionFromImages(files);
      onUpdate(step.id, { description });
    } catch (error) { alert("分析图片失败。"); } finally { setIsAnalyzing(false); }
  };

  const handleGenerateTitle = async () => {
    if (!step.description) return;
    setIsGeneratingTitle(true);
    try {
      const title = await generateStepTitle(step.description);
      onUpdate(step.id, { title });
    } catch (error) { alert("生成标题失败。"); } finally { setIsGeneratingTitle(false); }
  };

  // Fixed Editor Layout Logic: Always Side-by-Side (Image Left, Text Right) for stability
  // This decoupling ensures the editor UI doesn't jump around or break when changing PDF layout options.
  const getImageContainerStyle = () => {
      return { width: '45%' }; // Fixed width for editor stability
  };

  // Determine individual image width style for the EDITOR visualization
  const getIndividualImageStyle = (img: StepImage) => {
      // In editor, single image uses the width set by the slider
      if (step.images.length === 1) return { width: `${img.width || metadata.singleImageSize || 50}%` };
      
      // Multi-image grid logic for Editor visualization
      const perRow = step.imagesPerRow || (metadata.imagesPerRow || 2);
      return { width: `calc((100% - ${(perRow - 1) * 8}px) / ${perRow})` };
  };

  // Check if current layout is vertical for the slider default value display logic
  const isVerticalPDFLayout = step.layout === 'image_top_text_bottom' || step.layout === 'text_top_image_bottom';

  return (
    <div 
        id={`editor-step-${step.id}`}
        onClick={(e) => {
            const target = e.target as HTMLElement;
            // Ignore clicks on buttons, inputs (sliders), and their children
            if (target.closest('button') || target.closest('input')) {
                return;
            }
            const previewElement = document.getElementById(`preview-step-${step.id}`);
            if (previewElement) {
                previewElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }}
        className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-1 transition-all duration-300 hover:shadow-lg hover:border-zinc-300 group animate-slide-up cursor-pointer"
    >
      {/* Header */}
      <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl mb-3 border border-transparent group-hover:border-zinc-100/50 transition-colors">
        <div className="flex items-center gap-3">
            <span className="w-7 h-7 flex items-center justify-center bg-zinc-900 text-white rounded-lg text-xs font-bold shadow-md shadow-zinc-900/10">{index + 1}</span>
            <div className="h-4 w-px bg-zinc-200 mx-1"></div>
            {/* Editor Image Grid Controls */}
            <div className="flex bg-white rounded-lg p-1 shadow-sm border border-zinc-100 gap-1 z-10">
               {[
                   { id: 1, icon: 'fas fa-list' },
                   { id: 2, icon: 'fas fa-th-large' },
                   { id: 3, icon: 'fas fa-th' },
                   { id: 4, icon: 'fas fa-border-all' }
               ].map((gridOpt) => (
                   <button
                    type="button"
                    key={gridOpt.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(step.id, { imagesPerRow: gridOpt.id });
                    }}
                    className={`w-6 h-6 flex items-center justify-center rounded-md text-xs transition-all duration-200 z-10 ${(step.imagesPerRow || (isVerticalPDFLayout ? 6 : (metadata.imagesPerRow || 2))) === gridOpt.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-surface-100 hover:text-zinc-600'}`}
                    title={`设置 ${gridOpt.id} 列`}
                   >
                       <i className={gridOpt.icon}></i>
                   </button>
               ))}
               <div className="h-6 w-px bg-zinc-200 mx-1"></div>
               {[
                   { id: 'image_top_text_bottom', icon: 'fas fa-arrow-down' },
                   { id: 'text_top_image_bottom', icon: 'fas fa-arrow-up' }
               ].map((layoutOpt) => (
                   <button
                    type="button"
                    key={layoutOpt.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(step.id, { layout: layoutOpt.id as StepLayout });
                    }}
                    className={`w-6 h-6 flex items-center justify-center rounded-md text-xs transition-all duration-200 z-10 ${step.layout === layoutOpt.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-surface-100 hover:text-zinc-600'}`}
                    title={layoutOpt.id === 'image_top_text_bottom' ? '图片在上' : '文字在上'}
                   >
                       <i className={layoutOpt.icon}></i>
                   </button>
               ))}
            </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button onClick={() => onMoveUp(index)} disabled={index === 0} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"><i className="fas fa-chevron-up text-xs"></i></button>
            <button onClick={() => onMoveDown(index)} disabled={index === totalSteps - 1} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"><i className="fas fa-chevron-down text-xs"></i></button>
            <button onClick={() => { console.log("Delete button clicked for step:", step.id); onDelete(step.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 hover:shadow-sm ml-1 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="flex flex-col gap-4">
            {/* Content Area - Fixed Layout for Editing Stability */}
            <div 
                className="flex gap-4 step-row-container flex-col md:flex-row"
            >
                {/* Image Section - Always First in Editor */}
                <div 
                    className="flex-shrink-0 order-1"
                    style={getImageContainerStyle()}
                >
                    <div className="space-y-3">
                         {/* Controls for Single Image: Size Slider */}
                        {step.images.length === 1 && (
                            <div className="flex items-center gap-2 p-2 bg-surface-50 rounded-lg border border-zinc-100 shadow-sm">
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">尺寸</span>
                                <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="flex-1">
                                    <input 
                                        type="range" 
                                        min="25" max="100" step="5"
                                        value={step.images[0].width || metadata.singleImageSize || 50}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            const val = parseInt(e.target.value);
                                            onUpdate(step.id, {
                                                images: step.images.map((img, i) => i === 0 ? { ...img, width: val } : img)
                                            });
                                        }}
                                        className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-800"
                                        title="调整 PDF 中的图片宽度"
                                    />
                                </div>
                                <span className="font-bold text-xs text-zinc-700 min-w-[3ch] text-right">{step.images[0].width || metadata.singleImageSize || 50}%</span>
                            </div>
                        )}

                         {/* Controls for Multiple Images: Grid Slider */}
                        {step.images.length > 1 && (
                            <div className="flex items-center gap-2 p-2 bg-surface-50 rounded-lg border border-zinc-100 shadow-sm">
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">网格</span>
                                <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="flex-1">
                                    <input 
                                        type="range" 
                                        min="1" max="6" 
                                        value={step.imagesPerRow || (isVerticalPDFLayout ? 6 : (metadata.imagesPerRow || 2))}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            onUpdate(step.id, { imagesPerRow: parseInt(e.target.value) });
                                        }}
                                        className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-800"
                                    />
                                </div>
                                <span className="font-bold text-xs text-zinc-700 min-w-[1ch]">{step.imagesPerRow || (isVerticalPDFLayout ? 6 : (metadata.imagesPerRow || 2))}</span>
                            </div>
                        )}
                        
                        {step.images.length > 0 && (
                            <div ref={imagesContainerRef} className="flex flex-wrap gap-2 w-full animate-fade-in">
                                {step.images.map((img, index) => (
                                    <div 
                                      key={img.id} 
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, index)}
                                      onDragOver={handleDragOver}
                                      onDrop={(e) => handleDrop(e, index)}
                                      className="relative rounded-lg border border-zinc-200 group/img image-container select-none hover:z-20 hover:shadow-md transition-all duration-300 hover:scale-[1.02] cursor-grab"
                                      style={getIndividualImageStyle(img)}
                                    >
                                        <div className="w-full overflow-hidden rounded-lg bg-surface-50">
                                            <img src={img.url} alt="Step" className="w-full h-auto block pointer-events-none" />
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveImage(img.id)} 
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-white text-zinc-400 hover:text-red-500 border border-zinc-200 rounded-full shadow-sm flex items-center justify-center text-xs opacity-0 group-hover/img:opacity-100 transition-all z-30 hover:scale-110 cursor-pointer"
                                            title="移除图片"
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <label className={`flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-xl hover:border-brand-400 hover:bg-brand-50/20 transition-all cursor-pointer group/upload relative overflow-hidden ${step.images.length > 0 ? 'h-12 border-solid border-zinc-100 bg-surface-50 text-xs text-zinc-500' : 'aspect-[4/3] bg-surface-50/50'}`}>
                             {step.images.length > 0 ? (
                                 <span className="font-bold text-zinc-500 group-hover/upload:text-brand-600 transition-colors flex items-center gap-2">
                                     <i className="fas fa-plus-circle"></i> 添加图片
                                 </span>
                             ) : (
                                 <div className="text-center transform transition-transform group-hover/upload:scale-105 duration-300">
                                     <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-2 text-zinc-400 group-hover/upload:text-brand-500">
                                         <i className="fas fa-image text-lg"></i>
                                     </div>
                                     <span className="block text-xs font-bold text-zinc-400 group-hover/upload:text-brand-600">上传图片</span>
                                 </div>
                             )}
                             <input type="file" accept="image/*" multiple onChange={handleImagesChange} className="hidden" />
                        </label>
                         {step.images.length > 0 && (
                            <button onClick={handleAnalyzeImages} disabled={isAnalyzing} className="w-full py-2 bg-gradient-to-r from-brand-50 to-indigo-50 text-brand-600 rounded-lg text-xs font-bold uppercase tracking-wider btn-animated-glow border border-brand-100/50 hover:shadow-md">
                                {isAnalyzing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-magic mr-1"></i>} AI 描述
                            </button>
                        )}
                    </div>
                </div>

                {/* Text Section - Always Second in Editor */}
                <div className="flex-1 space-y-3 order-2">
                    <div className="relative group/title">
                        <AutoResizeTextarea
                            value={step.title}
                            onChange={(e) => onUpdate(step.id, { title: e.target.value })}
                            placeholder="Step Title"
                            className="w-full text-base font-bold text-zinc-800 placeholder:text-zinc-300 border-b border-transparent focus:border-brand-500 p-1 bg-transparent focus:ring-0 transition-colors"
                        />
                         <button
                            type="button"
                            onClick={handleGenerateTitle}
                            disabled={isGeneratingTitle || !step.description}
                            className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded opacity-0 group-hover/title:opacity-100 transition-all hover:bg-brand-100 disabled:opacity-0 translate-x-2 group-hover/title:translate-x-0"
                        >
                            生成
                        </button>
                    </div>
                    {isTable && (
                        <button 
                            type="button"
                            onClick={() => setShowTableEditor(!showTableEditor)}
                            className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded mb-2"
                        >
                            {showTableEditor ? '隐藏表格编辑器' : '编辑表格'}
                        </button>
                    )}
                    {showTableEditor && isTable ? (
                        <TableEditor markdown={step.description} onChange={(md) => onUpdate(step.id, { description: md })} />
                    ) : (
                        <AutoResizeTextarea
                            value={step.description}
                            onChange={(e) => onUpdate(step.id, { description: e.target.value })}
                            placeholder="Description..."
                            className="w-full p-4 bg-surface-50 border border-zinc-100 rounded-xl text-sm text-zinc-600 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-shadow duration-200 min-h-[120px]"
                        />
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StepEditor;