import React, { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { v4 as uuidv4 } from 'uuid';
import StepEditor from './components/StepEditor';
import Preview from './components/Preview';
import StartScreen from './components/StartScreen';
import CoverEditor from './components/CoverEditor';
import BackCoverEditor from './components/BackCoverEditor';
import AutoResizeTextarea from './components/AutoResizeTextarea';
import { ManualStep, ManualMetadata, PageDimensions, ManualPage, SavedProject, ProductInfo } from './types';
import { generatePageTitle, generateProfessionalManual } from './services/geminiService';
import { saveProjectToDB } from './services/storageService';

interface HistoryState {
  pages: ManualPage[];
  metadata: ManualMetadata;
}

const DEFAULT_METADATA: ManualMetadata = {
  title: 'User Manual',
  subtitle: 'Installation & Setup Guide',
  author: 'My Company',
  version: '1.0',
  showStepMarkers: true,
  singleImageSize: 50,
  imagesPerRow: 2,
  isContinuousMode: true
};

const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [pageDimensions, setPageDimensions] = useState<PageDimensions>({ width: 210, height: 297, name: 'A4' });
  const [projectId, setProjectId] = useState<string>(uuidv4());
  
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfPreview, setIsPdfPreview] = useState(false);
  const [pdfPages, setPdfPages] = useState<ManualPage[]>([]);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [metadata, setMetadata] = useState<ManualMetadata>(DEFAULT_METADATA);
  const [pages, setPages] = useState<ManualPage[]>([
    { id: uuidv4(), type: 'cover', title: 'Cover', steps: [], layoutStyle: 'style-pdf' },
    { id: uuidv4(), type: 'toc', title: 'Table of Contents', steps: [] },
    { id: uuidv4(), type: 'content', title: 'Getting Started', steps: [{ id: uuidv4(), title: 'Unboxing', description: 'Carefully remove the device from the packaging. Ensure all accessories are included in the box.', images: [], layout: 'image_left_text_right' }] }
  ]);

  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0); 

  const convertUrlToBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Failed to convert image for saving:", url);
      return url; 
    }
  };

  const saveProjectToHistory = useCallback(async (isManual: boolean = false) => {
    if (!hasStarted) return;
    setIsSaving(true);
    try {
      const pagesToSave = JSON.parse(JSON.stringify(pages)) as ManualPage[];
      for (const page of pagesToSave) {
         if (page.backgroundImage && page.backgroundImage.url.startsWith('blob:')) {
             page.backgroundImage.url = await convertUrlToBase64(page.backgroundImage.url);
             delete page.backgroundImage.file; 
         }
         for (const step of page.steps) {
             for (const img of step.images) {
                 if (img.url.startsWith('blob:')) {
                     img.url = await convertUrlToBase64(img.url);
                     delete img.file; 
                 }
             }
         }
      }
      const projectData: SavedProject = {
        id: projectId,
        lastModified: Date.now(),
        metadata,
        pages: pagesToSave,
        dimensions: pageDimensions
      };
      
      await saveProjectToDB(projectData);
      
      setLastSavedTime(new Date());
    } catch (error) {
       console.error("Failed to save project:", error);
       if (isManual) alert("警告：保存项目失败。请确保您有足够的磁盘空间。");
    } finally {
        setTimeout(() => setIsSaving(false), 500);
    }
  }, [pages, metadata, pageDimensions, projectId, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { saveProjectToHistory(); }, 2000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [pages, metadata, pageDimensions, hasStarted, saveProjectToHistory]);

  useEffect(() => {
    if (!hasStarted) return;
    const intervalId = setInterval(() => { saveProjectToHistory(false); }, 60000);
    return () => clearInterval(intervalId);
  }, [hasStarted, saveProjectToHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveProjectToHistory(true);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveProjectToHistory]);

  useEffect(() => {
    if (hasStarted) {
      requestAnimationFrame(() => {
        const timer = setTimeout(() => {
            const pageElement = document.getElementById(`preview-page-${activePageIndex}`);
            if (pageElement && previewContainerRef.current) {
                const container = previewContainerRef.current;
                const rect = pageElement.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                const isInView = (rect.top >= containerRect.top && rect.bottom <= containerRect.bottom);
                
                if (!isInView) {
                    pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 100);
        return () => clearTimeout(timer);
      });
    }
  }, [activePageIndex, hasStarted]);

  const saveSnapshot = useCallback(() => {
    setPast(prev => {
      const newPast = [...prev, { pages, metadata }];
      if (newPast.length > 20) return newPast.slice(newPast.length - 20);
      return newPast;
    });
    setFuture([]);
  }, [pages, metadata]);

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture(prev => [{ pages, metadata }, ...prev]);
    setPages(previous.pages);
    setMetadata(previous.metadata);
    setPast(newPast);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(prev => [...prev, { pages, metadata }]);
    setPages(next.pages);
    setMetadata(next.metadata);
    setFuture(newFuture);
  };

  const handleTextTypingHistory = () => {
    if (!typingTimeoutRef.current) saveSnapshot();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 1000);
  };

  const prevStepCountRef = useRef<number>(0);

  useEffect(() => {
    if (hasStarted) {
        const totalSteps = pages.reduce((acc, p) => acc + p.steps.length, 0);
        if (totalSteps < prevStepCountRef.current) {
            const timer = setTimeout(() => reflowManual(), 500);
            return () => clearTimeout(timer);
        }
        prevStepCountRef.current = totalSteps;
    }
  }, [pages, hasStarted]);

  const handleStructuralChangeHistory = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    saveSnapshot();
  };

  const handleStart = (dimensions: PageDimensions, mode: 'standard' | 'professional') => {
    setPageDimensions(dimensions);
    setProjectId(uuidv4());
    setMetadata({ ...DEFAULT_METADATA, mode, isContinuousMode: true });
    setPages([
      { id: uuidv4(), type: 'cover', title: 'Cover Page', steps: [], layoutStyle: 'style-pdf' },
      { id: uuidv4(), type: 'toc', title: 'Table of Contents', steps: [] },
      { id: uuidv4(), type: 'content', title: 'Getting Started', steps: [{ id: uuidv4(), title: 'Unboxing', description: 'Carefully remove the device from the packaging. Ensure all accessories are included in the box.', images: [], layout: 'image_left_text_right' }] }
    ]);
    setPast([]);
    setFuture([]);
    setActivePageIndex(0);
    setHasStarted(true);
  };

  const handleLoadProject = (project: SavedProject) => {
      setProjectId(project.id);
      setMetadata({ ...DEFAULT_METADATA, ...project.metadata });
      setPages(project.pages);
      setPageDimensions(project.dimensions);
      setPast([]);
      setFuture([]);
      setActivePageIndex(0);
      setHasStarted(true);
  };

  const activePage = pages[activePageIndex] || pages[0] || { id: 'dummy', type: 'content', steps: [] };

  const addNewPage = () => {
    handleStructuralChangeHistory();
    const lastPage = pages[pages.length - 1];
    const hasBackCover = lastPage.type === 'back_cover';
    const newPage: ManualPage = { id: uuidv4(), type: 'content', title: '', steps: [] };
    const insertIndex = hasBackCover ? pages.length - 1 : pages.length;
    const newPages = [...pages];
    newPages.splice(insertIndex, 0, newPage);
    setPages(newPages);
    setActivePageIndex(insertIndex); 
  };

  const addTocPage = () => {
     if (pages.some(p => p.type === 'toc')) { alert("目录页已存在。"); return; }
     handleStructuralChangeHistory();
     const insertIndex = pages[0].type === 'cover' ? 1 : 0;
     const newPages = [...pages];
     newPages.splice(insertIndex, 0, { id: uuidv4(), type: 'toc', title: '目录', steps: [] });
     setPages(newPages);
     setActivePageIndex(insertIndex);
  };

  const addBackCover = () => {
    if (pages.some(p => p.type === 'back_cover')) { alert("封底已存在。"); return; }
    handleStructuralChangeHistory();
    setPages([...pages, { id: uuidv4(), type: 'back_cover', title: '封底', steps: [], layoutStyle: 'style-pdf' }]);
    setActivePageIndex(pages.length);
  };

  const switchPage = (index: number) => {
    if (index >= 0 && index < pages.length) {
        setActivePageIndex(index);
        const editorElement = document.getElementById(`editor-section-${pages[index].id}`);
        if (editorElement) editorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const previewElement = document.getElementById(`preview-page-${index}`);
        if (previewElement) previewElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const deletePage = (index: number) => {
    if (pages.length <= 1) {
      alert("您必须至少保留一页。");
      return;
    }
    handleStructuralChangeHistory();
    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages);
    setActivePageIndex(prev => Math.min(newPages.length - 1, prev));
  };

  const updatePageTitle = (pageId: string, title: string) => {
    handleTextTypingHistory();
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, title } : p));
  };

  const handleAutoGeneratePageTitle = async (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (!page || page.steps.length === 0) { alert("请先添加一些步骤。"); return; }
    handleStructuralChangeHistory();
    setIsGeneratingTitle(true);
    try {
      const suggestedTitle = await generatePageTitle(page.steps);
      setPages(currentPages => currentPages.map(p => p.id === pageId ? { ...p, title: suggestedTitle } : p));
    } catch (error) { alert("生成标题失败。"); } finally { setIsGeneratingTitle(false); }
  };

  const updateMetadata = (updates: Partial<ManualMetadata>) => {
    const isText = 'title' in updates || 'subtitle' in updates || 'author' in updates || 'version' in updates;
    if (isText) handleTextTypingHistory(); else handleStructuralChangeHistory();
    setMetadata(prev => ({ ...prev, ...updates }));
  };

  const updatePage = (pageId: string, updates: Partial<ManualPage>) => {
    handleStructuralChangeHistory();
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, ...updates } : p));
  };

  const addStepToPage = (pageId: string) => {
    handleStructuralChangeHistory();
    const newStep: ManualStep = { id: uuidv4(), title: '', description: '', images: [], layout: 'image_left_text_right' };
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, steps: [...p.steps, newStep] } : p));
  };

  const updateStep = (stepId: string, updates: Partial<ManualStep>) => {
    const isTextUpdate = 'title' in updates || 'description' in updates;
    if (isTextUpdate) handleTextTypingHistory(); else handleStructuralChangeHistory();
    const newPages = pages.map(page => ({ ...page, steps: page.steps.map(step => step.id === stepId ? { ...step, ...updates } : step) }));
    setPages(newPages);
  };

  const deleteStep = (stepId: string) => {
    handleStructuralChangeHistory();
    const newPages = pages.map(page => ({ ...page, steps: page.steps.filter(step => step.id !== stepId) }));
    setPages(newPages);
    setTimeout(() => reflowManual(), 100);
  };

  const moveStep = (stepIndex: number, direction: 'up' | 'down') => {
    const page = pages[activePageIndex];
    if (page.type === 'cover' || page.type === 'back_cover' || page.type === 'toc') return;
    if (direction === 'up' && stepIndex === 0) return;
    if (direction === 'down' && stepIndex === page.steps.length - 1) return;
    handleStructuralChangeHistory();
    const newSteps = [...page.steps];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    [newSteps[stepIndex], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[stepIndex]];
    const newPages = [...pages];
    newPages[activePageIndex].steps = newSteps;
    setPages(newPages);
  };

  const reflowManual = () => {
    handleStructuralChangeHistory();
    const newPages = [...pages];
    let changed = false;

    for (let i = 0; i < newPages.length - 1; i++) {
      const currentPage = newPages[i];
      const nextPage = newPages[i + 1];

      const isCompatible = (currentPage.type === nextPage.type) || (currentPage.type === 'content' && nextPage.type === 'content');

      if (!isCompatible) continue;
      if (nextPage.steps.length === 0) continue;
      
      const isProfessional = metadata.mode === 'professional';
      const isUnderThreshold = isProfessional && currentPage.steps.length < 3;
      const isShortSection = isProfessional && currentPage.steps.length < 5;
      const needsMerging = isProfessional ? (isUnderThreshold || isShortSection) : true;

      if (needsMerging && nextPage.steps.length > 0) {
          currentPage.steps.push(...nextPage.steps);
          nextPage.steps = [];
          changed = true;
      }
    }

    const filteredPages = newPages.filter((p, idx) => {
        if (p.type === 'cover' || p.type === 'back_cover' || p.type === 'toc') return true;
        return p.steps.length > 0 || idx === activePageIndex; 
    });

    if (changed) setPages(filteredPages);
  };

  useEffect(() => {
    if (metadata.isContinuousMode || isPdfPreview || isExporting) {
      const merged: ManualPage[] = [];
      const contentSteps: ManualStep[] = [];
      
      const cover = pages.find(p => p.type === 'cover');
      if (cover) merged.push(JSON.parse(JSON.stringify(cover)));
      
      const toc = pages.find(p => p.type === 'toc');
      if (toc) merged.push(JSON.parse(JSON.stringify(toc)));
      
      const middlePages = pages.filter(p => p.type !== 'cover' && p.type !== 'toc' && p.type !== 'back_cover');
      
      middlePages.forEach(p => {
        const typeLabels: Record<string, string> = {
            preface: '前言', specifications: '规格', safety: '安全说明', parameters: '技术参数', 
            package_list: '装箱清单', diagram: '产品图解', maintenance: '维护保养', 
            troubleshooting: '故障排除', compliance: '合规信息', content: '内容'
        };

        contentSteps.push({
          id: `header-${p.id}`,
          title: p.title || typeLabels[p.type] || '章节',
          description: '',
          images: [],
          layout: 'text_only',
          isSectionHeader: true,
          sourcePageType: p.type
        });
        contentSteps.push(...JSON.parse(JSON.stringify(p.steps)).map((s: any) => ({ ...s, sourcePageType: p.type })));
      });
      
      if (contentSteps.length > 0) {
        merged.push({ id: 'merged-content-root', type: 'content', title: 'Manual Content', steps: contentSteps });
      }
      
      const back = pages.find(p => p.type === 'back_cover');
      if (back) merged.push(JSON.parse(JSON.stringify(back)));
      
      setPdfPages(merged);
    } else {
      setPdfPages(pages);
    }
  }, [pages, metadata.isContinuousMode, isPdfPreview, isExporting]);

  const generatePDF = useCallback(async () => {
    setIsGenerating(true);
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const pdf = new jsPDF({
        orientation: pageDimensions.width > pageDimensions.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageDimensions.width, pageDimensions.height]
      });

      const pageElements = Array.from(document.querySelectorAll('[id^="preview-page-"]'))
        .sort((a, b) => parseInt(a.id.split('-').pop() || '0') - parseInt(b.id.split('-').pop() || '0'));

      for (let i = 0; i < pageElements.length; i++) {
        const pageElement = pageElements[i] as HTMLElement;
        if (!document.body.contains(pageElement)) continue;
        if (i > 0) pdf.addPage();
        
        const canvas = await html2canvas(pageElement, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      }
      const safeTitle = (metadata.title || "manual").replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${safeTitle}.pdf`);
    } catch (error) { console.error("PDF Generation failed", error); alert("生成 PDF 失败。"); } finally { setIsGenerating(false); setIsExporting(false); }
  }, [metadata.title, pageDimensions, pages]);

  const handleGenerateProfessional = async (description: string, productInfo: ProductInfo, photos: File[], market: 'EU' | 'US', dimensions: PageDimensions, onProgress?: (msg: string) => void) => {
    setIsGenerating(true);
    try {
      const result = await generateProfessionalManual(description, productInfo, photos, market, onProgress);
      setPageDimensions(dimensions);
      setProjectId(uuidv4());
      setMetadata({ ...DEFAULT_METADATA, ...result.metadata, mode: 'professional' });
      
      const generatedPages: ManualPage[] = result.pages.map((p: any) => ({
        id: uuidv4(),
        type: (p?.type && typeof p.type === 'string' && (p.type.toLowerCase() === 'cover' || p.type.toLowerCase() === 'back_cover' || p.type.toLowerCase() === 'toc' || p.type.toLowerCase() === 'content')) ? p.type.toLowerCase() : 'content',
        title: p.title || "Untitled",
        layoutStyle: (p?.type && typeof p.type === 'string' && (p.type.toLowerCase() === 'cover' || p.type.toLowerCase() === 'back_cover')) ? 'style-pdf' : undefined,
        steps: Array.isArray(p.steps) ? p.steps.map((s: any) => ({
          id: uuidv4(),
          title: s.title || "",
          description: s.description || "",
          images: [],
          layout: s.layout || 'image_left_text_right'
        })) : []
      }));
      if (!generatedPages.some(p => p.type === 'toc')) generatedPages.splice(1, 0, { id: uuidv4(), type: 'toc', title: 'Table of Contents', steps: [] });
      setPages(generatedPages);
      setPast([]); setFuture([]); setActivePageIndex(0); setHasStarted(true);
      setTimeout(() => reflowManual(), 500);
    } catch (error) { console.error("Professional generation failed:", error); alert("生成专业手册失败。请重试。"); } finally { setIsGenerating(false); }
  };

  if (!hasStarted) return <StartScreen onStart={handleStart} onLoadProject={handleLoadProject} onGenerateProfessional={handleGenerateProfessional} />;

  return (
    <div className=\"flex flex-col h-[100dvh] bg-zinc-50 text-zinc-800 font-sans overflow-hidden\">
       {/* ... (此处保持原有 JSX 结构不变) ... */}
    </div>
  );
};

export default App;
