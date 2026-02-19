import React, { useState, useRef } from 'react';
import './ImportDialog.css';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, format: 'vcard' | 'csv') => Promise<{ imported: number; skipped: number }>;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'vcard' | 'csv'>('vcard');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setError('');
    setResult(null);

    // Auto-detect format from extension
    if (file) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'vcf' || ext === 'vcard') setFormat('vcard');
      else if (ext === 'csv') setFormat('csv');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a file to import.');
      return;
    }
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const res = await onImport(selectedFile, format);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setResult(null);
    setError('');
    setImporting(false);
    onClose();
  };

  return (
    <div className="import-dialog__overlay" onClick={handleClose}>
      <div className="import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="import-dialog__header">
          <h3>Import Contacts</h3>
          <button className="import-dialog__close" onClick={handleClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="import-dialog__body">
          {error && (
            <div className="import-dialog__error">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          {result && (
            <div className="import-dialog__success">
              <span className="material-symbols-outlined">check_circle</span>
              Imported {result.imported} contact{result.imported !== 1 ? 's' : ''}
              {result.skipped > 0 && `, ${result.skipped} skipped`}.
            </div>
          )}

          <div className="import-dialog__drop-zone" onClick={() => fileInputRef.current?.click()}>
            <span className="material-symbols-outlined import-dialog__drop-icon">upload_file</span>
            <p>{selectedFile ? selectedFile.name : 'Click to select a file'}</p>
            <span className="import-dialog__drop-hint">Supports .vcf (vCard) and .csv files</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".vcf,.vcard,.csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className="import-dialog__format">
            <label>Import format:</label>
            <div className="import-dialog__format-options">
              <label className="import-dialog__radio">
                <input
                  type="radio"
                  name="format"
                  checked={format === 'vcard'}
                  onChange={() => setFormat('vcard')}
                />
                <span>vCard (.vcf)</span>
              </label>
              <label className="import-dialog__radio">
                <input
                  type="radio"
                  name="format"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                />
                <span>CSV (.csv)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="import-dialog__footer">
          <button className="import-dialog__btn import-dialog__btn--cancel" onClick={handleClose} disabled={importing}>
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              className="import-dialog__btn import-dialog__btn--import"
              onClick={handleImport}
              disabled={importing || !selectedFile}
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
