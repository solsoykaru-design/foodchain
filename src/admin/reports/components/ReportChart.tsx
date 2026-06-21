import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'];

interface ReportChartProps {
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed';
  data: any[];
  xKey?: string;
  yKey?: string;
  yKey2?: string;
  nameKey?: string;
  dataKey?: string;
  title?: string;
  height?: number;
}

export default function ReportChart({ type, data, xKey, yKey, yKey2, nameKey, dataKey, title, height = 300 }: ReportChartProps) {
  if (!data || data.length === 0) return null;

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
            <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={yKey || 'value'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            {yKey2 && <Bar dataKey={yKey2} fill="#10b981" radius={[4, 4, 0, 0]} />}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
            <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey={yKey || 'value'} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            {yKey2 && <Line type="monotone" dataKey={yKey2} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />}
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey || 'value'}
              nameKey={nameKey || 'name'}
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        );
      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
            <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey={yKey || 'value'} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
            {yKey2 && <Area type="monotone" dataKey={yKey2} stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />}
          </AreaChart>
        );
      case 'composed':
        return (
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
            <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={yKey || 'value'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey={yKey2 || 'value2'} stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      {title && <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart() as any}
      </ResponsiveContainer>
    </div>
  );
}
