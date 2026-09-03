import React from 'react';

interface FormattedMarkdownProps {
  text: string;
}

export function FormattedMarkdown({ text }: FormattedMarkdownProps) {
  if (!text) return null;

  // Clean up any outer quotes or escaped quotes
  const cleanedText = text
    .replace(/^["']|["']$/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n');

  // Split into lines
  const lines = cleanedText.split('\n');

  return (
    <div className="space-y-2 text-xs text-foreground/90 font-sans leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Header 3 / 4
        if (trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
          const headerText = trimmed.replace(/^#+\s*/, '');
          return (
            <h4 key={idx} className="font-bold text-sky-400 mt-3 mb-1 text-xs tracking-wide uppercase">
              {headerText}
            </h4>
          );
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="text-sky-400 font-bold shrink-0 mt-0.5">•</span>
              <span>{renderFormattedInline(content)}</span>
            </div>
          );
        }

        // Standard paragraph line
        return (
          <p key={idx} className="my-1">
            {renderFormattedInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function renderFormattedInline(text: string): React.ReactNode {
  // Simple inline parser for **bold** text
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
