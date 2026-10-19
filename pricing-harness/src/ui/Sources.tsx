import type {SourceFile} from '../contracts.js';
export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
// B7: every workspace file is used; this list is for reference only.
export function Sources({files}: {files: SourceFile[]}) {
  return (
    <details className="bar-section">
      <summary>
        Sources · {files.length} {files.length === 1 ? 'file' : 'files'}
      </summary>
      {files.length ? (
        <ul className="sources">
          {files.map(file => (
            <li key={file.id}>
              <span className="source-name">{file.name}</span>
              <span>{file.kind.toUpperCase()}</span>
              <span>{formatBytes(file.bytes)}</span>
              <span>{file.addedAt ? new Date(file.addedAt).toLocaleDateString() : ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No files yet. Add files from the composer.</p>
      )}
    </details>
  );
}
