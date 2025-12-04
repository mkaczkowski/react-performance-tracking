// Re-export registry functions
export { getAllScenarios, getScenario, registerScenario, type ScenarioConfig } from './registry';

// Import all scenarios to trigger registration
import './BasicProfiler';
import './FpsAnimation';
import './IterationsTest';
import './MemoryTest';
import './MultiComponent';
import './NetworkThrottling';
import './PercentileTest';
import './TraceExport';
import './WebVitalsTest';
