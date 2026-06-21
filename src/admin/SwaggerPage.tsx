import { useTranslation } from 'react-i18next';
import { FileJson, FileText, ExternalLink } from 'lucide-react';
import { getSwaggerJson, getSwaggerYaml, getSwaggerUI } from '../api';

export default function SwaggerPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">API документация</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Документация REST API в формате OpenAPI / Swagger. Доступны спецификации в JSON и YAML форматах.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={getSwaggerJson()}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-all active:scale-[0.97]"
            >
              <FileJson size={16} />
              JSON
            </a>
            <a
              href={getSwaggerYaml()}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-all active:scale-[0.97]"
            >
              <FileText size={16} />
              YAML
            </a>
            <a
              href={getSwaggerUI()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-xl text-sm font-medium transition-all active:scale-[0.97]"
            >
              <ExternalLink size={16} />
              {t('open_in_new_tab')}
            </a>
          </div>
        </div>
        <iframe
          src={getSwaggerUI()}
          title="Swagger UI"
          className="w-full h-[calc(100vh-200px)] min-h-[400px] rounded-xl border border-zinc-200 dark:border-zinc-700"
        />
      </div>
    </div>
  );
}
