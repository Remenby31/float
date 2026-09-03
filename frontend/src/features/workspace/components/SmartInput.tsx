import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { getSuggestions, parseInput, type ParsedTask, type Suggestion } from '@/features/workspace/utils/smart-input';

interface SmartInputProps {
  value: string;
  onValueChange: (value: string) => void;
  projects?: string[];
  placeholder?: string;
  inline?: boolean;
  multiline?: boolean;
  autoFocus?: boolean;
  onBlurSubmit?: boolean;
  onLiveInput?: (value: string) => void;
  onSubmit: (task: ParsedTask) => void | Promise<void>;
}

export function SmartInput({
  value,
  onValueChange,
  projects = [],
  placeholder = 'add a task...',
  inline = false,
  multiline = false,
  autoFocus = false,
  onBlurSubmit = false,
  onLiveInput,
  onSubmit,
}: SmartInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const parsed = useMemo(() => parseInput(value), [value]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useLayoutEffect(() => {
    if (!multiline || !(inputRef.current instanceof HTMLTextAreaElement)) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
  }, [multiline, value]);

  const updateValue = (nextValue: string) => {
    onValueChange(nextValue);
    onLiveInput?.(nextValue);
    const lastWord = nextValue.split(/\s/).at(-1) ?? '';
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const nextSuggestions = getSuggestions(lastWord.slice(1), projects);
      setSuggestions(nextSuggestions);
      setSelectedIndex(0);
      setShowSuggestions(nextSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const applySuggestion = (suggestion: Suggestion) => {
    const words = value.split(/\s/);
    words[words.length - 1] = `@${suggestion.value}`;
    updateValue(`${words.join(' ')} `);
    setShowSuggestions(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = async () => {
    const result = parseInput(value);
    if (!result.title && !result.due_date) return;
    await onSubmit(result);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, suggestions.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if ((event.key === 'Tab' || event.key === 'Enter') && suggestions[selectedIndex]) {
        event.preventDefault();
        applySuggestion(suggestions[selectedIndex]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (event.key === 'Enter' && (!multiline || !event.shiftKey)) {
      event.preventDefault();
      void submit();
    }
  };

  const commonProps = {
    value,
    placeholder,
    autoFocus,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateValue(event.target.value),
    onKeyDown,
    onFocus: () => suggestions.length > 0 && setShowSuggestions(true),
    onBlur: () => {
      window.setTimeout(() => {
        setShowSuggestions(false);
        if (onBlurSubmit && value.trim()) void submit();
      }, 150);
    },
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        {multiline ? (
          <textarea
            {...commonProps}
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className={inline ? 'w-full resize-none overflow-hidden bg-transparent p-0 text-text outline-none placeholder:text-text-muted/50' : 'field min-h-24 resize-y'}
            rows={1}
          />
        ) : (
          <input
            {...commonProps}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            className={inline ? 'w-full bg-transparent p-0 text-text outline-none placeholder:text-text-muted/50' : `field ${parsed.due_date ? 'pr-24' : ''}`}
          />
        )}

        {parsed.due_date && !inline ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
            {formatPreview(parsed.due_date)}
          </span>
        ) : null}
      </div>

      {showSuggestions ? (
        <div className={`absolute left-0 right-0 z-30 overflow-hidden rounded-xl border border-border bg-elevated shadow-xl ${inline ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {suggestions.map((suggestion, index) => (
            <button
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${index === selectedIndex ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}`}
              key={`${suggestion.type}-${suggestion.value}`}
              onMouseDown={(event) => {
                event.preventDefault();
                applySuggestion(suggestion);
              }}
              type="button"
            >
              <span className="w-8 text-right text-[9px] font-medium uppercase tracking-wider text-text-muted">
                {suggestion.type === 'project' ? 'proj' : suggestion.type}
              </span>
              <span className="flex-1">{suggestion.label}</span>
              {suggestion.description ? <span className="text-[11px] text-text-muted">{suggestion.description}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatPreview(value: string) {
  const date = new Date(value);
  const time = date.getHours() || date.getMinutes()
    ? ` ${date.getHours()}h${date.getMinutes().toString().padStart(2, '0')}`
    : '';
  return `${date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}${time}`;
}
