import React, { useState, useEffect } from 'react';
import { PageDimensions, SavedProject, ProductInfo } from '../types';
import { getProjectsFromDB, deleteProjectFromDB } from '../services/storageService';

interface StartScreenProps {
  onStart: (dimensions: PageDimensions, mode: 'standard' | 'professional') => void;
  onLoadProject: (project: SavedProject) => void;
  onGenerateProfessional: (description: string, productInfo: ProductInfo, photos: File[], market: 'EU' | 'US', dimensions: PageDimensions, onProgress?: (msg: string) => void) => Promise<void>;
}

const PRESETS: PageDimensions[] = [
  { name: 'A4', width: 210, height: 297 },
  { name: 'A5', width: 148, height: 210 },
  { name: 'Letter', width: 216, height: 279 },
];

const StartScreen: React.FC<StartScreenProps> = ({ onStart, onLoadProject, onGenerateProfessional }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('A4');
  const [customWidth, setCustomWidth] = useState<string>('210');
  const [customHeight, setCustomHeight] = useState<string>('297');
  const [isCustom, setIsCustom] = useState(false);
  const [recentProjects, setRecentProjects] = useState<SavedProject[]>([]);
  
  // Professional Mode State
  const [mode, setMode] = useState<'standard' | 'professional'>('standard');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [market, setMarket] = useState<'EU' | 'US'>('US');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  
  // New mandatory fields
  const [brandName, setBrandName] = useState('');
  const [productNameAndModel, setProductNameAndModel] = useState('');
  const [coreFeatures, setCoreFeatures] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [installationUsage, setInstallationUsage] = useState('');
  const [packageList, setPackageList] = useState('');
  const [euRepresentative, setEuRepresentative] = useState('');
  const [ukRepresentative, setUkRepresentative] = useState('');
  const [manufacturerInfo, setManufacturerInfo] = useState('');

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projects = await getProjectsFromDB();
        setRecentProjects(projects);
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    loadProjects();
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
    }
  };

  const handleProfessionalSubmit = async () => {
    if (!description.trim()) {
      // alert("Please provide a product description.");
      return;
    }
    
    const width = parseFloat(customWidth);
    const height = parseFloat(customHeight);
    if (isNaN(width) || height <= 0) {
        // alert("Please enter valid dimensions.");
        return;
    }

    setIsGenerating(true);
    setGenerationProgress('正在初始化...');
    try {
      await onGenerateProfessional(description, {
        brandName,
        productNameAndModel,
        coreFeatures,
        specifications,
        installationUsage,
        packageList,
        euRepresentative,
        ukRepresentative,
        manufacturerInfo
      }, photos, market, {
        name: isCustom ? 'Custom' : selectedPreset,
        width,
        height
      }, (msg) => setGenerationProgress(msg));
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    console.log("Deleting project:", projectId);
    
    try {
      await deleteProjectFromDB(projectId);
      console.log("Project deleted from DB");
      
      // Small delay to ensure DB operation is reflected
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const projects = await getProjectsFromDB();
      console.log("Remaining projects:", projects.length);
      setRecentProjects([...projects]); // Use spread to ensure state update
    } catch (e) {
      console.error("Failed to delete project", e);
    }
  };

  const handlePresetSelect = (preset: PageDimensions) => {
    setSelectedPreset(preset.name);
    setIsCustom(false);
    setCustomWidth(preset.width.toString());
    setCustomHeight(preset.height.toString());
  };

  const handleCustomFocus = () => {
    setSelectedPreset('custom');
    setIsCustom(true);
  };

  const handleSubmit = () => {
    const width = parseFloat(customWidth);
    const height = parseFloat(customHeight);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      // alert("Please enter valid positive dimensions.");
      return;
    }

    onStart({
      name: isCustom ? '自定义' : selectedPreset,
      width,
      height
    }, mode);
  };

  return (
    <div className="h-full w-full bg-surface-50 overflow-y-auto custom-scrollbar relative selection:bg-brand-100 selection:text-brand-900">
      <div className="min-h-full flex flex-col items-center p-6 pb-32 relative">
        {/* Background Decor */}
        <div className="absolute top-0 left-0 w-full h-full bg-dot-pattern [background-size:20px_20px] opacity-40 pointer-events-none"></div>
        
        {/* Animated Blobs */}
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-brand-200/30 rounded-full blur-[120px] pointer-events-none animate-float"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-fuchsia-200/30 rounded-full blur-[100px] pointer-events-none animate-float-delayed"></div>
        <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] bg-blue-100/20 rounded-full blur-[80px] pointer-events-none animate-pulse-slow"></div>

        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 z-10 py-8">
        
        {/* Left Side: Welcome & New Project */}
        <div className="md:col-span-7 flex flex-col gap-6 animate-slide-up">
          <div className="glass-panel p-8 rounded-[2rem] shadow-soft-lg border border-white/60">
            <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl flex items-center justify-center text-white shadow-glow transform transition-transform hover:scale-105 duration-300">
                    <i className="fas fa-book-open text-3xl"></i>
                </div>
                <div>
                    <h1 className="text-4xl font-extrabold text-zinc-900 tracking-tight mb-1">手册大师 AI</h1>
                    <p className="text-zinc-500 font-medium text-lg">几分钟内创建精美的文档。</p>
                </div>
            </div>

            {/* Mode Selector */}
            <div className="flex p-1 bg-zinc-100 rounded-xl mb-8">
                <button 
                    onClick={() => setMode('standard')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'standard' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    标准模式
                </button>
                <button 
                    onClick={() => setMode('professional')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'professional' ? 'bg-white text-brand-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    专业模式
                </button>
            </div>
            
            {/* Dimension Selection (Common for both modes) */}
            <div className="mb-8">
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 ml-1">文档尺寸</h2>
                <div className="grid grid-cols-4 gap-4 mb-4">
                    {PRESETS.map((preset) => (
                    <button
                        key={preset.name}
                        onClick={() => handlePresetSelect(preset)}
                        className={`
                        group relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3
                        ${selectedPreset === preset.name 
                            ? 'border-brand-500 bg-brand-50/60 text-brand-700 ring-2 ring-brand-500/20 shadow-lg transform -translate-y-1' 
                            : 'border-zinc-200/60 bg-white/80 hover:border-brand-300 hover:shadow-md hover:-translate-y-1 text-zinc-600'
                        }
                        `}
                    >
                        <div className={`w-8 h-10 border-2 rounded-sm transition-colors ${selectedPreset === preset.name ? 'border-brand-400 bg-white' : 'border-zinc-300 group-hover:border-zinc-400'} mb-1`}></div>
                        <span className="font-bold text-sm">{preset.name}</span>
                        <span className="text-xs opacity-60 font-medium bg-surface-100 px-1.5 py-0.5 rounded-full">{preset.width}x{preset.height}</span>
                    </button>
                    ))}
                    <button 
                    onClick={handleCustomFocus}
                    className={`
                        group relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3
                        ${isCustom 
                            ? 'border-brand-500 bg-brand-50/60 text-brand-700 ring-2 ring-brand-500/20 shadow-lg transform -translate-y-1' 
                            : 'border-zinc-200/60 bg-white/80 hover:border-brand-300 hover:shadow-md hover:-translate-y-1 text-zinc-600'
                        }
                    `}
                    >
                        <div className={`w-8 h-10 border-2 border-dashed rounded-sm transition-colors ${isCustom ? 'border-brand-400 bg-white' : 'border-zinc-300 group-hover:border-zinc-400'} mb-1`}></div>
                        <span className="font-bold text-sm">自定义</span>
                        <span className="text-xs opacity-60 font-medium bg-surface-100 px-1.5 py-0.5 rounded-full">mm</span>
                    </button>
                </div>
                
                {isCustom && (
                    <div className="flex gap-4 bg-white/60 p-4 rounded-2xl border border-brand-200/50 shadow-sm animate-fade-in">
                        <div className="flex-1">
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5 tracking-wider">宽度 (mm)</label>
                        <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm" />
                        </div>
                        <div className="flex-1">
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5 tracking-wider">高度 (mm)</label>
                        <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm" />
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                {mode === 'standard' ? (
                    <>
                        <button
                            onClick={handleSubmit}
                            className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl shadow-xl shadow-zinc-900/10 btn-animated-glow flex items-center justify-center gap-3 group mt-2"
                        >
                            <span className="text-lg">创建项目</span>
                            <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                        </button>
                    </>
                ) : (
                    <div className="space-y-5 animate-fade-in pr-2">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 tracking-widest">产品照片</label>
                            <div className="relative group">
                                <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*" 
                                    onChange={handlePhotoUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-6 text-center group-hover:border-brand-300 group-hover:bg-brand-50/30 transition-all">
                                    {photos.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {photos.map((photo, index) => (
                                                <img 
                                                    key={index} 
                                                    src={URL.createObjectURL(photo)} 
                                                    alt={`Preview ${index}`} 
                                                    className="w-full h-20 object-cover rounded-lg" 
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-400 group-hover:text-brand-500 group-hover:bg-brand-50 transition-all">
                                                <i className="fas fa-cloud-upload-alt text-xl"></i>
                                            </div>
                                            <p className="text-sm font-bold text-zinc-700">上传产品照片</p>
                                            <p className="text-xs text-zinc-400 mt-1">拖拽或点击浏览</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-surface-900 border-b border-surface-200 pb-2">产品信息</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">品牌名称</label>
                                    <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} className="w-full p-2.5 bg-white border border-zinc-200 rounded-lg text-sm" placeholder="例如: Favoto" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">产品名称及型号</label>
                                    <input type="text" value={productNameAndModel} onChange={(e) => setProductNameAndModel(e.target.value)} className="w-full p-2.5 bg-white border border-zinc-200 rounded-lg text-sm" placeholder="例如: B025" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">核心功能</label>
                                <textarea value={coreFeatures} onChange={(e) => setCoreFeatures(e.target.value)} className="w-full p-2.5 bg-white border border-zinc-200 rounded-lg text-sm" placeholder="例如: 可拆卸遮阳板..." />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-surface-900 border-b border-surface-200 pb-2">手册内容</h3>
                            <div>
                                <label className="block text-xs font-bold text-surface-500 uppercase mb-1.5">规格参数</label>
                                <textarea value={specifications} onChange={(e) => setSpecifications(e.target.value)} className="w-full p-2.5 bg-white border border-surface-200 rounded-lg text-sm" placeholder="例如: PC外壳, EPS泡沫..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-surface-500 uppercase mb-1.5">安装/使用说明</label>
                                <textarea value={installationUsage} onChange={(e) => setInstallationUsage(e.target.value)} className="w-full p-2.5 bg-white border border-surface-200 rounded-lg text-sm" placeholder="例如: 打开扣带..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-surface-500 uppercase mb-1.5">包装清单</label>
                                <textarea value={packageList} onChange={(e) => setPackageList(e.target.value)} className="w-full p-2.5 bg-white border border-surface-200 rounded-lg text-sm" placeholder="例如: 头盔*1, 遮阳板*1..." />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-surface-900 border-b border-surface-200 pb-2">合规与制造商信息</h3>
                            <div>
                                <label className="block text-xs font-bold text-surface-500 uppercase mb-1.5">欧盟代表信息</label>
                                <input type="text" value={euRepresentative} onChange={(e) => setEuRepresentative(e.target.value)} className="w-full p-2.5 bg-white border border-surface-200 rounded-lg text-sm" placeholder="例如: WeTapeV Euro s.r.o..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-surface-500 uppercase mb-1.5">英国代表信息</label>
                                <input type="text" value={ukRepresentative} onChange={(e) => setUkRepresentative(e.target.value)} className="w-full p-2.5 bg-white border border-surface-200 rounded-lg text-sm" placeholder="例如: STONEBRIDGE (CN)..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-surface-500 uppercase mb-1.5">制造商信息</label>
                                <input type="text" value={manufacturerInfo} onChange={(e) => setManufacturerInfo(e.target.value)} className="w-full p-2.5 bg-white border border-surface-200 rounded-lg text-sm" placeholder="例如: favoto" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 tracking-widest">产品描述</label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full p-4 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm min-h-[120px]"
                                placeholder="描述您的产品、功能及其工作原理..."
                            />
                        </div>

                        <div className="flex items-center justify-between bg-white/60 p-4 rounded-2xl border border-zinc-100 shadow-sm">
                            <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">目标市场</span>
                            <div className="flex bg-zinc-100 p-1 rounded-lg">
                                <button 
                                    onClick={() => setMarket('US')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${market === 'US' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                                >
                                    美国市场
                                </button>
                                <button 
                                    onClick={() => setMarket('EU')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${market === 'EU' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                                >
                                    欧盟市场
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleProfessionalSubmit}
                            disabled={isGenerating}
                            className={`w-full py-4 bg-brand-600 text-white font-bold rounded-2xl shadow-xl shadow-brand-600/20 btn-animated-glow flex items-center justify-center gap-3 group mt-2 ${isGenerating ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {isGenerating ? (
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-3">
                                        <i className="fas fa-circle-notch fa-spin"></i>
                                        <span className="text-lg">正在生成手册...</span>
                                    </div>
                                    {generationProgress && (
                                        <div className="text-[10px] font-medium text-white/70 uppercase tracking-widest mt-1 animate-pulse">
                                            {generationProgress}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <span className="text-lg">自动生成手册</span>
                                    <i className="fas fa-magic group-hover:rotate-12 transition-transform"></i>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
            
            {/* Bottom Spacer to ensure scrollability */}
            <div className="h-12 w-full"></div>
          </div>
        </div>

        {/* Right Side: Recent Projects */}
        <div className="md:col-span-5 flex flex-col min-h-[500px] animate-slide-up stagger-1">
           <div className="glass-panel p-6 rounded-[2rem] flex flex-col shadow-soft-lg border border-white/60">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2 ml-1">
                  <i className="far fa-clock"></i> 最近项目
              </h3>
              
              <div className="flex-1 pr-2 space-y-3">
                {recentProjects.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 opacity-60">
                        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                            <i className="fas fa-layer-group text-3xl text-zinc-300"></i>
                        </div>
                        <p className="text-sm font-medium">暂无最近项目</p>
                    </div>
                ) : (
                    recentProjects.map((project, index) => (
                        <div 
                        key={project.id}
                        onClick={() => onLoadProject(project)}
                        className={`group relative bg-white/80 p-4 rounded-2xl border border-zinc-100 hover:border-brand-200 hover:bg-white hover:shadow-lg cursor-pointer transition-all duration-300 animate-slide-up`}
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-zinc-800 mb-1 group-hover:text-brand-600 transition-colors line-clamp-1 text-base">{project.metadata.title}</h4>
                                    <p className="text-xs text-zinc-500 font-medium">
                                        {project.pages.length} 页 • {project.dimensions.name}
                                    </p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-zinc-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-all group-hover:scale-110">
                                    <i className="fas fa-chevron-right text-xs"></i>
                                </div>
                            </div>
                             <div className="mt-3 pt-3 border-t border-zinc-50 flex justify-between items-center">
                                <span className="text-xs text-zinc-400 font-bold bg-surface-50 px-2 py-0.5 rounded-full">
                                    {new Date(project.lastModified).toLocaleDateString()}
                                </span>
                                <button 
                                    onClick={(e) => handleDeleteProject(e, project.id)}
                                    className="text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all p-1.5 rounded-md"
                                    title="删除"
                                >
                                    <i className="fas fa-trash-alt text-xs"></i>
                                </button>
                             </div>
                        </div>
                    ))
                )}
              </div>
           </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;