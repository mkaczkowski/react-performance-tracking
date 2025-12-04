import type { ComponentType } from 'react';

export interface ScenarioConfig {
  name: string;
  component: ComponentType;
  description?: string;
}

const scenarios = new Map<string, ScenarioConfig>();

export function registerScenario(config: ScenarioConfig): void {
  scenarios.set(config.name, config);
}

export function getScenario(name: string): ScenarioConfig | undefined {
  return scenarios.get(name);
}

export function getAllScenarios(): ScenarioConfig[] {
  return Array.from(scenarios.values());
}
