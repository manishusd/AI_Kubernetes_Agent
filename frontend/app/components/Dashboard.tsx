"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [history, setHistory] = useState<InvestigationHistoryItem[]>(initialHistory);
  const [error, setError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<ClusterContext[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

  const progressVisible = useMemo(
    () => progressSteps.slice(0, progressIndex + 1),
    [progressIndex]
  );

  useEffect(() => {
    const saved = localStorage.getItem("investigationHistory");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        setHistory(initialHistory);
      }
    }
  }, []);

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
  }, []);

  const addHistory = (diagnosis: Diagnosis) => {
    const entry: InvestigationHistoryItem = {
      id: `${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      root_cause: diagnosis.root_cause || "Unknown",
      namespace: "default",
      confidence: diagnosis.confidence,
      status: diagnosis.root_cause ? "Success" : "Failed",
    };

    setHistory((current) => [entry, ...current].slice(0, 8));
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
        throw new Error(`Investigation failed: ${response.statusText}`);
      }

      const payload = await response.json();
      const diagnosisData: Diagnosis | null = payload?.diagnosis ?? null;

      if (!diagnosisData) {
        throw new Error("Empty diagnosis returned from backend.");
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-500">
              AI Kubernetes Agent
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Troubleshoot clusters with AI
            </h1>
          </div>
          <div className="rounded-2xl bg-slate-900 px-5 py-3 text-sm text-slate-300">
            Logged in with InsForge
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase text-slate-500">Investigation</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Cluster Health Check</h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-[220px] rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                    <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">Cluster</label>
                    <select
                      value={selectedCluster ?? ""}
                      onChange={(event) => setSelectedCluster(event.target.value)}
                      disabled={isInvestigating || loadingClusters}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
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
                    className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={runInvestigation}
                    disabled={isInvestigating || !selectedCluster}
                  >
                    {isInvestigating ? "Investigating…" : "Investigate Cluster"}
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-slate-950/90 p-5">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Status</p>
                <p className="mt-3 text-lg font-medium text-white">{statusMessage}</p>
                <div className="mt-5 grid gap-3">
                  {isInvestigating ? (
                    progressSteps.map((step, index) => (
                      <div
                        key={step}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                          index <= progressIndex ? "bg-emerald-500/10 text-slate-100" : "bg-slate-800/80 text-slate-400"
                        }`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-emerald-400">
                          {index <= progressIndex ? "✓" : index + 1}
                        </span>
                        <span className="text-sm">{step}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Select a cluster and start an investigation.</p>
                  )}
                </div>
              </div>

              {error ? (
                <div className="mt-5 rounded-3xl border border-rose-500 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/20">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Diagnosis</h2>
                <span className="text-sm text-slate-500">AI summary</span>
              </div>

              {diagnosis ? (
                <div className="space-y-4 text-slate-100">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Root Cause</p>
                    <p className="mt-2 text-base font-medium text-white">{diagnosis.root_cause}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Explanation</p>
                    <p className="mt-2 text-base text-slate-300">{diagnosis.explanation}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Suggested Fix</p>
                    <p className="mt-2 text-base text-slate-300">{diagnosis.suggested_fix}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Command</p>
                    <p className="mt-2 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-emerald-200">{diagnosis.kubectl_command}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-950/80 px-4 py-3">
                    <span className="text-sm uppercase tracking-[0.25em] text-slate-500">Confidence</span>
                    <span className="text-lg font-semibold text-white">{diagnosis.confidence}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Start an investigation to see the diagnosis here.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/20">
              <h2 className="text-xl font-semibold text-white">Recent Investigations</h2>
              <p className="mt-2 text-sm text-slate-500">Latest cluster diagnoses stored locally.</p>

              <div className="mt-6 space-y-3">
                {history.length === 0 ? (
                  <p className="text-sm text-slate-400">No recent investigations yet.</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-white">{item.root_cause}</p>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                            {item.status}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-400">
                          <p>{item.timestamp}</p>
                          <p>Namespace: {item.namespace}</p>
                          <p>Confidence: {item.confidence}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
