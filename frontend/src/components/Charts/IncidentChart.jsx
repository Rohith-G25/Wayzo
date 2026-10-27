import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function IncidentChart({
  type = "line",
  data,
  labels,
  title,
  height = 280,
  showLegend = true,
}) {
  // Default fallback datasets if not supplied
  const defaultLabels = labels || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const defaultLineData = {
    labels: defaultLabels,
    datasets: [
      {
        label: "Potholes Detected",
        data: [12, 19, 15, 27, 34, 22, 18],
        borderColor: "#0f294a",
        backgroundColor: "rgba(15, 41, 74, 0.08)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#0f294a",
        pointRadius: 4,
      },
      {
        label: "Structural Cracks",
        data: [8, 11, 14, 18, 22, 19, 15],
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.08)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#f59e0b",
        pointRadius: 4,
      },
    ],
  };

  const defaultBarData = {
    labels: defaultLabels,
    datasets: [
      {
        label: "Critical Severity",
        data: [4, 7, 3, 9, 12, 5, 6],
        backgroundColor: "#ef4444",
        borderRadius: 6,
      },
      {
        label: "Repaired / Closed",
        data: [3, 5, 2, 8, 10, 4, 5],
        backgroundColor: "#10b981",
        borderRadius: 6,
      },
    ],
  };

  const defaultDoughnutData = {
    labels: ["Potholes", "Alligator Cracks", "Rutting", "Surface Ravelling"],
    datasets: [
      {
        data: [42, 28, 18, 12],
        backgroundColor: ["#0f294a", "#ef4444", "#f59e0b", "#64748b"],
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    ],
  };

  const chartData =
    data ||
    (type === "bar"
      ? defaultBarData
      : type === "doughnut"
      ? defaultDoughnutData
      : defaultLineData);

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: type === "doughnut" ? "bottom" : "top",
        labels: {
          color: "#475569",
          font: { family: "Inter, sans-serif", size: 11, weight: "600" },
          padding: 12,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "#0f294a",
        titleFont: { family: "Inter, sans-serif", size: 12, weight: "bold" },
        bodyFont: { family: "Inter, sans-serif", size: 11 },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales:
      type === "doughnut"
        ? {}
        : {
            x: {
              grid: { display: false },
              ticks: {
                color: "#64748b",
                font: { family: "Inter, sans-serif", size: 11 },
              },
            },
            y: {
              grid: { color: "#f1f5f9" },
              ticks: {
                color: "#64748b",
                font: { family: "Inter, sans-serif", size: 11 },
              },
            },
          },
  };

  return (
    <div className="w-full bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      {title && (
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {title}
          </h3>
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            AI Analytics Feed
          </span>
        </div>
      )}
      <div style={{ height: `${height}px` }} className="relative w-full">
        {type === "bar" && <Bar data={chartData} options={defaultOptions} />}
        {type === "doughnut" && <Doughnut data={chartData} options={defaultOptions} />}
        {type === "line" && <Line data={chartData} options={defaultOptions} />}
      </div>
    </div>
  );
}
