import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Star, Clock } from 'lucide-react';
import { PDFOutline, PersonaAnalysis } from './PDFProcessor';

interface ResultsDisplayProps {
  outlineResults?: PDFOutline[];
  personaResults?: PersonaAnalysis;
  mode: 'outline' | 'persona';
}

export const ResultsDisplay = ({ outlineResults, personaResults, mode }: ResultsDisplayProps) => {
  const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (mode === 'outline' && outlineResults) {
    return (
      <div className="space-y-4">
        {outlineResults.map((result, index) => (
          <Card key={index} className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Outline: {result.title}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadJSON(result, `${result.title}_outline.json`)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download JSON
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {result.outline.length === 0 ? (
                    <p className="text-muted-foreground">No headings detected in this document.</p>
                  ) : (
                    result.outline.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          <Badge variant={
                            item.level === 'H1' ? 'default' : 
                            item.level === 'H2' ? 'secondary' : 'outline'
                          }>
                            {item.level}
                          </Badge>
                          <span className={`${
                            item.level === 'H1' ? 'font-bold' :
                            item.level === 'H2' ? 'font-semibold' : 'font-medium'
                          }`}>
                            {item.text}
                          </span>
                        </div>
                        <Badge variant="outline">Page {item.page}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (mode === 'persona' && personaResults) {
    return (
      <div className="space-y-6">
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Persona Analysis Results
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadJSON(personaResults, 'persona_analysis.json')}
            >
              <Download className="h-4 w-4 mr-2" />
              Download JSON
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metadata */}
            <div className="space-y-3">
              <h4 className="font-semibold">Analysis Metadata</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Persona:</Label>
                  <p className="text-sm text-muted-foreground">{personaResults.metadata.persona}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Job to be Done:</Label>
                  <p className="text-sm text-muted-foreground">{personaResults.metadata.jobToBeDone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Documents Analyzed:</Label>
                  <p className="text-sm text-muted-foreground">{personaResults.metadata.documents.join(', ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <Label className="text-sm font-medium">Processed:</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(personaResults.metadata.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Extracted Sections */}
            <div className="space-y-3">
              <h4 className="font-semibold">Top Relevant Sections</h4>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {personaResults.extractedSections.map((section, index) => (
                    <div key={index} className="p-3 border rounded flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="default">Rank {section.importanceRank}</Badge>
                          <span className="font-medium">{section.sectionTitle}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {section.document} - Page {section.pageNumber}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <Separator />

            {/* Sub-section Analysis */}
            <div className="space-y-3">
              <h4 className="font-semibold">Key Insights</h4>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {personaResults.subSectionAnalysis.map((analysis, index) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{analysis.document}</Badge>
                        <Badge variant="outline">Page {analysis.pageNumber}</Badge>
                      </div>
                      <p className="text-sm">{analysis.refinedText}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

const Label = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <label className={`block text-sm font-medium ${className}`}>{children}</label>
);