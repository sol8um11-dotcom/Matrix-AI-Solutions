import React, { useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  label: string;
  accept?: string;
  onFileSelect: (file: File) => void;
  selectedFileName?: string;
  required?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  accept = ".csv,.json", 
  onFileSelect, 
  selectedFileName,
  required = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div 
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors duration-200
          ${selectedFileName 
            ? 'border-emerald-500 bg-emerald-50' 
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
          }
        `}
      >
        <input 
          type="file" 
          ref={inputRef}
          accept={accept}
          onChange={handleChange}
          className="hidden" 
        />
        
        <div className="flex items-center space-x-3">
          {selectedFileName ? (
            <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
              <CheckCircle size={20} />
            </div>
          ) : (
             <div className="bg-slate-100 p-2 rounded-full text-slate-500">
              <Upload size={20} />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            {selectedFileName ? (
              <p className="text-sm font-medium text-emerald-800 truncate">
                {selectedFileName}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Click to upload <span className="font-mono text-xs text-slate-400">({accept})</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
