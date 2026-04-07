import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ManualPage, ManualMetadata } from '../types';
import { generateCoverDesign } from '../services/geminiService';

interface CoverEditorProps {
  page: ManualPage;
  onUpdate: (updates: Partial<ManualPage>) => void;
  metadata: ManualMetadata;
  onUpdateMetadata: (updates: Partial<ManualMetadata>) => void;
  contextSteps: string;
}

const STYLES = [
    { id: 'style-pdf', name: 'PDF标准', icon: 'fas fa-file-pdf' },
    { id: 'style-1', name: '经典', icon: 'fas fa-image' },
    { id: 'style-2', name: '现代分割', icon: 'fas fa-columns' },
    { id: 'style-3', name: '粗体左对齐', icon: 'fas fa-align-left' },
    { id: 'style-4', name: '科技边框', icon: 'far fa-square' },
    { id: 'style-5', name: '杂志风', icon: 'fas fa-newspaper' }
];

const CoverEditor: React.FC<CoverEditorProps> = ({ page, onUpdate, metadata, onUpdateMetadata, contextSteps }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { alert("文件太大 (最大5MB)"); return; }
      const newImage = { 
          id: uuidv4(), 
          url: URL.createObjectURL(file), 
          file,
          width: 100, // Default percentage
          height: 100 // Default percentage
      };
      onUpdate({ backgroundImage: newImage });
    }
  };

  const handleResizeImage = (scale: number) => {
      if (!page.backgroundImage) return;
      onUpdate({ 
          backgroundImage: {
              ...page.backgroundImage,
              width: scale,
              height: scale
          }
      });
  };

  const handleAIDesign = async () => {
      if (!contextSteps) {
          alert("请先添加一些内容步骤，以便AI理解您的手册。");
          return;
      }
      setIsGenerating(true);
      try {
          const result = await generateCoverDesign(contextSteps);
          
          // Update Text
          onUpdateMetadata({
              title: result.title,
              subtitle: result.subtitle
          });

          // Update Design to Dynamic AI Style
          onUpdate({ 
            layoutStyle: 'style-ai-generated',
            coverDesign: result.design 
          });

      } catch (error) {
          console.error(error);
          alert("AI设计失败。请重试。");
      } finally {
          setIsGenerating(false);
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-6 animate-slide-up">
      
      {/* Header with AI Button */}
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600 border border-brand-100 shadow-sm">
                 <i className="fas fa-book-cover text-lg"></i>
             </div>
             <div>
                 <h3 className="text-base font-bold text-zinc-900">封面</h3>
                 <p className="text-xs text-zinc-500">手册的第一页</p>
             </div>
          </div>
          <button 
            onClick={handleAIDesign}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 btn-animated-glow"
          >
              {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
              AI自动设计
          </button>
      </div>
      
      {/* Layout Style Selector */}
      <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">布局样式</label>
          <div className="grid grid-cols-6 gap-3">
              {STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => onUpdate({ layoutStyle: style.id })}
                    className={`
                        group flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300 relative overflow-hidden
                        ${(page.layoutStyle || 'style-1') === style.id 
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-md scale-105 ring-2 ring-zinc-900/20' 
                            : 'bg-white text-zinc-500 border-zinc-200 hover:border-brand-300 hover:shadow-md hover:scale-105 hover:text-brand-600'
                        }
                    `}
                    title={style.name}
                  >
                      <i className={`${style.icon} text-xl mb-1.5 transition-transform group-hover:scale-110 duration-300`}></i>
                      <span className="text-xs font-bold">{style.name.split(' ')[0]}</span>
                  </button>
              ))}
               {/* AI Generated Indicator Button */}
               {page.layoutStyle === 'style-ai-generated' && (
                  <button
                    className="flex flex-col items-center justify-center p-3 rounded-xl border bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white border-transparent ring-4 ring-fuchsia-500/20 shadow-lg scale-105 animate-pulse-slow"
                    title="当前AI生成的设计"
                    disabled
                  >
                      <i className="fas fa-magic text-xl mb-1.5 animate-float"></i>
                      <span className="text-xs font-bold">AI生成</span>
                  </button>
               )}
          </div>
      </div>

      <div className="p-4 bg-surface-50 rounded-xl border border-zinc-100 text-xs text-zinc-500 space-y-1">
        <p><strong className="text-zinc-700">标题:</strong> {metadata.title}</p>
        <p><strong className="text-zinc-700">副标题:</strong> {metadata.subtitle}</p>
        <p className="pt-2 opacity-60 italic flex items-center gap-1"><i className="fas fa-info-circle"></i> 在文档设置中管理</p>
      </div>

      <div>
        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">封面背景</label>
        {page.backgroundImage ? (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-zinc-200 group h-40 shadow-sm hover:shadow-md transition-shadow">
              <img 
                src={page.backgroundImage.url} 
                alt="封面" 
                className="max-w-full max-h-full object-contain" 
                style={{ 
                    width: `${page.backgroundImage.width || 100}%`, 
                    height: `${page.backgroundImage.height || 100}%`,
                    margin: 'auto'
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-sm">
                 <label className="cursor-pointer px-4 py-2 bg-white rounded-lg text-zinc-900 text-xs font-bold hover:bg-zinc-100 shadow-lg transform hover:scale-105 transition-transform">
                     更改
                     <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                 </label>
                 <button onClick={() => onUpdate({ backgroundImage: undefined })} className="px-4 py-2 bg-red-500 rounded-lg text-white text-xs font-bold hover:bg-red-600 shadow-lg transform hover:scale-105 transition-transform">移除</button>
              </div>
            </div>
            
            {/* Resize Controls */}
            <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">缩放比例 ({page.backgroundImage.width || 100}%)</label>
                <input type="range" min="10" max="100" value={page.backgroundImage.width || 100} onChange={(e) => handleResizeImage(parseInt(e.target.value))} className="w-full accent-brand-600" />
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-zinc-200 rounded-xl hover:border-brand-400 hover:bg-brand-50/20 transition-all cursor-pointer group animate-fade-in">
            <div className="w-12 h-12 bg-surface-100 rounded-full flex items-center justify-center mb-2 group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                 <i className="fas fa-image text-2xl text-zinc-300 group-hover:text-brand-500"></i>
            </div>
            <span className="text-xs font-bold text-zinc-400 group-hover:text-brand-600">上传封面图片</span>
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
        )}
      </div>
    </div>
  );
};

export default CoverEditor;