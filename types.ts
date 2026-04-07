
export interface ProductInfo {
  brandName: string;
  productNameAndModel: string;
  coreFeatures: string;
  specifications: string;
  installationUsage: string;
  packageList: string;
  euRepresentative: string;
  ukRepresentative: string;
  manufacturerInfo: string;
}

export type StepLayout = 'image_left_text_right' | 'text_left_image_right' | 'image_top_text_bottom' | 'text_top_image_bottom' | 'text_only';

export interface StepImage {
  id: string;
  url: string;
  file?: File;
  width?: number; // percentage (0-100)
  height?: number; // percentage (0-100)
}

export interface ManualStep {
  id: string;
  title: string;
  description: string;
  images: StepImage[];
  layout: StepLayout;
  imagesPerRow?: number;
  isSectionHeader?: boolean;
  sourcePageType?: string;
}

export interface CoverDesign {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  layoutMode: 'centered' | 'split' | 'overlay' | 'card' | 'minimal';
  fontStyle: 'serif' | 'sans' | 'mono';
  overlayOpacity?: number;
}

export interface ManualPage {
  id: string;
  type: 'content' | 'toc' | 'cover' | 'back_cover' | 'preface' | 'specifications' | 'safety' | 'parameters' | 'package_list' | 'diagram' | 'maintenance' | 'troubleshooting' | 'compliance';
  title?: string; // Used for TOC entry
  steps: ManualStep[];
  backgroundImage?: StepImage;
  customText?: string;
  layoutStyle?: string; // 'style-1' | 'style-2' | 'style-3' | 'style-4' | 'style-5'
  coverDesign?: CoverDesign;
}

export interface ManualMetadata {
  title: string;
  subtitle: string;
  author: string;
  version: string;
  showStepMarkers: boolean;
  // Global Image Settings
  singleImageSize: number; // Default size for single images (percentage)
  imagesPerRow: number; // Default grid columns for multiple images (1-6)
  mode?: 'standard' | 'professional';
  isContinuousMode?: boolean;
}

export interface AIResponse {
  refinedTitle: string;
  refinedDescription: string;
}

export interface PageDimensions {
  width: number;
  height: number;
  name: string;
}

export interface SavedProject {
  id: string;
  lastModified: number;
  metadata: ManualMetadata;
  pages: ManualPage[];
  dimensions: PageDimensions;
}