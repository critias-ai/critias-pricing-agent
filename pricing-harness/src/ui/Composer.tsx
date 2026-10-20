import {useState} from 'react';
import {AuiIf, ComposerPrimitive} from '@assistant-ui/react';
// F8: Enter sends, Shift+Enter adds a line, Esc never stops a run; drafting is allowed while a run is busy.
export function Composer({
  uploading,
  upload,
  levels,
  level,
  setLevel,
}: {
  uploading: boolean;
  upload: (files: File[]) => void;
  levels: string[];
  level: string;
  setLevel: (level: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`composer-area${dragging ? ' dragging' : ''}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) upload(files);
      }}
    >
      <ComposerPrimitive.Root className="composer">
        <ComposerPrimitive.Input
          aria-label="Your question"
          placeholder="Ask about your sales, margins or pricing…"
          cancelOnEscape={false}
          submitMode="enter"
          minRows={2}
          maxRows={8}
        />
        <div className="composer-actions">
          <label className="upload-button">
            {uploading ? 'Uploading…' : '+ Add file'}
            <input
              aria-label="Add file"
              type="file"
              multiple
              accept=".csv,.xlsx,.txt,.md"
              disabled={uploading}
              onChange={event => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) upload(files);
                event.target.value = '';
              }}
            />
          </label>
          <span className="hint">CSV · Excel · Markdown, or drop files here</span>
          {levels.length > 1 && (
            <label className="thinking">
              <span>Thinking</span>
              <select aria-label="Thinking level" value={level} onChange={event => setLevel(event.target.value)}>
                {levels.map(l => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          <AuiIf condition={s => s.thread.isRunning}>
            <ComposerPrimitive.Cancel className="stop">Stop</ComposerPrimitive.Cancel>
          </AuiIf>
          <AuiIf condition={s => !s.thread.isRunning}>
            <ComposerPrimitive.Send className="primary">Send ↗</ComposerPrimitive.Send>
          </AuiIf>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
}
