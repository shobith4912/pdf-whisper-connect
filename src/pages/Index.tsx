import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PDFUploader } from '@/components/PDFUploader';
import { PersonaForm } from '@/components/PersonaForm';
import { ResultsDisplay } from '@/components/ResultsDisplay';
import { usePDFProcessor, PDFOutline, PersonaAnalysis } from '@/components/PDFProcessor';
import { useToast } from '@/hooks/use-toast';
import { FileText, Users, Zap } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState('outline');
  const [outlineFiles, setOutlineFiles] = useState<File[]>([]);
  const [personaFiles, setPersonaFiles] = useState<File[]>([]);
  const [outlineResults, setOutlineResults] = useState<PDFOutline[]>([]);
  const [personaResults, setPersonaResults] = useState<PersonaAnalysis | null>(null);
  
  const { extractPDFOutline, analyzeDocumentsForPersona, isProcessing } = usePDFProcessor();
  const { toast } = useToast();

  const handleOutlineExtraction = async () => {
    if (outlineFiles.length === 0) return;
    
    try {
      const results = await Promise.all(
        outlineFiles.map(file => extractPDFOutline(file))
      );
      setOutlineResults(results);
      toast({
        title: "Success!",
        description: `Extracted outlines from ${results.length} document${results.length > 1 ? 's' : ''}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process PDF",
        variant: "destructive",
      });
    }
  };

  const handlePersonaAnalysis = async (persona: string, jobToBeDone: string) => {
    if (personaFiles.length === 0) return;
    
    try {
      const result = await analyzeDocumentsForPersona(personaFiles, persona, jobToBeDone);
      setPersonaResults(result);
      toast({
        title: "Analysis Complete!",
        description: `Found ${result.extractedSections.length} relevant sections across ${personaFiles.length} documents.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze documents",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            PDF Whisper Connect
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            Adobe Hackathon: Connecting the Dots Challenge
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Fast Processing
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Smart Extraction
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Persona-Driven
            </div>
          </div>
        </div>

        {/* Main Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="outline" className="text-center">
              Round 1A: Document Outline
            </TabsTrigger>
            <TabsTrigger value="persona" className="text-center">
              Round 1B: Persona Analysis
            </TabsTrigger>
          </TabsList>

          {/* Round 1A: Outline Extraction */}
          <TabsContent value="outline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Round 1A: Extract Document Structure</CardTitle>
                <p className="text-muted-foreground">
                  Upload a PDF to extract its hierarchical outline (Title, H1, H2, H3) with page numbers.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <PDFUploader
                  onFilesSelected={(files) => {
                    setOutlineFiles(files);
                    if (files.length > 0) {
                      handleOutlineExtraction();
                    }
                  }}
                  isProcessing={isProcessing}
                  mode="outline"
                />
                
                {outlineResults.length > 0 && (
                  <ResultsDisplay
                    outlineResults={outlineResults}
                    mode="outline"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Round 1B: Persona Analysis */}
          <TabsContent value="persona" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <PDFUploader
                  onFilesSelected={setPersonaFiles}
                  isProcessing={isProcessing}
                  mode="persona"
                />
                
                {personaFiles.length >= 3 && (
                  <PersonaForm
                    onSubmit={handlePersonaAnalysis}
                    isProcessing={isProcessing}
                    filesCount={personaFiles.length}
                  />
                )}
              </div>
              
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Round 1B: Persona-Driven Analysis</CardTitle>
                    <p className="text-muted-foreground">
                      Upload multiple PDFs and define a persona with their job-to-be-done to extract relevant sections.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="font-medium">How it works:</h4>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>Upload 3-10 related PDF documents</li>
                          <li>Define the persona (role & expertise)</li>
                          <li>Specify their job-to-be-done</li>
                          <li>Get ranked relevant sections</li>
                        </ol>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">Example Use Cases:</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Research literature review</li>
                          <li>Financial report analysis</li>
                          <li>Educational content extraction</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            {personaResults && (
              <ResultsDisplay
                personaResults={personaResults}
                mode="persona"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
