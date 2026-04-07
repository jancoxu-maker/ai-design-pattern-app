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
      // Use requestAnimationFrame to ensure DOM is ready and layout is stable
      requestAnimationFrame(() => {
        const timer = setTimeout(() => {
            const pageElement = document.getElementById(`preview-page-${activePageIndex}`);
            if (pageElement && previewContainerRef.current) {
                // Determine if we need to scroll
                const container = previewContainerRef.current;
                const rect = pageElement.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                // Simple check if out of view vertically
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
            // Steps were removed, auto-reflow
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
      // Ensure new metadata fields exist for legacy projects
      setMetadata({ ...DEFAULT_METADATA, ...project.metadata });
      setPages(project.pages);
      setPageDimensions(project.dimensions);
      setPast([]);
      setFuture([]);
      setActivePageIndex(0);
      setHasStarted(true);
  };

  const activePage = pages[activePageIndex] || pages[0] || { id: 'dummy', type: 'content', steps: [] };

  const getContextSteps = useCallback(() => {
    return pages
      .filter(p => p.type === 'content')
      .flatMap(p => p.steps)
      .map(s => `Title: ${s.title}\nDesc: ${s.description}`)
      .join('\n\n');
  }, [pages]);

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
        // Scroll to the page in the editor
        const editorElement = document.getElementById(`editor-section-${pages[index].id}`);
        if (editorElement) {
            editorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Scroll to the page in the preview
        const previewElement = document.getElementById(`preview-page-${index}`);
        if (previewElement) {
            previewElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
  };

  const deletePage = (index: number) => {
    console.log("deletePage called with index:", index, "pages:", pages);
    if (pages.length <= 1) {
      alert("您必须至少保留一页。");
      return;
    }
    
    // User requested "freely delete" - removing window.confirm
    handleStructuralChangeHistory();
    const newPages = pages.filter((_, i) => i !== index);
    console.log("newPages after deletePage:", newPages);
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
    console.log("deleteStep called with stepId:", stepId);
    handleStructuralChangeHistory();
    const newPages = pages.map(page => ({ ...page, steps: page.steps.filter(step => step.id !== stepId) }));
    console.log("newPages after deleteStep:", newPages);
    setPages(newPages);
    // Auto-reflow after deletion
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

    const isProfessional = metadata.mode === 'professional';

    // Iterate through pages and try to move steps from next page to current page
    for (let i = 0; i < newPages.length - 1; i++) {
      const currentPage = newPages[i];
      const nextPage = newPages[i + 1];

      // Only reflow between compatible types (e.g. content to content, or same professional type)
      const isCompatible = 
        (currentPage.type === nextPage.type) || 
        (currentPage.type === 'content' && nextPage.type === 'content');

      if (!isCompatible) continue;
      if (nextPage.steps.length === 0) continue;

      // Professional Mode Rules:
      // 1. If current page has < 5 steps, it's forced into "Compact" mode (handled in Preview.tsx).
      // 2. If current page occupies < 40% of the page, prohibit it from being a standalone page.
      // We use 3 steps as a proxy for 40% occupancy (assuming 7-8 steps per full page).
      
      const isProfessional = metadata.mode === 'professional';
      const isUnderThreshold = isProfessional && currentPage.steps.length < 3;
      const isShortSection = isProfessional && currentPage.steps.length < 5;
      
      // In professional mode, we merge if it's under the 40% threshold OR if it's a short section (< 5 steps)
      // that "must not have an independent physical page".
      const needsMerging = isProfessional ? (isUnderThreshold || isShortSection) : true;

      // Merge logic:
      if (needsMerging && nextPage.steps.length > 0) {
          currentPage.steps.push(...nextPage.steps);
          nextPage.steps = [];
          changed = true;
      }
    }

    // Remove empty pages that were created during reflow (except mandatory ones)
    const filteredPages = newPages.filter((p, idx) => {
        if (p.type === 'cover' || p.type === 'back_cover' || p.type === 'toc') return true;
        return p.steps.length > 0 || idx === activePageIndex; // Keep active page even if empty
    });

    if (changed) {
        setPages(filteredPages);
    }
  };

  // Sync pdfPages whenever pages, continuous mode, or preview/export states change
  useEffect(() => {
    // We use merged pages for:
    // 1. Continuous mode in editor
    // 2. PDF Preview
    // 3. PDF Export
    if (metadata.isContinuousMode || isPdfPreview || isExporting) {
      const merged: ManualPage[] = [];
      const contentSteps: ManualStep[] = [];
      
      // 1. Cover
      const cover = pages.find(p => p.type === 'cover');
      if (cover) merged.push(JSON.parse(JSON.stringify(cover)));
      
      // 2. TOC
      const toc = pages.find(p => p.type === 'toc');
      if (toc) merged.push(JSON.parse(JSON.stringify(toc)));
      
      // 3. Merge all middle content (preface, specs, safety, content, etc.)
      const middlePages = pages.filter(p => 
        p.type !== 'cover' && 
        p.type !== 'toc' && 
        p.type !== 'back_cover'
      );
      
      middlePages.forEach(p => {
        // Add a section header step
        const typeLabels: Record<string, string> = {
            preface: '前言',
            specifications: '规格',
            safety: '安全说明',
            parameters: '技术参数',
            package_list: '装箱清单',
            diagram: '产品图解',
            maintenance: '维护保养',
            troubleshooting: '故障排除',
            compliance: '合规信息',
            content: '内容'
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
        contentSteps.push(...JSON.parse(JSON.stringify(p.steps)).map((s: any) => ({
          ...s,
          sourcePageType: p.type
        })));
      });
      
      if (contentSteps.length > 0) {
        merged.push({
          id: 'merged-content-root',
          type: 'content',
          title: 'Manual Content',
          steps: contentSteps
        });
      }
      
      // 4. Back Cover
      const back = pages.find(p => p.type === 'back_cover');
      if (back) merged.push(JSON.parse(JSON.stringify(back)));
      
      setPdfPages(merged);
    } else {
      setPdfPages(pages);
    }
  }, [pages, metadata.isContinuousMode, isPdfPreview, isExporting]);

  const handlePageOverflow = useCallback((pageIndex: number) => {
    const setter = isPdfPreview || isExporting ? setPdfPages : setPages;
    setter(prevPages => {
      if (pageIndex < 0 || pageIndex >= prevPages.length) return prevPages;
      const currentPage = prevPages[pageIndex];
      if (!currentPage || currentPage.type !== 'content' || currentPage.steps.length <= 1) return prevPages;
      const lastStep = currentPage.steps[currentPage.steps.length - 1];
      const newCurrentPageSteps = currentPage.steps.slice(0, -1);
      const nextPageIndex = pageIndex + 1;
      let nextPage = prevPages[nextPageIndex];
      let newPages = [...prevPages];
      newPages[pageIndex] = { ...currentPage, steps: newCurrentPageSteps };
      if (nextPage && nextPage.type === 'content') {
        newPages[nextPageIndex] = { ...nextPage, steps: [lastStep, ...nextPage.steps] };
      } else {
        const baseTitle = currentPage.title || '';
        const newTitle = baseTitle ? `${baseTitle} (Continued)` : 'Continued...';
        const newPage: ManualPage = { id: uuidv4(), type: 'content', title: newTitle, steps: [lastStep] };
        newPages.splice(nextPageIndex, 0, newPage);
      }
      return newPages;
    });
  }, [isPdfPreview, isExporting]);

  const generatePDF = useCallback(async () => {
    setIsGenerating(true);
    setIsExporting(true);
    
    try {
      // Wait for re-render and pagination stability
      let lastPageCount = 0;
      let stableCount = 0;
      const maxAttempts = 20; // Max 10 seconds of waiting for pagination
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentPageCount = document.querySelectorAll('[id^="preview-page-"]').length;
        
        // If we have pages and the count hasn't changed for 3 checks (1.5s), we assume it's stable
        if (currentPageCount > 0 && currentPageCount === lastPageCount) {
          stableCount++;
          if (stableCount >= 3) break;
        } else {
          stableCount = 0;
        }
        lastPageCount = currentPageCount;
      }

      const pdf = new jsPDF({
        orientation: pageDimensions.width > pageDimensions.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageDimensions.width, pageDimensions.height]
      });

      // Find all page elements in the DOM
      const pageElements = Array.from(document.querySelectorAll('[id^="preview-page-"]'))
        .sort((a, b) => {
          const idA = parseInt(a.id.split('-').pop() || '0');
          const idB = parseInt(b.id.split('-').pop() || '0');
          return idA - idB;
        });

      for (let i = 0; i < pageElements.length; i++) {
        const pageElement = pageElements[i] as HTMLElement;
        
        // Ensure element is still in DOM
        if (!document.body.contains(pageElement)) {
          console.warn(`Page element ${i} is no longer in the DOM, skipping.`);
          continue;
        }

        if (i > 0) pdf.addPage();
        
        const originalShadow = pageElement.style.boxShadow;
        const originalMargin = pageElement.style.margin;
        pageElement.style.boxShadow = 'none';
        pageElement.style.margin = '0';
        
        try {
          const canvas = await html2canvas(pageElement, { 
            scale: 2, 
            useCORS: true, 
            logging: false, 
            backgroundColor: '#ffffff',
            allowTaint: true,
            onclone: (clonedDoc) => {
              const el = clonedDoc.getElementById(pageElement.id);
              if (el) {
                el.style.boxShadow = 'none';
                el.style.margin = '0';
                el.style.display = 'block';
                el.style.visibility = 'visible';
              }
            }
          });
          
          pageElement.style.boxShadow = originalShadow;
          pageElement.style.margin = originalMargin;
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
        } catch (err) {
          console.error(`Failed to capture page ${i}:`, err);
          // Try to continue with other pages if one fails
          pageElement.style.boxShadow = originalShadow;
          pageElement.style.margin = originalMargin;
        }
      }
      
      pdf.save(`${metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (error) { 
      console.error("PDF Generation failed", error); 
      alert("生成 PDF 失败。"); 
    } finally { 
      setIsGenerating(false); 
      setIsExporting(false);
    }
  }, [metadata.title, metadata.isContinuousMode, pdfPages.length, pageDimensions, previewRef]);

  const handleGenerateProfessional = async (description: string, productInfo: ProductInfo, photos: File[], market: 'EU' | 'US', dimensions: PageDimensions, onProgress?: (msg: string) => void) => {
    setIsGenerating(true);
    try {
      const result = await generateProfessionalManual(description, productInfo, photos, market, onProgress);
      
      setPageDimensions(dimensions);
      setProjectId(uuidv4());
      setMetadata({ ...DEFAULT_METADATA, ...result.metadata, mode: 'professional' });
      
      const generatedPages: ManualPage[] = result.pages.map((p: any) => ({
        id: uuidv4(),
        type: (p.type.toLowerCase() === 'cover' ? 'cover' : p.type) as any,
        title: p.title,
        layoutStyle: (p.type.toLowerCase() === 'cover' || p.type.toLowerCase() === 'back_cover') ? 'style-pdf' : undefined,
        steps: p.steps.map((s: any) => ({
          id: uuidv4(),
          title: s.title,
          description: s.description,
          images: [],
          layout: s.layout || 'image_left_text_right'
        }))
      }));

      // Add TOC if missing
      if (!generatedPages.some(p => p.type === 'toc')) {
          generatedPages.splice(1, 0, { id: uuidv4(), type: 'toc', title: 'Table of Contents', steps: [] });
      }

      setPages(generatedPages);
      setPast([]);
      setFuture([]);
      setActivePageIndex(0);
      setHasStarted(true);
      
      // Apply professional reflow rules immediately
      setTimeout(() => reflowManual(), 500);
    } catch (error) {
      console.error("Professional generation failed:", error);
      alert("生成专业手册失败。请重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!hasStarted) {
    return (
      <StartScreen 
        onStart={handleStart} 
        onLoadProject={handleLoadProject} 
        onGenerateProfessional={(desc, productInfo, photos, market, dims, onProgress) => handleGenerateProfessional(desc, productInfo, photos, market, dims, onProgress)}
      />
    );
  }

  const renderPageIcon = (type: ManualPage['type']) => {
      switch(type) {
          case 'cover': return <i className="fas fa-book text-xs"></i>;
          case 'toc': return <i className="fas fa-list-ol text-xs"></i>;
          case 'back_cover': return <i className="fas fa-book-open fa-flip-horizontal text-xs"></i>;
          case 'preface': return <i className="fas fa-info-circle text-xs"></i>;
          case 'specifications': return <i className="fas fa-microchip text-xs"></i>;
          case 'safety': return <i className="fas fa-exclamation-triangle text-xs"></i>;
          case 'parameters': return <i className="fas fa-ruler-combined text-xs"></i>;
          case 'package_list': return <i className="fas fa-box-open text-xs"></i>;
          case 'diagram': return <i className="fas fa-project-diagram text-xs"></i>;
          case 'maintenance': return <i className="fas fa-tools text-xs"></i>;
          case 'troubleshooting': return <i className="fas fa-stethoscope text-xs"></i>;
          case 'compliance': return <i className="fas fa-certificate text-xs"></i>;
          default: return null;
      }
  }

  return (
    <div 
      className="flex flex-col h-[100dvh] bg-zinc-50 text-zinc-800 font-sans animate-fade-in overflow-hidden relative selection:bg-brand-100 selection:text-brand-900 overscroll-behavior-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-brand-500/5 blur-[120px] animate-pulse"></div>
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-emerald-500/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      {/* Top Navbar */}
      <nav className="bg-white/70 backdrop-blur-xl border-b border-zinc-200/50 px-6 h-16 flex items-center justify-between shadow-soft z-50 shrink-0 transition-all">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setHasStarted(false)}>
              <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center text-white shadow-glow group-hover:scale-110 transition-transform duration-300">
                <i className="fas fa-house text-lg"></i>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-extrabold text-lg text-zinc-900 tracking-tight leading-none group-hover:text-brand-600 transition-colors">ManualMaster</h1>
                <p className="text-xs text-zinc-500 font-bold tracking-wide uppercase">AI 文档工具</p>
              </div>
            </div>
        </div>

        <div className="flex items-center gap-3">
           {/* Save Status Indicator */}
           <div className="hidden md:flex flex-col items-end mr-2">
              <span className={`text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${isSaving ? 'text-brand-500 animate-pulse' : 'text-zinc-400'}`}>
                  {isSaving ? '保存中...' : '已保存'}
              </span>
              {lastSavedTime && !isSaving && (
                  <span className="text-xs text-zinc-300 font-medium">
                      {lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
              )}
           </div>

           {/* Save & History Controls */}
           <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-zinc-200 shadow-sm">
                <button 
                    onClick={() => saveProjectToHistory(true)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-95 ${isSaving ? 'text-brand-600 bg-brand-50' : 'text-zinc-500 hover:text-zinc-800 hover:bg-white hover:shadow-sm'}`}
                    title="手动保存"
                >
                    {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
                </button>
                <div className="w-px h-4 bg-zinc-200"></div>
                <button onClick={undo} disabled={past.length === 0} className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent active:scale-95 transition-all" title="撤销"><i className="fas fa-undo"></i></button>
                <button onClick={redo} disabled={future.length === 0} className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent active:scale-95 transition-all" title="重做"><i className="fas fa-redo"></i></button>
           </div>

           <div className="flex items-center gap-2">
             {metadata.isContinuousMode && (
               <button 
                 onClick={() => setIsPdfPreview(!isPdfPreview)}
                 className={`
                   h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border
                   ${isPdfPreview ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-surface-50'}
                 `}
                 title={isPdfPreview ? "退出 PDF 预览" : "PDF 预览"}
               >
                 <i className={`fas ${isPdfPreview ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                 <span className="hidden lg:inline">{isPdfPreview ? '退出预览' : 'PDF 预览'}</span>
               </button>
             )}
             <button 
              onClick={generatePDF}
              disabled={isGenerating}
              className={`
                h-10 px-6 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md btn-animated-glow
                ${isGenerating ? 'bg-zinc-100 text-zinc-400 cursor-wait' : 'bg-zinc-900 text-white shadow-zinc-900/20'}
              `}
            >
              {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-download"></i>}
              <span className="hidden sm:inline">{isGenerating ? '导出中...' : '导出 PDF'}</span>
            </button>
           </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-grow flex overflow-hidden">
        
        {/* Editor Side (Left) */}
        <div className={`
          flex-col h-full min-h-0 w-full md:w-[450px] lg:w-[500px] border-r border-zinc-200 bg-white/90 backdrop-blur-sm z-20 shadow-soft flex-shrink-0 overflow-hidden
          ${activeTab === 'preview' ? 'hidden md:flex' : 'flex'}
        `}>
          
          {/* Modern Page Navigator */}
          <div className="px-4 py-3 bg-white/80 backdrop-blur-md border-b border-zinc-100 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2 items-center sticky top-0 z-10 shadow-sm">
             {!pages.some(p => p.type === 'toc') && (
               <button onClick={addTocPage} className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-100 text-zinc-500 hover:bg-brand-50 hover:text-brand-600 transition-all hover:scale-110 flex items-center justify-center" title="插入目录">
                 <i className="fas fa-list-ol text-xs"></i>
               </button>
            )}
            {pages.map((page, idx) => (
              <button
                key={page.id}
                onClick={() => switchPage(idx)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border active:scale-95
                  ${activePageIndex === idx 
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-md transform scale-105' 
                    : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:bg-surface-50 hover:text-zinc-700'
                  }
                `}
              >
                {renderPageIcon(page.type)}
                {page.type === 'content' ? idx + 1 : ''}
              </button>
            ))}
            <button onClick={addNewPage} className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 transition-all hover:scale-110 flex items-center justify-center ml-1 border border-brand-100 shadow-sm">
              <i className="fas fa-plus text-xs"></i>
            </button>
            {!pages.some(p => p.type === 'back_cover') && (
                <button onClick={addBackCover} className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-100 text-zinc-500 hover:bg-surface-200 transition-all hover:scale-110 flex items-center justify-center" title="添加封底">
                    <i className="fas fa-book-open fa-flip-horizontal text-xs"></i>
                </button>
            )}
          </div>

          {/* Editor Header */}
          <div className="px-6 py-5 bg-white/50">
             <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">当前正在编辑</span>
                <div className="flex items-center gap-2">
                   {activePage.type === 'content' && <span className="text-xs font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-200">{activePage.steps.length} 步</span>}
                   {pages.length > 1 && (
                      <button 
                        onClick={() => deletePage(activePageIndex)}
                        className="text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full border border-red-100 transition-all active:scale-95"
                        title="删除当前页"
                      >
                        <i className="fas fa-trash-alt mr-1"></i> 删除页面
                      </button>
                   )}
                </div>
             </div>
             <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2 animate-slide-up">
                {activePage.type === 'cover' ? '封面' : activePage.type === 'back_cover' ? '封底' : activePage.type === 'toc' ? '目录' : `第 ${activePageIndex + 1} 页`}
             </h2>
          </div>

          <div id="steps-container" className="flex-1 overflow-y-auto px-6 pb-40 scroll-smooth custom-scrollbar">
            
            {/* Global Settings Accordion */}
            <div className={`mb-8 rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${isMetadataExpanded ? 'bg-surface-50 border-zinc-200' : 'bg-white border-zinc-100 hover:border-zinc-200'}`}>
              <button onClick={() => setIsMetadataExpanded(!isMetadataExpanded)} className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-50/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <div className="w-6 h-6 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-500"><i className="fas fa-sliders-h text-xs"></i></div>
                  文档设置
                </div>
                <i className={`fas fa-chevron-down text-zinc-400 transition-transform duration-300 ${isMetadataExpanded ? 'rotate-180' : ''}`}></i>
              </button>
              {isMetadataExpanded && (
                <div className="p-4 pt-0 grid gap-3 animate-slide-up">
                  <AutoResizeTextarea value={metadata.title} onChange={(e) => updateMetadata({ title: e.target.value })} className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm min-h-[60px]" placeholder="文档标题" />
                  <AutoResizeTextarea value={metadata.subtitle} onChange={(e) => updateMetadata({ subtitle: e.target.value })} className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm min-h-[60px]" placeholder="副标题" />
                  <div className="grid grid-cols-2 gap-3">
                    <AutoResizeTextarea value={metadata.author} onChange={(e) => updateMetadata({ author: e.target.value })} className="w-full p-2.5 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm min-h-[44px]" placeholder="作者" />
                    <AutoResizeTextarea value={metadata.version} onChange={(e) => updateMetadata({ version: e.target.value })} className="w-full p-2.5 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm min-h-[44px]" placeholder="版本" />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                     <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">显示步骤标记</span>
                     <button onClick={() => updateMetadata({ showStepMarkers: !metadata.showStepMarkers })} className={`w-11 h-6 rounded-full p-1 transition-all duration-300 ${metadata.showStepMarkers ? 'bg-brand-600 shadow-glow-sm' : 'bg-zinc-200'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${metadata.showStepMarkers ? 'translate-x-5' : 'translate-x-0'}`}></div>
                     </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                     <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">连续 PDF 模式</span>
                     <button onClick={() => updateMetadata({ isContinuousMode: !metadata.isContinuousMode })} className={`w-11 h-6 rounded-full p-1 transition-all duration-300 ${metadata.isContinuousMode ? 'bg-brand-600 shadow-glow-sm' : 'bg-zinc-200'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${metadata.isContinuousMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                     </button>
                  </div>

                  <div className="pt-4 border-t border-zinc-100">
                      <button 
                        onClick={reflowManual}
                        className="w-full py-2.5 bg-brand-50 text-brand-600 rounded-xl text-xs font-bold border border-brand-100 hover:bg-brand-100 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-compress-alt"></i> 紧凑文档 (自动流转)
                      </button>
                      <p className="text-xs text-zinc-400 mt-2 text-center">自动移动步骤以填充前几页的空白区域。</p>
                  </div>
                  
                  {/* Global Image Settings */}
                  <div className="pt-4 border-t border-zinc-100 space-y-4">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">图像布局默认值</h3>
                      <div>
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium text-zinc-600">单张图像大小</span>
                              <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">{metadata.singleImageSize || 100}%</span>
                          </div>
                          <input 
                              type="range" 
                              min="25" 
                              max="100" 
                              step="5"
                              value={metadata.singleImageSize || 100} 
                              onChange={(e) => updateMetadata({ singleImageSize: parseInt(e.target.value) })} 
                              className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
                          />
                      </div>
                  </div>
                </div>
              )}
            </div>
            
            {pages.map((page, pIdx) => (
              <div key={page.id} id={`editor-section-${page.id}`} className={`mb-12 pb-12 border-b border-zinc-100 last:border-0 last:mb-0 ${activePageIndex === pIdx ? 'ring-2 ring-brand-500/10 rounded-2xl p-2 -m-2' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    {renderPageIcon(page.type)}
                    {page.type === 'cover' ? 'Cover' : page.type === 'back_cover' ? 'Back Cover' : page.type === 'toc' ? 'TOC' : `Ch. ${pIdx + 1}: ${page.title || 'Untitled'}`}
                  </h3>
                  {pages.length > 1 && page.type !== 'cover' && (
                    <button 
                      onClick={() => deletePage(pIdx)}
                      className="text-[10px] font-bold text-red-400 hover:text-red-500 uppercase tracking-tighter flex items-center gap-1"
                    >
                      <i className="fas fa-trash-alt"></i> 删除章节
                    </button>
                  )}
                </div>

                {page.type === 'cover' && (
                    <CoverEditor 
                        page={page} 
                        onUpdate={(updates) => updatePage(page.id, updates)} 
                        metadata={metadata} 
                        onUpdateMetadata={updateMetadata}
                        contextSteps={getContextSteps()}
                    />
                )}
                {page.type === 'back_cover' && <BackCoverEditor page={page} onUpdate={(updates) => updatePage(page.id, updates)} />}
                
                {page.type === 'toc' && (
                    <div className="bg-surface-50 border border-zinc-200 rounded-2xl p-8 text-center flex flex-col items-center animate-slide-up shadow-sm">
                        <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 text-zinc-400 border border-zinc-100">
                            <i className="fas fa-list-ol text-2xl"></i>
                        </div>
                        <h3 className="font-bold text-zinc-800 mb-1">Auto-generated TOC</h3>
                        <p className="text-xs text-zinc-500 mb-6 max-w-[200px]">This page will automatically compile titles from all subsequent pages.</p>
                        <input type="text" value={page.title || ''} onChange={(e) => updatePageTitle(page.id, e.target.value)} className="w-full max-w-xs p-3 bg-white border border-zinc-200 rounded-xl text-center text-sm font-semibold focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm" placeholder="TOC Title" />
                    </div>
                )}

                {page.type !== 'cover' && page.type !== 'back_cover' && page.type !== 'toc' && (
                    <>
                        <div className="mb-6 relative animate-slide-up">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block flex justify-between items-center">
                                章节标题
                                <button onClick={() => handleAutoGeneratePageTitle(page.id)} disabled={isGeneratingTitle || page.steps.length === 0} className="text-brand-600 hover:text-brand-700 disabled:opacity-50 text-[10px] font-bold bg-brand-50 px-2 py-1 rounded-md transition-all hover:bg-brand-100">
                                    {isGeneratingTitle ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic mr-1"></i>} AI 标题
                                </button>
                            </label>
                            <AutoResizeTextarea value={page.title || ''} onChange={(e) => updatePageTitle(page.id, e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-base font-bold text-zinc-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm placeholder:text-zinc-300" placeholder="e.g. Safety Instructions" />
                        </div>

                        <div className="space-y-5 pb-6">
                            {page.steps.length === 0 && (
                                <div className="text-center py-10 border-2 border-dashed border-zinc-100 rounded-2xl bg-surface-50/50 animate-fade-in">
                                    <p className="text-xs font-medium text-zinc-400">No steps in this section.</p>
                                </div>
                            )}
                            {page.steps.map((step, sIdx) => (
                                <StepEditor 
                                    key={step.id} 
                                    index={sIdx} 
                                    step={step} 
                                    totalSteps={page.steps.length} 
                                    metadata={metadata}
                                    onUpdate={updateStep} 
                                    onDelete={deleteStep} 
                                    onMoveUp={() => moveStep(sIdx, 'up')} 
                                    onMoveDown={() => moveStep(sIdx, 'down')} 
                                />
                            ))}
                            <button onClick={() => addStepToPage(page.id)} className="w-full py-3 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 text-xs font-bold">
                                <i className="fas fa-plus"></i> 向此章节添加步骤
                            </button>
                        </div>
                    </>
                )}
              </div>
            ))}
          </div>

          <div className="p-6 bg-white/80 backdrop-blur-md border-t border-zinc-100 shrink-0 z-30">
            <button 
              onClick={() => {
                const lastContentPage = [...pages].reverse().find(p => p.type === 'content');
                if (lastContentPage) addStepToPage(lastContentPage.id);
                else addNewPage();
              }} 
              className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl shadow-xl shadow-zinc-900/20 btn-animated-glow flex items-center justify-center gap-2 group transform transition-all active:scale-95"
            >
                <i className="fas fa-plus text-xs group-hover:rotate-90 transition-transform duration-300"></i>
                <span className="tracking-wide">在末尾添加新步骤</span>
            </button>
          </div>
        </div>

        {/* Preview Side (Right) */}
        <div ref={previewContainerRef} className={`flex-col flex-grow min-h-0 bg-surface-100 relative ${activeTab === 'editor' ? 'hidden md:flex' : 'flex'} animate-fade-in overflow-y-auto custom-scrollbar`}>
          <div className="absolute inset-0 bg-dot-pattern [background-size:24px_24px] opacity-30 pointer-events-none"></div>
          
          <div className="md:hidden flex border-b border-zinc-200 bg-white shrink-0 z-20 sticky top-0">
            <button className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'editor' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50' : 'text-zinc-500 hover:text-zinc-800'}`} onClick={() => setActiveTab('editor')}>编辑器</button>
            <button className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'preview' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50' : 'text-zinc-500 hover:text-zinc-800'}`} onClick={() => setActiveTab('preview')}>预览</button>
          </div>

          <div className="p-4 md:p-8 pb-40">
            <Preview 
              pages={isPdfPreview || isExporting ? pdfPages : pages} 
              originalPages={pages}
              metadata={metadata} 
              dimensions={pageDimensions} 
              previewRef={previewRef}
              onPageOverflow={handlePageOverflow}
              isContinuous={metadata.isContinuousMode}
              isPdfPreview={isPdfPreview}
              isExporting={isExporting}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;