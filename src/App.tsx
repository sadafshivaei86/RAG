import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Send, 
  FileSpreadsheet, 
  MessageSquare, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  BrainCircuit,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Status {
  indexed: boolean;
  count: number;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ indexed: false, count: 0 });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch status", err);
    }
  };

  const [dragActive, setDragActive] = useState(false);

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("file", uploadedFile);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) processFile(uploadedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !status.indexed) return;

    setLoading(true);
    setAnswer(null);
    setError(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnswer(data.answer);
    } catch (err: any) {
      setError(err.message || "Failed to get answer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden text-sm">
      {/* Sidebar */}
      <aside className="w-80 border-r border-[var(--color-line)] flex flex-col bg-[var(--color-bg)]">
        <div className="p-6 border-b border-[var(--color-line)]">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="w-5 h-5" />
            <h1 className="font-serif italic text-lg font-bold">Groq Excel RAG</h1>
          </div>
          <p className="text-xs opacity-60">Technical Knowledge Extraction</p>
        </div>

        <div className="p-6 flex-1 space-y-8 overflow-y-auto">
          {/* Upload Section */}
          <section className="space-y-4">
            <h2 className="col-header">Source Document</h2>
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative border border-dashed p-8 rounded-lg 
                cursor-pointer transition-all duration-300
                flex flex-col items-center justify-center gap-3
                ${dragActive ? 'border-black bg-black text-white' : 'border-[var(--color-line)]'}
                ${loading && !answer ? 'opacity-50 pointer-events-none' : 'hover:bg-[var(--color-ink)] hover:text-[var(--color-bg)]'}
              `}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".xlsx,.xls" 
                className="hidden" 
              />
              {loading && !answer ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
              <div className="text-center">
                <p className="font-medium text-xs">
                  {loading && !answer ? "Analyzing data..." : "Click or Drop file"}
                </p>
                <p className="text-[10px] opacity-60 mt-1">EXCEL (XLSX, XLS)</p>
              </div>
            </div>
            {file && !loading && (
              <div className="flex items-center gap-2 text-[10px] font-mono opacity-60 overflow-hidden">
                <FileSpreadsheet className="w-3 h-3 shrink-0" />
                <span className="truncate">{file.name}</span>
              </div>
            )}
          </section>

          {/* Status Section */}
          <section className="space-y-4">
            <h2 className="col-header">System Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-[var(--color-line)] rounded bg-[var(--color-ink)] bg-opacity-[0.02]">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 opacity-70" />
                  <span className="font-mono text-[11px]">VECTOR_DB</span>
                </div>
                {status.indexed ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">ACTIVE</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-orange-500">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[10px] font-bold">WAITING</span>
                  </div>
                )}
              </div>
              
              {status.indexed && (
                <div className="p-3 border border-[var(--color-line)] rounded bg-[var(--color-ink)] bg-opacity-[0.02]">
                  <p className="text-[10px] opacity-50 mb-1">RECORDS_INDEXED</p>
                  <p className="font-mono text-xl">{status.count.toLocaleString()}</p>
                </div>
              )}
            </div>
          </section>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border border-red-500 bg-red-500 bg-opacity-10 text-red-700 flex gap-3 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}
        </div>

        <div className="p-6 border-t border-[var(--color-line)] bg-[var(--color-ink)] text-[var(--color-bg)]">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] opacity-60 uppercase tracking-widest font-bold">Engine</p>
              <p className="font-serif italic text-sm">Groq / Llama3 8B</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] opacity-60 uppercase tracking-widest font-bold">Version</p>
              <p className="font-mono text-sm">v1.2.4</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto p-12 bg-[#F9F9F8]">
          <div className="max-w-3xl mx-auto space-y-12">
            {!status.indexed && !loading && (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
                <FileSpreadsheet className="w-16 h-16 opacity-10" />
                <div className="max-w-md">
                  <h3 className="font-serif italic text-2xl mb-2">No context found</h3>
                  <p className="opacity-50">Upload an Excel file to begin querying your data with natural language.</p>
                </div>
              </div>
            )}

            {status.indexed && !answer && !loading && (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
                <MessageSquare className="w-16 h-16 opacity-10" />
                <div className="max-w-md">
                  <h3 className="font-serif italic text-2xl mb-2">Ready for queries</h3>
                  <p className="opacity-50">Ask anything about the uploaded file. The system will retrieve relevant rows and generate a summarized answer.</p>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {loading && !answer && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-[60vh] flex flex-col items-center justify-center space-y-4"
                >
                  <Loader2 className="w-8 h-8 animate-spin opacity-40" />
                  <p className="text-xs font-mono tracking-widest uppercase opacity-40">Processing...</p>
                </motion.div>
              )}

              {answer && (
                <motion.section 
                  key="answer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--color-ink)] text-[var(--color-bg)] flex items-center justify-center rounded">
                      <BrainCircuit className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-serif italic text-xl">Generated Analysis</h2>
                      <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Context-Aware Output</p>
                    </div>
                  </div>

                  <div className="p-8 border border-[var(--color-line)] bg-white shadow-sm leading-relaxed text-lg">
                    {answer.split('\n').map((paragraph, i) => (
                      <p key={i} className={i > 0 ? 'mt-4' : ''}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-8 border-t border-[var(--color-line)] bg-white">
          <form onSubmit={handleAsk} className="max-w-3xl mx-auto flex gap-4">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={status.indexed ? "Ask a question about your data..." : "Upload a file to start..."}
                disabled={!status.indexed || (loading && !answer)}
                className="w-full p-4 pr-12 font-serif italic text-lg border-b-2 border-transparent focus:border-[var(--color-line)] outline-none transition-all placeholder:opacity-30 disabled:opacity-50"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="font-mono text-[10px] opacity-30 select-none">⏎</span>
              </div>
            </div>
            <button 
              type="submit"
              disabled={!status.indexed || !question.trim() || loading}
              className="bg-[var(--color-ink)] text-[var(--color-bg)] h-14 w-14 flex items-center justify-center rounded transition-transform hover:scale-105 active:scale-95 disabled:opacity-20 disabled:scale-100"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            </button>
          </form>
          <div className="max-w-3xl mx-auto mt-4 flex justify-between items-center opacity-30">
            <div className="flex gap-4 text-[10px] font-mono">
              <span className="hover:opacity-100 cursor-help">RECORDS: {status.count}</span>
              <span className="hover:opacity-100 cursor-help">MODEL: LLAMA3_8B</span>
              <span className="hover:opacity-100 cursor-help">EMBEDDING: MINILM_L6</span>
            </div>
            <p className="text-[10px] font-medium tracking-tight">VIRTEX.AI SYSTEM RUNNING</p>
          </div>
        </div>
      </main>
    </div>
  );
}

