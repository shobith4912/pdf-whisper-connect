import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker for offline use
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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
      
      // Process documents in parallel for better performance
      const documentPromises = files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const docSections: PersonaAnalysis['extractedSections'] = [];
        const docSubsections: PersonaAnalysis['subSectionAnalysis'] = [];
        
        // Process pages in parallel
        const pagePromises = [];
        const maxPages = Math.min(pdf.numPages, 15);
        
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          pagePromises.push(
            pdf.getPage(pageNum).then(async (page) => {
              const textContent = await page.getTextContent();
              
              const pageText = textContent.items
                .filter(item => 'str' in item)
                .map(item => (item as any).str)
                .join(' ')
                .trim();
              
              if (pageText.length < 50) return { sections: [], subsections: [] };
              
              // Enhanced relevance scoring
              const relevanceScore = calculateEnhancedRelevanceScore(pageText, persona, jobToBeDone);
              
              // Extract meaningful sections (paragraphs, headings)
              const sections = extractMeaningSections(pageText);
              const pageSections: PersonaAnalysis['extractedSections'] = [];
              const pageSubsections: PersonaAnalysis['subSectionAnalysis'] = [];
              
              sections.forEach((section, index) => {
                const sectionScore = calculateEnhancedRelevanceScore(section.text, persona, jobToBeDone);
                
                if (sectionScore > 0.2) {
                  pageSections.push({
                    document: file.name,
                    pageNumber: pageNum,
                    sectionTitle: section.title || `Section ${index + 1}`,
                    importanceRank: Math.round(sectionScore * 10)
                  });
                  
                  // Extract relevant subsections
                  const sentences = section.text.split(/[.!?]+/).filter(s => s.trim().length > 30);
                  const relevantSentences = sentences
                    .map(sentence => ({
                      text: sentence.trim(),
                      score: calculateEnhancedRelevanceScore(sentence, persona, jobToBeDone)
                    }))
                    .filter(item => item.score > 0.3)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 2);
                  
                  if (relevantSentences.length > 0) {
                    pageSubsections.push({
                      document: file.name,
                      refinedText: relevantSentences.map(s => s.text).join('. ') + '.',
                      pageNumber: pageNum
                    });
                  }
                }
              });
              
              return { sections: pageSections, subsections: pageSubsections };
            })
          );
        }
        
        const pageResults = await Promise.all(pagePromises);
        pageResults.forEach(result => {
          docSections.push(...result.sections);
          docSubsections.push(...result.subsections);
        });
        
        return { sections: docSections, subsections: docSubsections };
      });
      
      const documentResults = await Promise.all(documentPromises);
      documentResults.forEach(result => {
        extractedSections.push(...result.sections);
        subSectionAnalysis.push(...result.subsections);
      });
      
      // Sort by importance and limit results
      extractedSections.sort((a, b) => b.importanceRank - a.importanceRank);
      
      return {
        metadata: {
          documents,
          persona,
          jobToBeDone,
          timestamp: new Date().toISOString()
        },
        extractedSections: extractedSections.slice(0, 15),
        subSectionAnalysis: subSectionAnalysis.slice(0, 20)
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

// Enhanced relevance scoring function
function calculateEnhancedRelevanceScore(text: string, persona: string, jobToBeDone: string): number {
  const lowerText = text.toLowerCase();
  const personaKeywords = extractKeywords(persona.toLowerCase());
  const jobKeywords = extractKeywords(jobToBeDone.toLowerCase());
  
  let score = 0;
  const words = lowerText.split(/\s+/);
  const totalWords = words.length;
  
  if (totalWords === 0) return 0;
  
  // Score based on persona keywords with context
  personaKeywords.forEach(keyword => {
    if (keyword.length > 2) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = (lowerText.match(regex) || []).length;
      score += (matches / totalWords) * 0.8;
      
      // Bonus for keyword proximity to other relevant terms
      const contextBonus = calculateContextBonus(lowerText, keyword, [...personaKeywords, ...jobKeywords]);
      score += contextBonus;
    }
  });
  
  // Score based on job keywords with higher weight
  jobKeywords.forEach(keyword => {
    if (keyword.length > 2) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = (lowerText.match(regex) || []).length;
      score += (matches / totalWords) * 1.2;
      
      // Bonus for keyword proximity
      const contextBonus = calculateContextBonus(lowerText, keyword, [...personaKeywords, ...jobKeywords]);
      score += contextBonus * 1.2;
    }
  });
  
  // Bonus for academic/professional terms
  const professionalTerms = ['analysis', 'research', 'study', 'method', 'approach', 'results', 'conclusion', 'data', 'findings'];
  professionalTerms.forEach(term => {
    if (lowerText.includes(term)) {
      score += 0.1;
    }
  });
  
  return Math.min(score, 1);
}

// Extract meaningful keywords from text
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall']);
  
  return text.split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .map(word => word.replace(/[^\w]/g, ''))
    .filter(word => word.length > 2);
}

// Calculate context bonus for keyword proximity
function calculateContextBonus(text: string, keyword: string, allKeywords: string[]): number {
  const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
  let match;
  let bonus = 0;
  
  while ((match = regex.exec(text)) !== null) {
    const contextStart = Math.max(0, match.index - 100);
    const contextEnd = Math.min(text.length, match.index + keyword.length + 100);
    const context = text.slice(contextStart, contextEnd).toLowerCase();
    
    // Check for other keywords in proximity
    allKeywords.forEach(otherKeyword => {
      if (otherKeyword !== keyword && context.includes(otherKeyword)) {
        bonus += 0.05;
      }
    });
  }
  
  return Math.min(bonus, 0.3);
}

// Extract meaningful sections from text
function extractMeaningSections(text: string): Array<{ title: string; text: string }> {
  const sections: Array<{ title: string; text: string }> = [];
  
  // Split by double line breaks or long whitespace to identify paragraphs
  const paragraphs = text.split(/\n\s*\n|\.\s{3,}/).filter(p => p.trim().length > 50);
  
  paragraphs.forEach((paragraph, index) => {
    const cleanParagraph = paragraph.trim();
    if (cleanParagraph.length > 50) {
      // Try to identify if first sentence could be a title/heading
      const sentences = cleanParagraph.split(/[.!?]+/);
      const firstSentence = sentences[0]?.trim();
      
      let title = `Paragraph ${index + 1}`;
      let content = cleanParagraph;
      
      // If first sentence is short and looks like a heading, use it as title
      if (firstSentence && firstSentence.length < 80 && firstSentence.length > 10 && sentences.length > 1) {
        title = firstSentence;
        content = sentences.slice(1).join('. ').trim();
      }
      
      sections.push({ title, text: content });
    }
  });
  
  // If no clear paragraphs, split by sentences and group them
  if (sections.length === 0) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 30);
    const chunkSize = Math.max(3, Math.min(8, Math.floor(sentences.length / 4)));
    
    for (let i = 0; i < sentences.length; i += chunkSize) {
      const chunk = sentences.slice(i, i + chunkSize);
      if (chunk.length > 0) {
        sections.push({
          title: `Section ${Math.floor(i / chunkSize) + 1}`,
          text: chunk.join('. ').trim() + '.'
        });
      }
    }
  }
  
  return sections;
}