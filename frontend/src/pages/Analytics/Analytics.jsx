import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  FaChartLine,
  FaDownload,
  FaSyncAlt,
  FaExclamationTriangle,
  FaRoad,
  FaFolderOpen,
  FaFilePdf,
  FaTimes,
  FaCalendarAlt,
} from "react-icons/fa";
import detectionService from "../../services/detectionService";
import { useAuth } from "../../context/AuthContext";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: "#475569",
        font: { family: "Inter", size: 11, weight: "bold" },
      },
    },
    tooltip: {
      backgroundColor: "#ffffff",
      titleColor: "#1e293b",
      bodyColor: "#475569",
      borderColor: "#e2e8f0",
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(0, 0, 0, 0.03)" },
      ticks: { color: "#475569", font: { family: "Inter", size: 10 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(0, 0, 0, 0.03)" },
      ticks: {
        color: "#475569",
        font: { family: "Inter", size: 10 },
        precision: 0,
      },
    },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        color: "#475569",
        font: { family: "Inter", size: 11, weight: "bold" },
        padding: 14,
      },
    },
    tooltip: {
      backgroundColor: "#ffffff",
      titleColor: "#1e293b",
      bodyColor: "#475569",
      borderColor: "#e2e8f0",
      borderWidth: 1,
    },
  },
};

