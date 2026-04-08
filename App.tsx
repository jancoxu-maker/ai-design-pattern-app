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
  const [activePageIndex, setActivePageIndex] = useState(0); 

  const saveProjectToHistory = useCallback(async (isManual: boolean = false) => {
    if (!hasStarted) return;
    setIsSaving(true);
    try {
      const projectData: SavedProject = { id: projectId, lastModified: Date.now(), metadata, pages, dimensions: pageDimensions };
      await saveProjectToDB(projectData);
      setLastSavedTime(new Date());
    } finally { setTimeout(() => setIsSaving(false), 500); }
  }, [pages, metadata, pageDimensions, projectId, hasStarted]);

  const handleStart = (dimensions: PageDimensions, mode: 'standard' | 'professional') => {
    setPageDimensions(dimensions);
    setProjectId(uuidv4());
    setMetadata({ ...DEFAULT_METADATA, mode, isContinuousMode: true });
    setPages([
      { id: uuidv4(), type: 'cover', title: 'Cover Page', steps: [], layoutStyle: 'style-pdf' },
      { id: uuidv4(), type: 'toc', title: 'Table of Contents', steps: [] },
      { id: uuidv4(), type: 'content', title: 'Getting Started', steps: [{ id: uuidv4(), title: 'Unboxing', description: 'Carefully remove the device from the packaging. Ensure all accessories are included in the box.', images: [], layout: 'image_left_text_right' }] }
    ]);
    setActivePageIndex(0);
    setHasStarted(true);
  };

  const handleLoadProject = (project: SavedProject) => {
      setProjectId(project.id);
      setMetadata({ ...DEFAULT_METADATA, ...project.metadata });
      setPages(project.pages);
      setPageDimensions(project.dimensions);
      setActivePageIndex(0);
      setHasStarted(true);
  };

  const handleGenerateProfessional = async (description: string, productInfo: ProductInfo, photos: File[], market: 'EU' | 'US', dimensions: PageDimensions, onProgress?: (msg: string) => void) => {
    setIsGenerating(true);
    try {
      const result = await generateProfessionalManual(description, productInfo, photos, market, onProgress);
      setPageDimensions(dimensions);
      setProjectId(uuidv4());
      setMetadata({ ...DEFAULT_METADATA, ...result.metadata, mode: 'professional' });
      
      const generatedPages: ManualPage[] = result.pages.map((p: any) => ({
        id: uuidv4(),
        type: (p?.type && typeof p.type === 'string' && ['cover', 'back_cover', 'toc', 'content'].includes(p.type.toLowerCase())) ? p.type.toLowerCase() : 'content',
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
      setActivePageIndex(0); setHasStarted(true);
    } catch (error) { console.error("Professional generation failed:", error); alert("生成专业手册失败。"); } finally { setIsGenerating(false); }
  };

  if (!hasStarted) return <StartScreen onStart={handleStart} onLoadProject={handleLoadProject} onGenerateProfessional={handleGenerateProfessional} />;

  return (
    <div className=\"flex flex-col h-[100dvh] bg-zinc-50 text-zinc-800 font-sans overflow-hidden\">
      <nav className=\"bg-white/70 backdrop-blur-xl border-b border-zinc-200/50 px-6 h-16 flex items-center justify-between shadow-soft z-50 shrink-0\">
        <div className=\"flex items-center gap-4\">
            <div className=\"flex items-center gap-3 cursor-pointer\" onClick={() => setHasStarted(false)}>
              <div className=\"w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center text-white shadow-glow\">
                <i className=\"fas fa-house text-lg\"></i>
              </div>
              <div className=\"hidden sm:block\">
                <h1 className=\"font-extrabold text-lg text-zinc-900 tracking-tight leading-none\">ManualMaster</h1>
              </div>
            </div>
        </div>
      </nav>

      <div className=\"flex-grow flex overflow-hidden\">
        <div className=\"flex-col h-full w-full md:w-[500px] border-r bg-white/90 z-20 overflow-y-auto\">
             <div className=\"p-6\">
                <h2 className=\"text-xl font-bold mb-4\">编辑器</h2>
                {/* 简化编辑器渲染 */}
             </div>
        </div>

        <div className=\"flex-grow bg-zinc-100 overflow-y-auto\" ref={previewContainerRef}>
          <Preview pages={pages} metadata={metadata} dimensions={pageDimensions} previewRef={previewRef} />
        </div>
      </div>
    </div>
  );
};

export default App;
