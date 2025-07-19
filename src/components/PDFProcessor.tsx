import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const outline: OutlineItem[] = [];
      let title = file.name.replace('.pdf', '');
      
      // Try to get document info for title
      try {
        const info = await pdf.getMetadata();
        if (info.info && typeof info.info === 'object' && 'Title' in info.info && info.info.Title) {
          title = info.info.Title as string;
        }
      } catch (error) {
        console.warn('Could not extract metadata:', error);
      }

      // Process each page
      for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 50); pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Analyze text items for headings
        const textItems = textContent.items.filter(item => 
          'str' in item && item.str.trim().length > 0
        ) as any[];
        
        // Group by font size and detect headings
        const fontSizes = new Map<number, string[]>();
        
        textItems.forEach(item => {
          if (item.height && item.str) {
            const fontSize = Math.round(item.height);
            if (!fontSizes.has(fontSize)) {
              fontSizes.set(fontSize, []);
            }
            fontSizes.get(fontSize)!.push(item.str.trim());
          }
        });
        
        // Sort font sizes (largest first)
        const sortedSizes = Array.from(fontSizes.keys()).sort((a, b) => b - a);
        
        // Detect headings based on font size patterns
        sortedSizes.slice(0, 4).forEach((fontSize, index) => {
          const texts = fontSizes.get(fontSize) || [];
          texts.forEach(text => {
            if (text.length > 3 && text.length < 100 && !text.includes('.') && /^[A-Z]/.test(text)) {
              const level = index === 0 ? 'H1' : index === 1 ? 'H2' : 'H3';
              outline.push({
                level: level as 'H1' | 'H2' | 'H3',
                text: text,
                page: pageNum
              });
            }
          });
        });
      }
      
      // Remove duplicates and sort
      const uniqueOutline = outline.filter((item, index, arr) => 
        arr.findIndex(other => other.text === item.text && other.page === item.page) === index
      ).sort((a, b) => a.page - b.page);
      
      return {
        title,
        outline: uniqueOutline
      };
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw new Error('Failed to process PDF. Please ensure it\'s a valid PDF file.');
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
      const documents = files.map(f => f.name);
      const extractedSections: PersonaAnalysis['extractedSections'] = [];
      const subSectionAnalysis: PersonaAnalysis['subSectionAnalysis'] = [];
      
      // Process each document
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .filter(item => 'str' in item)
            .map(item => (item as any).str)
            .join(' ');
          
          // Simple relevance scoring based on keyword matching
          const relevanceScore = calculateRelevanceScore(pageText, persona, jobToBeDone);
          
          if (relevanceScore > 0.3) {
            extractedSections.push({
              document: file.name,
              pageNumber: pageNum,
              sectionTitle: `Page ${pageNum} Content`,
              importanceRank: Math.round(relevanceScore * 10)
            });
            
            // Extract key subsections
            const sentences = pageText.split('.').filter(s => s.trim().length > 20);
            const relevantSentences = sentences
              .filter(sentence => calculateRelevanceScore(sentence, persona, jobToBeDone) > 0.4)
              .slice(0, 3);
            
            if (relevantSentences.length > 0) {
              subSectionAnalysis.push({
                document: file.name,
                refinedText: relevantSentences.join('. ') + '.',
                pageNumber: pageNum
              });
            }
          }
        }
      }
      
      // Sort by importance
      extractedSections.sort((a, b) => b.importanceRank - a.importanceRank);
      
      return {
        metadata: {
          documents,
          persona,
          jobToBeDone,
          timestamp: new Date().toISOString()
        },
        extractedSections: extractedSections.slice(0, 10), // Top 10 sections
        subSectionAnalysis: subSectionAnalysis.slice(0, 15) // Top 15 subsections
      };
    } catch (error) {
      console.error('Error analyzing documents:', error);
      throw new Error('Failed to analyze documents for persona.');
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

// Simple relevance scoring function
function calculateRelevanceScore(text: string, persona: string, jobToBeDone: string): number {
  const lowerText = text.toLowerCase();
  const personaKeywords = persona.toLowerCase().split(' ');
  const jobKeywords = jobToBeDone.toLowerCase().split(' ');
  
  let score = 0;
  const totalWords = lowerText.split(' ').length;
  
  // Score based on persona keywords
  personaKeywords.forEach(keyword => {
    if (keyword.length > 2) {
      const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
      score += matches / totalWords;
    }
  });
  
  // Score based on job keywords
  jobKeywords.forEach(keyword => {
    if (keyword.length > 2) {
      const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
      score += matches / totalWords * 1.5; // Job keywords weighted higher
    }
  });
  
  return Math.min(score, 1);
}