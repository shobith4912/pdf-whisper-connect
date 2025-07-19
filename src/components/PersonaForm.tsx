import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { User, Target } from 'lucide-react';

interface PersonaFormProps {
  onSubmit: (persona: string, jobToBeDone: string) => void;
  isProcessing: boolean;
}

export const PersonaForm = ({ onSubmit, isProcessing }: PersonaFormProps) => {
  const [persona, setPersona] = useState('');
  const [jobToBeDone, setJobToBeDone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (persona.trim() && jobToBeDone.trim()) {
      onSubmit(persona.trim(), jobToBeDone.trim());
    }
  };

  const examplePersonas = [
    {
      persona: "PhD Researcher in Computational Biology",
      job: "Prepare a comprehensive literature review focusing on methodologies, datasets, and performance benchmarks"
    },
    {
      persona: "Investment Analyst",
      job: "Analyze revenue trends, R&D investments, and market positioning strategies"
    },
    {
      persona: "Undergraduate Chemistry Student",
      job: "Identify key concepts and mechanisms for exam preparation on reaction kinetics"
    }
  ];

  const loadExample = (example: typeof examplePersonas[0]) => {
    setPersona(example.persona);
    setJobToBeDone(example.job);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Define Persona & Task
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="persona" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Persona Description
            </Label>
            <Textarea
              id="persona"
              placeholder="e.g., PhD Researcher in Computational Biology, Investment Analyst, Undergraduate Chemistry Student..."
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="job" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Job to be Done
            </Label>
            <Textarea
              id="job"
              placeholder="e.g., Prepare a comprehensive literature review focusing on methodologies, datasets, and performance benchmarks..."
              value={jobToBeDone}
              onChange={(e) => setJobToBeDone(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-3">
            <Label>Quick Examples:</Label>
            <div className="grid gap-3">
              {examplePersonas.map((example, index) => (
                <Card 
                  key={index} 
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => loadExample(example)}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{example.persona}</p>
                    <p className="text-xs text-muted-foreground">{example.job}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={!persona.trim() || !jobToBeDone.trim() || isProcessing}
            className="w-full"
          >
            {isProcessing ? 'Analyzing Documents...' : 'Analyze Documents'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};