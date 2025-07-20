import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, File, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PDFUploaderProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
  mode: 'outline' | 'persona';
}

export const PDFUploader = ({ onFilesSelected, isProcessing, mode }: PDFUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const maxFiles = mode === 'outline' ? 1 : 10;
  const minFiles = mode === 'outline' ? 1 : 3;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf'
    );

    if (files.length === 0) {
      toast({
        title: "Invalid files",
        description: "Please upload only PDF files.",
        variant: "destructive",
      });
      return;
    }

    if (files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} PDF${maxFiles > 1 ? 's' : ''} allowed for ${mode} mode.`,
        variant: "destructive",
      });
      return;
    }

    if (mode === 'persona' && files.length < minFiles) {
      toast({
        title: "Not enough files",
        description: `Minimum ${minFiles} PDFs required for persona analysis.`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(files);
    onFilesSelected(files);
  }, [maxFiles, mode, onFilesSelected, toast]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} PDF${maxFiles > 1 ? 's' : ''} allowed for ${mode} mode.`,
        variant: "destructive",
      });
      return;
    }

    if (mode === 'persona' && files.length < minFiles) {
      toast({
        title: "Not enough files",
        description: `Minimum ${minFiles} PDFs required for persona analysis.`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(files);
    onFilesSelected(files);
  }, [maxFiles, mode, onFilesSelected, toast]);

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload PDF{maxFiles > 1 ? 's' : ''} for {mode === 'outline' ? 'Outline Extraction' : 'Persona Analysis'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple={maxFiles > 1}
            accept=".pdf"
            onChange={handleInputChange}
            className="hidden"
            id="pdf-upload"
            disabled={isProcessing}
          />
          <label htmlFor="pdf-upload" className="cursor-pointer">
            {isProcessing ? (
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            ) : (
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            )}
            <p className="text-lg font-medium mb-2">
              {isProcessing
                ? 'Processing...'
                : `Drop PDF${maxFiles > 1 ? 's' : ''} here or click to upload`}
            </p>
            <p className="text-sm text-muted-foreground">
              {mode === 'persona' ? `${minFiles}-${maxFiles} files required` : `Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''}`}, up to 50 pages each
            </p>
          </label>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium">Selected Files:</h4>
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4" />
                  <span className="text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={isProcessing}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};