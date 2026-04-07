import React, { useEffect, useRef } from 'react';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({ value, ...props }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Use scrollHeight + 2 to avoid potential rounding issues that hide the last line
      textarea.style.height = `${textarea.scrollHeight + 2}px`;
    }
  };

  useEffect(() => {
    resize();
    // Add a small delay to ensure styles are applied before resizing
    const timeout = setTimeout(resize, 0);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      rows={props.rows || 2}
      style={{ ...props.style, overflow: 'hidden', resize: 'none', boxSizing: 'border-box' }}
    />
  );
};

export default AutoResizeTextarea;
