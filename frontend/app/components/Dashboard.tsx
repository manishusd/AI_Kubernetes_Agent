"use client";

import { useEffect, useState } from "react";

const progressSteps = [
  "Checking Pods",
  "Reading Logs",
  "Analyzing Events",
  "Inspecting Deployments",
  "Checking Networking",
  "AI Reasoning",
  "Root Cause Found",
];

interface Diagnosis {
  root_cause: string;
  explanation: string;
  suggested_fix: string;
  kubectl_command: string;
  prevention_recommendation: string;
  confidence: number;
  ai_error?: string;
}

interface ClusterContext {
  name: string;
  cluster: string;
  description: string;
}

interface InvestigationHistoryItem {
  id: string;
  timestamp: string;
  root_cause: string;
  explanation: string;
  suggested_fix: string;
  kubectl_command: string;
  prevention_recommendation: string;
  namespace: string;
  confidence: number;
  status: string;
}

const initialHistory: InvestigationHistoryItem[] = [];

export default function Dashboard() {
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Waiting to start investigation.");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [history, setHistory] = useState<InvestigationHistoryItem[]>(() => {
    if (typeof window === "undefined") {
      return initialHistory;
    }

    const saved = window.localStorage.getItem("investigationHistory");
    if (!saved) {
      return initialHistory;
    }

    try {
      return JSON.parse(saved);
    } catch {
      return initialHistory;
    }
  });
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<InvestigationHistoryItem | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<ClusterContext[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

  useEffect(() => {
    localStorage.setItem("investigationHistory", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const loadClusters = async () => {
      try {
        const response = await fetch(`${backendBaseUrl}/clusters`);
        if (!response.ok) {
          throw new Error(`Unable to load clusters: ${response.statusText}`);
        }
        const data: ClusterContext[] = await response.json();
        setClusters(data);
        setSelectedCluster(data[0]?.name ?? null);
      } catch (clusterError) {
        const message = clusterError instanceof Error ? clusterError.message : "Failed to load clusters.";
        setError(message);
        setStatusMessage("Unable to load Kubernetes contexts.");
        setClusters([]);
        setSelectedCluster(null);
      } finally {
        setLoadingClusters(false);
      }
    };

    loadClusters();
  }, [backendBaseUrl]);

  const addHistory = (diagnosis: Diagnosis) => {
    const entry: InvestigationHistoryItem = {
      id: `${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      root_cause: diagnosis.root_cause || "Unknown",
      explanation: diagnosis.explanation || "",
      suggested_fix: diagnosis.suggested_fix || "",
      kubectl_command: diagnosis.kubectl_command || "",
      prevention_recommendation: diagnosis.prevention_recommendation || "",
      namespace: "default",
      confidence: diagnosis.confidence,
      status: diagnosis.root_cause ? "Success" : "Failed",
    };

    setHistory((current) => [entry, ...current].slice(0, 8));
  };

  const copyCommand = async (command: string, source: string) => {
    if (!command.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      setCopiedTarget(source);
      setTimeout(() => setCopiedTarget((current) => (current === source ? null : current)), 1500);
    } catch {
      setError("Unable to copy command. Please copy it manually.");
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistory((current) => current.filter((item) => item.id !== id));
    setSelectedHistoryItem((current) => (current?.id === id ? null : current));
  };

  const runInvestigation = async () => {
    setError(null);
    setDiagnosis(null);
    setIsInvestigating(true);
    setProgressIndex(0);
    setStatusMessage("Starting investigation...");

    try {
      for (let index = 0; index < progressSteps.length - 1; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        setProgressIndex(index);
        setStatusMessage(progressSteps[index]);
      }

      const response = await fetch(`${backendBaseUrl}/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: selectedCluster }),
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorPayload = await response.json();
          if (errorPayload?.detail) {
            errorMessage = errorPayload.detail;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(`Investigation failed: ${errorMessage}`);
      }

      const payload = await response.json();
      const diagnosisData: Diagnosis | null = payload?.diagnosis ?? null;

      if (!diagnosisData) {
        throw new Error("Empty diagnosis returned from backend.");
      }

      if (diagnosisData.ai_error) {
        setError(`AI reasoning failed: ${diagnosisData.ai_error}`);
      }

      setDiagnosis(diagnosisData);
      addHistory(diagnosisData);
      setProgressIndex(progressSteps.length - 1);
      setStatusMessage(diagnosisData.root_cause ? "Root Cause Found" : "No critical Kubernetes issues detected.");
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unknown error.";
      setError(message);
      setStatusMessage("Unable to complete investigation.");
    } finally {
      setIsInvestigating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white text-slate-900">
      <div className="mx-auto max-w-7xl px-8 py-12">
        {/* Header */}
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                Kubernetes Intelligence
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                AI Troubleshooting Agent
              </h1>
              <p className="mt-1 text-sm text-slate-600">Diagnose and fix cluster issues instantly</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-2.5 border border-blue-200">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm font-medium text-blue-700">Connected to InsForge</span>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            {/* Investigation Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md transition hover:shadow-lg">
              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Cluster Investigation</h2>
                    <p className="mt-0.5 text-sm text-slate-600">Analyze your Kubernetes cluster health</p>
                  </div>
                </div>
              </div>

              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Select Cluster</label>
                  <select
                    value={selectedCluster ?? ""}
                    onChange={(event) => setSelectedCluster(event.target.value)}
                    disabled={isInvestigating || loadingClusters}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {loadingClusters ? (
                      <option value="">Loading clusters...</option>
                    ) : clusters.length === 0 ? (
                      <option value="">No clusters found</option>
                    ) : (
                      clusters.map((cluster) => (
                        <option key={cluster.name} value={cluster.name}>
                          {cluster.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isInvestigating || !selectedCluster}
                  onClick={runInvestigation}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition flex items-center justify-center gap-2 ${
                    isInvestigating || !selectedCluster
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg"
                  }`}
                >
                  {isInvestigating ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Investigating...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Start Investigation
                    </>
                  )}
                </button>
              </div>

              {/* Status Section */}
              <div className="rounded-xl bg-slate-50 p-6 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`h-2 w-2 rounded-full ${isInvestigating ? "bg-blue-500 animate-pulse" : "bg-slate-400"}`}></div>
                  <p className="text-sm font-semibold text-slate-700">Status: {statusMessage}</p>
                </div>

                {isInvestigating ? (
                  <div className="space-y-3">
                    {progressSteps.map((step, index) => (
                      <div key={step} className="flex items-center gap-3">
                        <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 transition">
                          {index < progressIndex ? (
                            <>
                              <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                              <div className="relative rounded-full bg-emerald-500 text-white flex items-center justify-center h-7 w-7">✓</div>
                            </>
                          ) : index === progressIndex ? (
                            <>
                              <div className="absolute inset-0 rounded-full bg-blue-500 animate-pulse"></div>
                              <div className="relative text-blue-600 font-bold">{index + 1}</div>
                            </>
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span className={`text-sm font-medium ${index <= progressIndex ? "text-slate-900" : "text-slate-500"}`}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Ready to investigate. Select a cluster and click start.</p>
                )}
              </div>

              {error && (
                <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 flex gap-3">
                  <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-red-900">Investigation Failed</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Diagnosis Card */}
            {diagnosis && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">AI Diagnosis</h2>
                    <p className="mt-0.5 text-sm text-slate-600">Root cause analysis and recommendations</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  {/* Root Cause */}
                  <div className="rounded-lg bg-gradient-to-br from-red-50 to-orange-50 p-4 border border-red-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-700 mb-2">Root Cause</p>
                    <p className="text-sm font-medium text-slate-900 whitespace-pre-line">{diagnosis.root_cause}</p>
                  </div>

                  {/* Explanation */}
                  <div className="rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 p-4 border border-blue-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">Explanation</p>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{diagnosis.explanation}</p>
                  </div>

                  {/* Suggested Fix */}
                  <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 p-4 border border-emerald-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">Suggested Fix</p>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{diagnosis.suggested_fix}</p>
                  </div>

                  {/* Command */}
                  <div className="rounded-lg bg-slate-900 p-4 border border-slate-700">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3m0 0l3-3m-3 3V5m0 0H5m0 0L2 2m15 13l3 3m0 0l3-3m-3 3v-3m0 0h3m0 0l3 3" />
                        </svg>
                        kubectl Command
                      </p>
                      <button
                        type="button"
                        onClick={() => copyCommand(diagnosis.kubectl_command, "diagnosis")}
                        className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                      >
                        {copiedTarget === "diagnosis" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <code className="text-xs text-emerald-400 font-mono whitespace-pre-wrap break-words">{diagnosis.kubectl_command}</code>
                  </div>

                  {/* Confidence & Prevention */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-slate-100 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Confidence</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-blue-600">{diagnosis.confidence}</span>
                        <span className="text-sm text-slate-600">%</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-slate-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                          style={{ width: `${diagnosis.confidence}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="rounded-lg bg-slate-100 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Prevention</p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{diagnosis.prevention_recommendation.split('\n')[0] || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Recent Investigations */}
          <div className="space-y-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md sticky top-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">History</h3>
                  <p className="text-xs text-slate-600">Recent investigations</p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="h-12 w-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm text-slate-600">No investigations yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHistoryItem(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedHistoryItem(item);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="group relative w-full text-left rounded-lg border border-slate-200 bg-slate-50 p-3 pb-9 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        className="absolute right-2 bottom-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 group-focus-within:opacity-100"
                        aria-label="Delete history item"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" />
                        </svg>
                      </button>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{item.root_cause.split('\n')[0]}</p>
                          <p className="text-xs text-slate-600 truncate mt-1">Fix: {item.suggested_fix?.split('\n')[0] || "N/A"}</p>
                          <p className="text-xs text-slate-500 mt-1">{item.timestamp}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-semibold whitespace-nowrap flex-shrink-0 ${
                          item.status === 'Success' 
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        <p>Confidence: <span className="font-semibold text-slate-900">{item.confidence}%</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {selectedHistoryItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
            onClick={() => setSelectedHistoryItem(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Investigation history details"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Investigation Details</h3>
                  <p className="text-sm text-slate-600 mt-1">{selectedHistoryItem.timestamp}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHistoryItem(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4">
                <div className="rounded-lg bg-gradient-to-br from-red-50 to-orange-50 p-4 border border-red-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-700 mb-2">Root Cause</p>
                  <p className="text-sm font-medium text-slate-900 whitespace-pre-line">{selectedHistoryItem.root_cause || "N/A"}</p>
                </div>

                <div className="rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 p-4 border border-blue-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">Explanation</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{selectedHistoryItem.explanation || "N/A"}</p>
                </div>

                <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 p-4 border border-emerald-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">Suggested Fix</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{selectedHistoryItem.suggested_fix || "N/A"}</p>
                </div>

                <div className="rounded-lg bg-slate-900 p-4 border border-slate-700">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">kubectl Command</p>
                    <button
                      type="button"
                      onClick={() => copyCommand(selectedHistoryItem.kubectl_command, `history-${selectedHistoryItem.id}`)}
                      className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      {copiedTarget === `history-${selectedHistoryItem.id}` ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <code className="text-xs text-emerald-400 font-mono whitespace-pre-wrap break-words">{selectedHistoryItem.kubectl_command || "N/A"}</code>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-slate-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Confidence</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-blue-600">{selectedHistoryItem.confidence}</span>
                      <span className="text-sm text-slate-600">%</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Prevention</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{selectedHistoryItem.prevention_recommendation || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
