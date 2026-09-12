import React, { useState, useEffect } from 'react';


export default function Prompts() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [currentPrompt, setCurrentPrompt] = useState({
    id: '',
    reference: '',
    definition: { text: '' },
    status: 'Draft',
    visibility: 'Private'
  });
  
  const [detectedVars, setDetectedVars] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    // Detect variables like {{client_name}}
    const text = currentPrompt.definition.text || '';
    const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    const matches = [...text.matchAll(regex)];
    const uniqueVars = [...new Set(matches.map(m => m[1]))];
    setDetectedVars(uniqueVars);
  }, [currentPrompt.definition.text]);

  const fetchPrompts = async () => {
    try {
      const res = await fetch('/api/prompts');
      const data = await res.json();
      if (data.success) {
        setPrompts(data.items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrompt = (p) => {
    setCurrentPrompt({
      id: p.id,
      reference: p.reference,
      definition: p.definition || { text: '' },
      status: p.status,
      visibility: p.visibility || 'Private'
    });
    setSaveStatus('');
  };

  const handleNewPrompt = () => {
    setCurrentPrompt({
      id: '',
      reference: '',
      definition: { text: '' },
      status: 'Draft',
      visibility: 'Private'
    });
    setSaveStatus('');
  };

  const handleSave = async () => {
    setSaveStatus('Saving...');
    try {
      const payload = {
        ...currentPrompt,
        // if id is empty, remove it so backend generates a new one
        ...(currentPrompt.id ? {} : { id: undefined })
      };
      
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        setSaveStatus('Saved to Postgres & Redis!');
        fetchPrompts();
        if (!currentPrompt.id) {
          setCurrentPrompt(prev => ({ ...prev, id: data.item.id }));
        }
      } else {
        setSaveStatus('Error saving prompt');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('Error saving prompt');
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6 p-6 max-w-7xl mx-auto w-full">
      
      {/* Sidebar: Prompt List */}
      <div className="w-1/3 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">Prompt Registry</h2>
          <button 
            onClick={handleNewPrompt}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            + New
          </button>
        </div>
        
        <div className={`rounded-xl shadow-sm border ${"flex-1 overflow-y-auto bg-white/50 backdrop-blur border-slate-200"}`}>
          <div className={`p-6 ${"p-4 flex flex-col gap-2"}`}>
            {loading ? (
              <p className="text-slate-500 text-sm">Loading prompts...</p>
            ) : prompts.length === 0 ? (
              <p className="text-slate-500 text-sm">No prompts found.</p>
            ) : (
              prompts.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => handleSelectPrompt(p)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${currentPrompt.id === p.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-slate-800">{p.reference || 'Untitled'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.status === 'Published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {p.definition?.text || 'No content...'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Area: Editor */}
      <div className="flex-1 flex flex-col">
        <div className={`rounded-xl shadow-sm border ${"flex-1 flex flex-col bg-white border-slate-200 shadow-sm"}`}>
          <div className={`p-6 ${"border-b border-slate-100 pb-4"}`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className={`font-semibold ${"text-lg text-slate-800"}`}>Prompt Editor</h3>
                <p className="text-sm text-slate-500">Design, test, and version your AI prompts.</p>
              </div>
              <div className="flex items-center gap-3">
                {saveStatus && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{saveStatus}</span>}
                <button 
                  onClick={handleSave}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-all shadow-sm"
                >
                  Save Prompt
                </button>
              </div>
            </div>
          </div>
          
          <div className={`p-6 ${"flex-1 p-6 flex flex-col gap-6 overflow-y-auto"}`}>
            {/* Meta Row */}
            <div className="grid grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference Key</label>
                <input 
                  type="text" 
                  value={currentPrompt.reference}
                  onChange={(e) => setCurrentPrompt({...currentPrompt, reference: e.target.value})}
                  className="px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  placeholder="e.g. generate_invoice"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                <select 
                  value={currentPrompt.status}
                  onChange={(e) => setCurrentPrompt({...currentPrompt, status: e.target.value})}
                  className="px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white"
                >
                  <option value="Draft">Draft</option>
                  <option value="Validated">Validated</option>
                  <option value="Published">Published (Active)</option>
                  <option value="Archived">Archived</option>
                  <option value="Deprecated">Deprecated</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Visibility</label>
                <select 
                  value={currentPrompt.visibility}
                  onChange={(e) => setCurrentPrompt({...currentPrompt, visibility: e.target.value})}
                  className="px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white"
                >
                  <option value="Private">Private</option>
                  <option value="Workspace">Workspace</option>
                  <option value="Public">Public</option>
                </select>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex justify-between items-end">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">System Prompt Template</label>
                <span className="text-[10px] text-slate-400">Use {'{{variable_name}}'} to inject variables</span>
              </div>
              <textarea 
                value={currentPrompt.definition.text}
                onChange={(e) => setCurrentPrompt({...currentPrompt, definition: { ...currentPrompt.definition, text: e.target.value }})}
                className="w-full flex-1 min-h-[300px] p-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-sm leading-relaxed resize-none bg-slate-50/50"
                placeholder="You are an expert AI assistant...\n\nClient Name: {{client_name}}"
              />
            </div>
            
            {/* Variables Detected */}
            {detectedVars.length > 0 && (
              <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-2">Detected Variables</h4>
                <div className="flex flex-wrap gap-2">
                  {detectedVars.map(v => (
                    <span key={v} className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded text-xs font-mono font-medium shadow-sm">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>

    </div>
  );
}
