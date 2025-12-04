import React, { useState, useMemo } from 'react';

interface ThresholdConfig {
  duration: number;
  rerenders: number;
  fps: number | null;
  heapGrowth: number | null;
  lcp: number | null;
  inp: number | null;
  cls: number | null;
}

interface TestConfig {
  warmup: boolean;
  throttleRate: number;
  iterations: number;
  networkThrottling: string;
  thresholds: ThresholdConfig;
}

interface ConfigBuilderProps {
  variant?: 'default' | 'embed';
}

const defaultConfig: TestConfig = {
  warmup: false,
  throttleRate: 1,
  iterations: 1,
  networkThrottling: 'none',
  thresholds: {
    duration: 500,
    rerenders: 20,
    fps: null,
    heapGrowth: null,
    lcp: null,
    inp: null,
    cls: null,
  },
};

const themes = {
  default: {
    bg: '#18181b',
    bgInput: '#0f0f10',
    border: '#27272a',
    text: '#fafafa',
    muted: '#71717a',
    accent: '#10b981',
    accentDim: '#10b98133',
  },
  embed: {
    bg: '#111827',
    bgInput: '#0c0f1a',
    border: 'rgba(148, 163, 184, 0.15)',
    text: '#f8fafc',
    muted: '#64748b',
    accent: '#3b82f6',
    accentDim: 'rgba(59, 130, 246, 0.2)',
  },
};

