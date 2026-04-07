import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ManualPage } from '../types';
import AutoResizeTextarea from './AutoResizeTextarea';

interface BackCoverEditorProps {
  page: ManualPage;
  onUpdate: (updates: Partial<ManualPage>) => void;
}

const STYLES = [
    { id: 'style-pdf', name: 'PDF标准', icon: 'fas fa-file-pdf' },
    { id: 'style-1', name: '简洁', icon: 'fas fa-align-left' },
    { id: 'style-2', name: '居中', icon: 'fas fa-align-center' },
    { id: 'style-3', name: '深色', icon: 'fas fa-moon' },
    { id: 'style-4', name: '分割', icon: 'fas fa-columns' },
    { id: 'style-5', name: '极简', icon: 'far fa-square' }
];

const BackCoverEditor: React.FC<BackCoverEditorProps> = ({ page, onUpdate }) => {
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
       if (file.size > 5 * 1024 * 1024) { alert("文件太大"); return; }
      const newImage = { id: uuidv4(), url: URL.createObjectURL(file), file };
      onUpdate({ backgroundImage: newImage });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-6">
      <div className="flex items-center gap-3">
         <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center text-zinc-500">
             <i className="fas fa-book-open fa-flip-horizontal text-lg"></i>
         </div>
         <div>
             <h3 className="text-base font-bold text-zinc-900">封底</h3>
             <p className="text-xs text-zinc-500">最后一页</p>
         </div>
      </div>

       {/* Layout Style Selector */}
       <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">布局样式</label>
          <div className="grid grid-cols-5 gap-2">
              {STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => onUpdate({ layoutStyle: style.id })}
                    className={`
                        flex flex-col items-center justify-center p-2 rounded-lg border transition-all
                        ${(page.layoutStyle || 'style-1') === style.id ? 'bg-zinc-900 text-white border-zinc-900 ring-2 ring-zinc-900/20' : 'bg-surface-50 text-zinc-500 border-zinc-200 hover:bg-white hover:border-zinc-300'}
                    `}
                    title={style.name}
                  >
                      <i className={`${style.icon} text-lg mb-1`}></i>
                      <span className="text-xs font-bold">{style.name.split(' ')[0]}</span>
                  </button>
              ))}
          </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">结束语</label>
        <AutoResizeTextarea
          value={page.customText || ''}
          onChange={(e) => onUpdate({ customText: e.target.value })}
          placeholder="Contact info, copyright, etc."
          className="w-full p-3 bg-surface-50 border border-zinc-200 rounded-xl text-sm text-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">背景</label>
        {page.backgroundImage ? (
          <div className="relative rounded-xl overflow-hidden border border-zinc-200 group h-40">
            <img src={page.backgroundImage.url} alt="封底" className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
               <label className="cursor-pointer px-3 py-1.5 bg-white rounded-lg text-zinc-900 text-xs font-bold hover:bg-zinc-100 shadow-lg">更改<input type="file" accept="image/*" onChange={handleImageChange} className="hidden" /></label>
               <button onClick={() => onUpdate({ backgroundImage: undefined })} className="px-3 py-1.5 bg-red-500 rounded-lg text-white text-xs font-bold hover:bg-red-600 shadow-lg">移除</button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-zinc-200 rounded-xl hover:border-brand-400 hover:bg-brand-50/30 transition-all cursor-pointer">
             <i className="fas fa-image text-2xl text-zinc-300 mb-2"></i>
            <span className="text-xs font-bold text-zinc-500">上传图片</span>
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
        )}
      </div>
    </div>
  );
};

export default BackCoverEditor;