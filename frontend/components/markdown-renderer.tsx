import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Simple markdown renderer for patient-friendly discharge summary content
 * Handles headers, bullet points, numbered lists, and basic formatting
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content || typeof content !== 'string') {
    return <span className={className}>N/A</span>;
  }

  const parseMarkdown = (text: string): JSX.Element[] => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
    let listKey = 0;

    const flushList = () => {
      if (currentList) {
        if (currentList.type === 'ul') {
          elements.push(
            <ul key={`list-${listKey++}`} className="list-disc list-inside space-y-1 ml-2">
              {currentList.items.map((item, idx) => (
                <li key={idx} className="text-muted-foreground">
                  {parseInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
        } else {
          elements.push(
            <ol key={`list-${listKey++}`} className="list-decimal list-inside space-y-1 ml-2">
              {currentList.items.map((item, idx) => (
                <li key={idx} className="text-muted-foreground">
                  {parseInlineMarkdown(item)}
                </li>
              ))}
            </ol>
          );
        }
        currentList = null;
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        flushList();
        return;
      }

      // H2 headers (##)
      if (trimmedLine.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={`h2-${index}`} className="text-lg font-semibold mt-4 mb-2 first:mt-0">
            {trimmedLine.substring(3)}
          </h2>
        );
        return;
      }

      // H3 headers (###)
      if (trimmedLine.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={`h3-${index}`} className="text-base font-medium mt-3 mb-1.5">
            {trimmedLine.substring(4)}
          </h3>
        );
        return;
      }

      // H4 headers (####)
      if (trimmedLine.startsWith('#### ')) {
        flushList();
        elements.push(
          <h4 key={`h4-${index}`} className="text-sm font-medium mt-2 mb-1">
            {trimmedLine.substring(5)}
          </h4>
        );
        return;
      }

      // Bullet points (*, -, •)
      const bulletMatch = trimmedLine.match(/^[*\-•]\s+(.+)$/);
      if (bulletMatch) {
        if (!currentList || currentList.type !== 'ul') {
          flushList();
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(bulletMatch[1]);
        return;
      }

      // Numbered lists (1., 2., etc.)
      const numberedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
      if (numberedMatch) {
        if (!currentList || currentList.type !== 'ol') {
          flushList();
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(numberedMatch[1]);
        return;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={`p-${index}`} className="text-muted-foreground mb-2">
          {parseInlineMarkdown(trimmedLine)}
        </p>
      );
    });

    // Flush any remaining list
    flushList();

    return elements;
  };

  const parseInlineMarkdown = (text: string): React.ReactNode => {
    // Handle bold text (**text** or __text__)
    const boldPattern = /(\*\*|__)(.*?)\1/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = boldPattern.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Add bold text
      parts.push(
        <strong key={`bold-${match.index}`} className="font-semibold">
          {match[2]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={className}>
      {parseMarkdown(content)}
    </div>
  );
};
