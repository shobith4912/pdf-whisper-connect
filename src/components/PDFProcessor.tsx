import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Disable worker for offline reliability - process in main thread
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export interface OutlineItem {
  level: 'H1' | 'H2' | 'H3';
  text: string;
  page: number;
}

export interface PDFOutline {
  title: string;
  outline: OutlineItem[];
}

export interface PersonaAnalysis {
  metadata: {
    documents: string[];
    persona: string;
    jobToBeDone: string;
    timestamp: string;
  };
  extractedSections: Array<{
    document: string;
    pageNumber: number;
    sectionTitle: string;
    importanceRank: number;
  }>;
  subSectionAnalysis: Array<{
    document: string;
    refinedText: string;
    pageNumber: number;
  }>;
}

export const usePDFProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const extractPDFOutline = async (file: File): Promise<PDFOutline> => {
    setIsProcessing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const outline: OutlineItem[] = [];
      let title = file.name.replace('.pdf', '');
      
      // Extract title from metadata with proper typing
      try {
        const metadata = await pdf.getMetadata();
        if (metadata.info && typeof metadata.info === 'object' && 'Title' in metadata.info) {
          const titleValue = (metadata.info as any).Title;
          if (typeof titleValue === 'string' && titleValue.trim()) {
            title = titleValue;
          }
        }
      } catch (e) {
        // Fallback to filename
      }
      
      // Process pages to find headings
      const numPages = Math.min(pdf.numPages, 25); // Limit for performance
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Simple heading detection based on font size and position
          const items = textContent.items.filter(item => 
            'str' in item && (item as any).str.trim().length > 0
          ) as any[];
          
          if (items.length === 0) continue;
          
          // Find potential headings by font size
          const fontSizes = new Map<number, any[]>();
          items.forEach(item => {
            if (item.height && item.str) {
              const height = Math.round(item.height);
              if (!fontSizes.has(height)) {
                fontSizes.set(height, []);
              }
              fontSizes.get(height)!.push(item);
            }
          });
          
          // Get largest font sizes (likely headings)
          const sortedSizes = Array.from(fontSizes.keys()).sort((a, b) => b - a);
          
          sortedSizes.slice(0, 3).forEach((size, index) => {
            const sizeItems = fontSizes.get(size) || [];
            sizeItems.forEach(item => {
              const text = item.str.trim();
              if (text.length > 5 && text.length < 100 && /^[A-Z]/.test(text)) {
                const level = index === 0 ? 'H1' : index === 1 ? 'H2' : 'H3';
                outline.push({
                  level: level as any,
                  text,
                  page: pageNum
                });
              }
            });
          });
        } catch (pageError) {
          console.log(`Skipping page ${pageNum} due to error:`, pageError);
        }
      }
      
      // Remove duplicates and sort by page
      const uniqueOutline = outline
        .filter((item, index, arr) => 
          arr.findIndex(other => other.text === item.text && other.page === item.page) === index
        )
        .sort((a, b) => a.page - b.page);
      
      return { title, outline: uniqueOutline };
      
    } catch (error) {
      console.error('PDF processing error:', error);
      throw new Error('Could not process PDF file. Please try a different file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeDocumentsForPersona = async (
    files: File[],
    persona: string,
    jobToBeDone: string
  ): Promise<PersonaAnalysis> => {
    setIsProcessing(true);
    
    try {
      const extractedSections: PersonaAnalysis['extractedSections'] = [];
      const subSectionAnalysis: PersonaAnalysis['subSectionAnalysis'] = [];
      
      // Process each file
      for (const file of files.slice(0, 5)) { // Limit files for reliability
        try {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          const numPages = Math.min(pdf.numPages, 10); // Limit pages
          
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              
              const pageText = textContent.items
                .filter(item => 'str' in item)
                .map(item => (item as any).str)
                .join(' ')
                .trim();
              
              if (pageText.length < 100) continue;
              
              // Simple relevance scoring
              const relevanceScore = calculateRelevance(pageText, persona, jobToBeDone);
              
              if (relevanceScore > 0.3) {
                extractedSections.push({
                  document: file.name,
                  pageNumber: pageNum,
                  sectionTitle: `Page ${pageNum} Content`,
                  importanceRank: Math.round(relevanceScore * 10)
                });
                
                // Extract key sentences
                const sentences = pageText.split(/[.!?]+/)
                  .filter(s => s.trim().length > 50)
                  .slice(0, 3);
                
                if (sentences.length > 0) {
                  subSectionAnalysis.push({
                    document: file.name,
                    refinedText: sentences.join('. ') + '.',
                    pageNumber: pageNum
                  });
                }
              }
            } catch (pageError) {
              console.log(`Skipping page ${pageNum} of ${file.name}`);
            }
          }
        } catch (fileError) {
          console.log(`Skipping file ${file.name}`);
        }
      }
      
      // Sort by relevance
      extractedSections.sort((a, b) => b.importanceRank - a.importanceRank);
      
      return {
        metadata: {
          documents: files.map(f => f.name),
          persona,
          jobToBeDone,
          timestamp: new Date().toISOString()
        },
        extractedSections: extractedSections.slice(0, 10),
        subSectionAnalysis: subSectionAnalysis.slice(0, 15)
      };
      
    } catch (error) {
      console.error('Persona analysis error:', error);
      throw new Error('Could not analyze documents. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    extractPDFOutline,
    analyzeDocumentsForPersona,
    isProcessing
  };
};

// Simple relevance calculation
function calculateRelevance(text: string, persona: string, jobToBeDone: string): number {
  const lowerText = text.toLowerCase();
  const personaWords = persona.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const jobWords = jobToBeDone.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  let score = 0;
  const totalWords = lowerText.split(/\s+/).length;
  
  // Count persona keyword matches
  personaWords.forEach(word => {
    const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    score += matches / totalWords;
  });
  
  // Count job keyword matches (higher weight)
  jobWords.forEach(word => {
    const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    score += (matches / totalWords) * 1.5;
  });
  
  return Math.min(score, 1);
}