export default function Analytics() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [stats, setStats] = useState({
    totalInspections: 0,
    totalDefects: 0,
    potholeCount: 0,
    crackCount: 0,
    criticalCount: 0,
    repairsPending: 0,
    repairsCompleted: 0,
    cameraCount: 0,
    systemHealth: "Healthy",
    categoryDistribution: {},
    severityDistribution: {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    },
    inspectionTrends: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // PDF Summary Export States
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState("");
  const [pdfEndDate, setPdfEndDate] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const handleDownloadSummaryPdf = async (e) => {
    e?.preventDefault();
    setIsDownloadingPdf(true);
    setPdfError(null);
    try {
      await detectionService.downloadSummaryReport(
        pdfStartDate || null,
        pdfEndDate || null
      );
      setIsPdfModalOpen(false);
    } catch (err) {
      console.error("Failed to generate summary PDF:", err);
      setPdfError(err.message || "Failed to download executive summary report.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await detectionService.getStatistics();
      if (res) {
        setStats({
          totalInspections: res.total_inspections ?? res.totalInspections ?? 0,
          totalDefects: res.total_defects ?? res.totalDefects ?? 0,
          potholeCount: res.pothole_count ?? res.potholeCount ?? 0,
          crackCount: res.crack_count ?? res.crackCount ?? 0,
          criticalCount: res.critical_count ?? res.criticalCount ?? 0,
          repairsPending: res.repairs_pending ?? res.repairsPending ?? 0,
          repairsCompleted: res.repairs_completed ?? res.repairsCompleted ?? 0,
          cameraCount: res.camera_count ?? res.cameraCount ?? 0,
          systemHealth: res.system_health ?? res.systemHealth ?? "Healthy",
          categoryDistribution: res.category_distribution ?? res.categoryDistribution ?? {},
          severityDistribution: res.severity_distribution ?? res.severityDistribution ?? {
            Critical: 0,
            High: 0,
            Medium: 0,
            Low: 0,
          },
          inspectionTrends: Array.isArray(res.inspection_trends)
            ? res.inspection_trends
            : Array.isArray(res.inspectionTrends)
            ? res.inspectionTrends
            : [],
        });
      }
    } catch (err) {
      console.warn("[Analytics] Error loading statistics:", err);
      setError(err.message || "Failed to load consolidated analytics metrics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Real timeline data from backend
  const hasTrends = stats.inspectionTrends && stats.inspectionTrends.length > 0;
  const lineChartData = {
    labels: hasTrends ? stats.inspectionTrends.map((t) => t.date) : [],
    datasets: [
      {
        label: "Road Inspections",
        data: hasTrends ? stats.inspectionTrends.map((t) => t.inspections) : [],
        borderColor: "#0f294a",
        backgroundColor: "rgba(15, 41, 74, 0.08)",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: "#0f294a",
        pointRadius: 4,
      },
      {
        label: "Detected Defects",
        data: hasTrends ? stats.inspectionTrends.map((t) => t.defects) : [],
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.06)",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: "#ef4444",
        pointRadius: 4,
      },
    ],
  };

  // Real category breakdown data from backend
  const categoryKeys = Object.keys(stats.categoryDistribution || {});
  const hasCategories = categoryKeys.length > 0 && stats.totalDefects > 0;
  const categoryColors = [
    "#0f294a",
    "#3b82f6",
    "#8b5cf6",
    "#ef4444",
    "#f59e0b",
    "#10b981",
  ];
  const doughnutData = {
    labels: categoryKeys,
    datasets: [
      {
        label: "Defects Count",
        data: categoryKeys.map((k) => stats.categoryDistribution[k]),
        backgroundColor: categoryColors.slice(0, categoryKeys.length),
        borderWidth: 1,
      },
    ],
  };

  // Real severity distribution bar data from backend
  const totalSeverityCount =
    (stats.severityDistribution.Critical || 0) +
    (stats.severityDistribution.High || 0) +
    (stats.severityDistribution.Medium || 0) +
    (stats.severityDistribution.Low || 0);
  const hasSeverityData = totalSeverityCount > 0;

  const severityBarData = {
    labels: ["Critical", "High", "Medium", "Low"],
    datasets: [
      {
        label: "Defects Count by Severity",
        data: [
          stats.severityDistribution.Critical || 0,
          stats.severityDistribution.High || 0,
          stats.severityDistribution.Medium || 0,
          stats.severityDistribution.Low || 0,
        ],
        backgroundColor: ["#dc2626", "#ea580c", "#2563eb", "#10b981"],
        borderRadius: 8,
      },
    ],
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none text-slate-800">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f294a]/10 flex items-center justify-center text-[#0f294a]">
              <FaChartLine className="text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                Aggregated System Analytics
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Genuine MongoDB inspection trends, defect distributions, and RDD2022 telemetry
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-2 transition"
          >
            <FaSyncAlt className={isLoading ? "animate-spin" : ""} /> Reload Registry Stats
          </button>
          {isAdmin ? (
            <button
              onClick={() => {
                setPdfError(null);
                setIsPdfModalOpen(true);
              }}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-sm"
            >
              <FaFilePdf /> Download Summary PDF
            </button>
          ) : (
            <button
              disabled
              title="Executive Summary PDF export is restricted to Administrators"
              className="px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 font-bold rounded-xl text-xs flex items-center gap-2 cursor-not-allowed"
            >
              <FaFilePdf /> Summary PDF (Admin Only)
            </button>
          )}
        </div>
      </div>

      {/* Error state banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FaExclamationTriangle className="text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchStats}
            className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Live Statistics KPI Strip - 100% Real Database Data */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Inspections
          </span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1 block">
            {stats.totalInspections}
          </span>
          <span className="text-[10px] text-slate-400">Archived scans</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
            Total Defects
          </span>
          <span className="text-xl font-black text-amber-600 font-mono mt-1 block">
            {stats.totalDefects}
          </span>
          <span className="text-[10px] text-slate-400">Localized road flaws</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">
            Potholes
          </span>
          <span className="text-xl font-black text-red-600 font-mono mt-1 block">
            {stats.potholeCount}
          </span>
          <span className="text-[10px] text-slate-400">Cavities detected</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">
            Cracks
          </span>
          <span className="text-xl font-black text-blue-600 font-mono mt-1 block">
            {stats.crackCount}
          </span>
          <span className="text-[10px] text-slate-400">All crack types</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">
            Critical Flaws
          </span>
          <span className="text-xl font-black text-purple-600 font-mono mt-1 block">
            {stats.criticalCount}
          </span>
          <span className="text-[10px] text-slate-400">Requires triage</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">
            Pipeline Health
          </span>
          <span className="text-xl font-black text-emerald-600 font-mono mt-1 block">
            {stats.systemHealth}
          </span>
          <span className="text-[10px] text-slate-400">RDD2022-YOLOv8s</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Main Line Chart: Temporal Inspection & Defect Trends */}
        <div className="col-span-12 xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[420px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Inspection & Anomaly Trends Over Time
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Daily volumetric tracking of inspection sessions and detected defects
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-400">MongoDB Temporal Aggregation</span>
          </div>

          <div className="h-[320px] flex items-center justify-center">
            {hasTrends ? (
              <Line data={lineChartData} options={chartOptions} />
            ) : (
              <div className="text-center text-slate-400 p-8">
                <FaFolderOpen className="text-4xl text-slate-300 mx-auto mb-2" />
                <span className="text-xs font-semibold block">Insufficient Timeline Records</span>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Inspection records will automatically plot along this timeline as scans are performed across dates.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown: Doughnut Chart */}
        <div className="col-span-12 xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[420px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Defect Category Breakdown
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Class distribution by RDD2022 detector
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Normalized Classes</span>
          </div>

          <div className="h-[320px] flex items-center justify-center">
            {hasCategories ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="text-center text-slate-400 p-8">
                <FaRoad className="text-4xl text-slate-300 mx-auto mb-2" />
                <span className="text-xs font-semibold block">No Category Records</span>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Run road damage detection scans to see category distribution (potholes, cracks).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bar Chart: Severity Distribution */}
        <div className="col-span-12 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Defect Severity Classification Distribution
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Heuristic severity score groups across all localized defects
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-400">No Double-Counting</span>
          </div>

          <div className="h-[300px] flex items-center justify-center">
            {hasSeverityData ? (
              <Bar data={severityBarData} options={chartOptions} />
            ) : (
              <div className="text-center text-slate-400 p-8">
                <FaFolderOpen className="text-4xl text-slate-300 mx-auto mb-2" />
                <span className="text-xs font-semibold block">No Severity Data Available</span>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Localized defects evaluated by the severity heuristic will be grouped here into Critical, High, Medium, and Low tiers.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= SUMMARY REPORT PDF EXPORT MODAL ================= */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <FaFilePdf className="text-rose-600" />
                Generate Executive Summary Report
              </h3>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <FaTimes size={14} />
              </button>
            </div>

            {pdfError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                {pdfError}
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              Generate a formal, publication-ready PDF report summarizing inspections, defect classifications,
              severity distribution, and maintenance work order operations directly from MongoDB.
            </p>

            <form onSubmit={handleDownloadSummaryPdf} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <FaCalendarAlt className="text-slate-400" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={pdfStartDate}
                    onChange={(e) => setPdfStartDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <FaCalendarAlt className="text-slate-400" /> End Date
                  </label>
                  <input
                    type="date"
                    value={pdfEndDate}
                    onChange={(e) => setPdfEndDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                *Leave date fields empty to generate an all-time summary across all recorded inspections.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDownloadingPdf}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  {isDownloadingPdf ? (
                    <FaSyncAlt className="animate-spin text-xs" />
                  ) : (
                    <FaFilePdf />
                  )}
                  Generate & Download PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