export function ConfigBuilder({ variant = 'default' }: ConfigBuilderProps) {
  const theme = themes[variant];
  const [config, setConfig] = useState<TestConfig>(defaultConfig);
  const [copied, setCopied] = useState(false);

  const updateConfig = (updates: Partial<TestConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const updateThresholds = (updates: Partial<ThresholdConfig>) => {
    setConfig((prev) => ({
      ...prev,
      thresholds: { ...prev.thresholds, ...updates },
    }));
  };

  const generatedCode = useMemo(() => {
    const { warmup, throttleRate, iterations, networkThrottling, thresholds } = config;

    const lines: string[] = ['test.performance({'];

    // Options
    if (warmup) lines.push('  warmup: true,');
    if (throttleRate > 1) lines.push(`  throttleRate: ${throttleRate},`);
    if (iterations > 1) lines.push(`  iterations: ${iterations},`);
    if (networkThrottling !== 'none') lines.push(`  networkThrottling: '${networkThrottling}',`);

    // Thresholds
    lines.push('  thresholds: {');
    lines.push('    base: {');

    // Profiler
    lines.push('      profiler: {');
    lines.push(
      `        '*': { duration: ${thresholds.duration}, rerenders: ${thresholds.rerenders} },`,
    );
    lines.push('      },');

    // Optional thresholds
    if (thresholds.fps !== null) {
      lines.push(`      fps: ${thresholds.fps},`);
    }
    if (thresholds.heapGrowth !== null) {
      lines.push(`      memory: { heapGrowth: ${thresholds.heapGrowth} * 1024 * 1024 },`);
    }
    if (thresholds.lcp !== null || thresholds.inp !== null || thresholds.cls !== null) {
      const webVitalsParts: string[] = [];
      if (thresholds.lcp !== null) webVitalsParts.push(`lcp: ${thresholds.lcp}`);
      if (thresholds.inp !== null) webVitalsParts.push(`inp: ${thresholds.inp}`);
      if (thresholds.cls !== null) webVitalsParts.push(`cls: ${thresholds.cls}`);
      lines.push(`      webVitals: { ${webVitalsParts.join(', ')} },`);
    }

    lines.push('    },');
    lines.push('  },');
    lines.push("})('test name', async ({ page, performance }) => {");
    lines.push("  await page.goto('/');");
    lines.push('  await performance.init();');
    lines.push('});');

    return lines.join('\n');
  }, [config]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="config-builder">
      <style>{`
        .config-builder {
          --cb-bg: ${theme.bg};
          --cb-bg-input: ${theme.bgInput};
          --cb-border: ${theme.border};
          --cb-text: ${theme.text};
          --cb-muted: ${theme.muted};
          --cb-accent: ${theme.accent};
          --cb-accent-dim: ${theme.accentDim};
          font-family: system-ui, -apple-system, sans-serif;
        }

        .config-builder * {
          box-sizing: border-box;
        }

        .cb-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 900px) {
          .cb-grid {
            grid-template-columns: 1fr;
          }
        }

        .cb-panel {
          background: var(--cb-bg);
          border: 1px solid var(--cb-border);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .cb-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--cb-text);
          margin: 0 0 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .cb-section {
          margin-bottom: 1.5rem;
        }

        .cb-section:last-child {
          margin-bottom: 0;
        }

        .cb-section-title {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--cb-muted);
          margin: 0 0 0.75rem;
        }

        .cb-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        .cb-row:last-child {
          margin-bottom: 0;
        }

        .cb-label {
          flex: 1;
          font-size: 0.875rem;
          color: var(--cb-text);
        }

        .cb-input {
          width: 100px;
          padding: 0.5rem 0.75rem;
          background: var(--cb-bg-input);
          border: 1px solid var(--cb-border);
          border-radius: 6px;
          color: var(--cb-text);
          font-size: 0.875rem;
          font-family: 'JetBrains Mono', monospace;
        }

        .cb-input:focus {
          outline: none;
          border-color: var(--cb-accent);
        }

        .cb-select {
          width: 140px;
          padding: 0.5rem 0.75rem;
          background: var(--cb-bg-input);
          border: 1px solid var(--cb-border);
          border-radius: 6px;
          color: var(--cb-text);
          font-size: 0.875rem;
        }

        .cb-select:focus {
          outline: none;
          border-color: var(--cb-accent);
        }

        .cb-checkbox {
          width: 20px;
          height: 20px;
          accent-color: var(--cb-accent);
          cursor: pointer;
        }

        .cb-code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .cb-copy-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--cb-accent-dim);
          border: 1px solid var(--cb-accent);
          border-radius: 6px;
          color: var(--cb-accent);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cb-copy-btn:hover {
          background: var(--cb-accent);
          color: #0a0a0b;
        }

        .cb-code {
          background: var(--cb-bg-input);
          border-radius: 8px;
          padding: 1rem;
          overflow-x: auto;
        }

        .cb-code pre {
          margin: 0;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #a1a1aa;
        }

        .cb-hint {
          font-size: 0.75rem;
          color: var(--cb-muted);
          margin-top: 0.25rem;
        }
      `}</style>

      <div className="cb-grid">
        {/* Configuration Panel */}
        <div className="cb-panel">
          <h3 className="cb-title">Configuration</h3>

          <div className="cb-section">
            <div className="cb-section-title">Test Options</div>

            <div className="cb-row">
              <span className="cb-label">Enable warmup iteration</span>
              <input
                type="checkbox"
                className="cb-checkbox"
                checked={config.warmup}
                onChange={(e) => updateConfig({ warmup: e.target.checked })}
              />
            </div>

            <div className="cb-row">
              <span className="cb-label">CPU throttle rate</span>
              <select
                className="cb-select"
                value={config.throttleRate}
                onChange={(e) => updateConfig({ throttleRate: Number(e.target.value) })}
              >
                <option value={1}>None (1x)</option>
                <option value={2}>2x slower</option>
                <option value={4}>4x slower</option>
                <option value={6}>6x slower</option>
              </select>
            </div>

            <div className="cb-row">
              <span className="cb-label">Test iterations</span>
              <input
                type="number"
                className="cb-input"
                min={1}
                max={20}
                value={config.iterations}
                onChange={(e) => updateConfig({ iterations: Number(e.target.value) })}
              />
            </div>

            <div className="cb-row">
              <span className="cb-label">Network throttling</span>
              <select
                className="cb-select"
                value={config.networkThrottling}
                onChange={(e) => updateConfig({ networkThrottling: e.target.value })}
              >
                <option value="none">None</option>
                <option value="fast-4g">Fast 4G</option>
                <option value="slow-4g">Slow 4G</option>
                <option value="fast-3g">Fast 3G</option>
                <option value="slow-3g">Slow 3G</option>
              </select>
            </div>
          </div>

          <div className="cb-section">
            <div className="cb-section-title">Profiler Thresholds</div>

            <div className="cb-row">
              <span className="cb-label">Max duration (ms)</span>
              <input
                type="number"
                className="cb-input"
                min={0}
                value={config.thresholds.duration}
                onChange={(e) => updateThresholds({ duration: Number(e.target.value) })}
              />
            </div>

            <div className="cb-row">
              <span className="cb-label">Max rerenders</span>
              <input
                type="number"
                className="cb-input"
                min={0}
                value={config.thresholds.rerenders}
                onChange={(e) => updateThresholds({ rerenders: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="cb-section">
            <div className="cb-section-title">Other Thresholds</div>

            <div className="cb-row">
              <span className="cb-label">Min FPS (Chromium)</span>
              <input
                type="number"
                className="cb-input"
                min={0}
                placeholder="—"
                value={config.thresholds.fps ?? ''}
                onChange={(e) =>
                  updateThresholds({ fps: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>

            <div className="cb-row">
              <span className="cb-label">Max heap growth (MB)</span>
              <input
                type="number"
                className="cb-input"
                min={0}
                placeholder="—"
                value={config.thresholds.heapGrowth ?? ''}
                onChange={(e) =>
                  updateThresholds({ heapGrowth: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>

            <div className="cb-row">
              <span className="cb-label">Max LCP (ms)</span>
              <input
                type="number"
                className="cb-input"
                min={0}
                placeholder="—"
                value={config.thresholds.lcp ?? ''}
                onChange={(e) =>
                  updateThresholds({ lcp: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>

            <div className="cb-row">
              <span className="cb-label">Max INP (ms)</span>
              <input
                type="number"
                className="cb-input"
                min={0}
                placeholder="—"
                value={config.thresholds.inp ?? ''}
                onChange={(e) =>
                  updateThresholds({ inp: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>

            <div className="cb-row">
              <span className="cb-label">Max CLS</span>
              <input
                type="number"
                className="cb-input"
                min={0}
                step={0.01}
                placeholder="—"
                value={config.thresholds.cls ?? ''}
                onChange={(e) =>
                  updateThresholds({ cls: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
          </div>
        </div>

        {/* Code Output Panel */}
        <div className="cb-panel">
          <div className="cb-code-header">
            <h3 className="cb-title" style={{ margin: 0 }}>
              Generated Code
            </h3>
            <button className="cb-copy-btn" onClick={copyToClipboard}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          <div className="cb-code">
            <pre>{generatedCode}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
