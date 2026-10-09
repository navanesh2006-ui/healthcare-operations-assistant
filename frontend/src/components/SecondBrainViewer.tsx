import React, { useState, useEffect } from 'react';
import { secondBrainApi, chatbotApi } from '../services/api';
import { SecondBrainNode } from '../types';
import { FormattedMarkdown } from './FormattedMarkdown';
import { Brain, FileText, Link as LinkIcon, RefreshCw, Eye, ShieldCheck, Tag, Sparkles } from 'lucide-react';

export const SecondBrainViewer: React.FC = () => {
  const [nodes, setNodes] = useState<SecondBrainNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SecondBrainNode | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [loading, setLoading] = useState<boolean>(true);
  const [aiStatus, setAiStatus] = useState<{ status: string; model: string; error?: string } | null>(null);

  const categories = ['All', 'hospitals', 'instruction-glossary', 'patient-friendly-templates', 'reviewer-decisions', 'safety-rules'];

  const loadNodes = async () => {
    setLoading(true);
    try {
      const res = await secondBrainApi.getNodes(activeCategory === 'All' ? undefined : activeCategory);
      setNodes(res);
      if (res.length > 0 && !selectedNode) {
        setSelectedNode(res[0]);
      }
    } catch (err) {
      console.error("Failed loading second brain nodes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNodes();
    chatbotApi.getStatus().then(setAiStatus).catch(err => console.warn("AI status error:", err));
  }, [activeCategory]);

  const handleResync = async () => {
    await secondBrainApi.resync();
    await loadNodes();
  };

  const handleWikilinkClick = async (linkName: string) => {
    const cleanLink = linkName.trim().toLowerCase();

    // First check in current nodes list
    const matchInCurrent = nodes.find(n =>
      n.title.toLowerCase().includes(cleanLink) ||
      n.path.toLowerCase().includes(cleanLink) ||
      String(n.id).toLowerCase().includes(cleanLink)
    );

    if (matchInCurrent) {
      setSelectedNode(matchInCurrent);
      return;
    }

    // If not found in current list, try searching across all categories
    try {
      const allNodes = await secondBrainApi.getNodes();
      const matchInAll = allNodes.find(n =>
        n.title.toLowerCase().includes(cleanLink) ||
        n.path.toLowerCase().includes(cleanLink) ||
        String(n.id).toLowerCase().includes(cleanLink)
      );
      if (matchInAll) {
        setActiveCategory('All');
        setNodes(allNodes);
        setSelectedNode(matchInAll);
      }
    } catch (err) {
      console.error("Failed to find wikilink target:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-forestGreen">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-limeAccent" />
            Second Brain Knowledge Vault
          </h1>
          <p className="text-xs text-textLight/70">
            Linked markdown knowledge layer with [[wikilinks]], embedded into PostgreSQL pgvector RAG
          </p>
        </div>
        <div className="flex items-center gap-3">
          {aiStatus && (
            <span className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border ${
              aiStatus.status === 'live'
                ? 'bg-completedGreen/20 text-completedGreen border-completedGreen/40'
                : 'bg-pendingAmber/20 text-pendingAmber border-pendingAmber/40'
            }`}>
              <span className={`w-2 h-2 rounded-full ${aiStatus.status === 'live' ? 'bg-completedGreen animate-pulse' : 'bg-pendingAmber'}`} />
              {aiStatus.status === 'live' ? `AI: live ${aiStatus.model}` : 'AI: fallback mode'}
            </span>
          )}
          <button
            onClick={handleResync}
            className="bg-forestGreen hover:bg-forestGreen/80 text-white font-semibold text-xs py-2 px-3.5 rounded-lg border border-primaryGreen/40 flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-4 h-4 text-limeAccent" />
            Resync Vault Files
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
              activeCategory === cat
                ? 'bg-primaryGreen text-darkBg shadow-md'
                : 'bg-darkBg text-textLight/70 border border-forestGreen/60 hover:text-white'
            }`}
          >
            {cat.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Notes List Column */}
        <div className="lg:col-span-5 space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            return (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  isSelected
                    ? 'bg-forestGreen/80 border-limeAccent ring-2 ring-limeAccent/20'
                    : 'bg-panelBg border-forestGreen/60 hover:bg-forestGreen/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-limeAccent shrink-0" />
                    {node.title}
                  </h3>
                  <span className="text-[10px] uppercase font-bold bg-darkBg text-limeAccent border border-forestGreen px-2 py-0.5 rounded">
                    {node.category}
                  </span>
                </div>
                <p className="text-xs text-textLight/70 mt-2 line-clamp-2">
                  {node.content.replace(/#+/g, '').replace(/\*\*/g, '').slice(0, 140)}...
                </p>
                {node.wikilinks && node.wikilinks.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-limeAccent mt-2 font-mono">
                    <LinkIcon className="w-3 h-3" /> [[{node.wikilinks.join(']], [[')}]]
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Note Inspector & Wikilink Visualizer */}
        <div className="lg:col-span-7 bg-panelBg border border-forestGreen rounded-xl p-6 shadow-inner flex flex-col justify-between">
          {selectedNode ? (
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-forestGreen mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedNode.title}</h2>
                  <span className="text-xs text-limeAccent font-mono">{selectedNode.path}</span>
                </div>
                <span className="text-xs bg-forestGreen text-white px-2.5 py-1 rounded-full border border-primaryGreen/40">
                  {selectedNode.visibility}
                </span>
              </div>

              {/* Formatted Note Content */}
              <div className="max-w-none text-xs text-textLight leading-relaxed bg-darkBg/60 p-4 rounded-xl border border-forestGreen/60 font-sans max-h-[450px] overflow-y-auto">
                <FormattedMarkdown content={selectedNode.content} onWikilinkClick={handleWikilinkClick} />
              </div>

              {/* Wikilink Graph Connections */}
              {selectedNode.wikilinks && selectedNode.wikilinks.length > 0 && (
                <div className="mt-6 pt-4 border-t border-forestGreen">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                    <LinkIcon className="w-4 h-4 text-limeAccent" />
                    Linked Knowledge Nodes (Wikilinks Graph):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.wikilinks.map((link, i) => (
                      <button
                        key={i}
                        onClick={() => handleWikilinkClick(link)}
                        className="bg-forestGreen/60 hover:bg-forestGreen text-limeAccent border border-primaryGreen/40 text-xs px-2.5 py-1 rounded-lg font-mono transition flex items-center gap-1 cursor-pointer"
                      >
                        <LinkIcon className="w-3 h-3" />
                        [[{link}]]
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-textLight/50 text-sm">
              Select a Second Brain note from the list to read content and explore [[wikilink]] graph connections.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
