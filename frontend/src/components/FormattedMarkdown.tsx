import React from 'react';
import { Link as LinkIcon } from 'lucide-react';

interface FormattedMarkdownProps {
  content: string;
  className?: string;
  onWikilinkClick?: (linkTarget: string) => void;
}

export const FormattedMarkdown: React.FC<FormattedMarkdownProps> = ({
  content,
  className = '',
  onWikilinkClick
}) => {
  if (!content) return null;

  const parseInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const wikiMatch = remaining.match(/\[\[(.*?)\]\]/);
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      const codeMatch = remaining.match(/`(.*?)`/);

      const wikiIndex = wikiMatch ? remaining.indexOf(wikiMatch[0]) : -1;
      const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
      const codeIndex = codeMatch ? remaining.indexOf(codeMatch[0]) : -1;

      const indices = [
        { type: 'wiki', index: wikiIndex, match: wikiMatch },
        { type: 'bold', index: boldIndex, match: boldMatch },
        { type: 'code', index: codeIndex, match: codeMatch },
      ].filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

      if (indices.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = indices[0];
      if (first.index > 0) {
        parts.push(remaining.substring(0, first.index));
      }

      if (first.type === 'wiki' && first.match) {
        const rawLink = first.match[1];
        const linkTarget = rawLink.split('|')[0].trim();
        const displayLabel = rawLink.split('|')[1]?.trim() || linkTarget;
        parts.push(
          <span
            key={`wiki-${key++}`}
            onClick={(e) => {
              if (onWikilinkClick) {
                e.stopPropagation();
                onWikilinkClick(linkTarget);
              }
            }}
            className={`inline-flex items-center gap-1 font-semibold font-mono bg-forestGreen/60 text-limeAccent px-1.5 py-0.5 rounded text-[11px] border border-primaryGreen/40 mx-0.5 ${
              onWikilinkClick ? 'cursor-pointer hover:bg-forestGreen hover:border-limeAccent' : ''
            }`}
            title={`[[${linkTarget}]]`}
          >
            <LinkIcon className="w-3 h-3 text-limeAccent shrink-0" />
            {displayLabel}
          </span>
        );
        remaining = remaining.substring(first.index + first.match[0].length);
      } else if (first.type === 'bold' && first.match) {
        parts.push(
          <strong key={`bold-${key++}`} className="font-bold text-white">
            {first.match[1]}
          </strong>
        );
        remaining = remaining.substring(first.index + first.match[0].length);
      } else if (first.type === 'code' && first.match) {
        parts.push(
          <code key={`code-${key++}`} className="bg-darkBg text-limeAccent px-1 py-0.5 rounded font-mono text-[11px] border border-forestGreen/40">
            {first.match[1]}
          </code>
        );
        remaining = remaining.substring(first.index + first.match[0].length);
      }
    }

    return parts;
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-1.5 text-textLight">
            {currentList.items}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-1.5 text-textLight">
            {currentList.items}
          </ol>
        );
      }
      currentList = null;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      elements.push(<div key={`blank-${index}`} className="h-1.5" />);
      return;
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${index}`} className="text-base font-bold text-white mt-3 mb-1.5 border-b border-forestGreen/60 pb-1">
          {parseInline(trimmed.substring(2))}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${index}`} className="text-sm font-bold text-white mt-2.5 mb-1">
          {parseInline(trimmed.substring(3))}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${index}`} className="text-xs font-semibold text-limeAccent mt-2 mb-1">
          {parseInline(trimmed.substring(4))}
        </h3>
      );
    } else if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(
        <h4 key={`h4-${index}`} className="text-xs font-semibold text-white mt-1.5 mb-0.5">
          {parseInline(trimmed.substring(5))}
        </h4>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(
        <li key={`li-${index}`} className="text-xs leading-relaxed text-textLight">
          {parseInline(trimmed.substring(2))}
        </li>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      const text = trimmed.replace(/^\d+\.\s/, '');
      currentList.items.push(
        <li key={`li-${index}`} className="text-xs leading-relaxed text-textLight">
          {parseInline(text)}
        </li>
      );
    } else if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={`bq-${index}`} className="border-l-2 border-limeAccent bg-forestGreen/30 px-3 py-1.5 my-1.5 italic text-textLight rounded-r text-xs">
          {parseInline(trimmed.substring(2))}
        </blockquote>
      );
    } else {
      flushList();
      elements.push(
        <p key={`p-${index}`} className="text-xs leading-relaxed my-0.5">
          {parseInline(line)}
        </p>
      );
    }
  });

  flushList();

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
};
