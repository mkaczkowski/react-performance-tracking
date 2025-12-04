import { createRoot } from 'react-dom/client';

import { getAllScenarios, getScenario } from './scenarios';

/**
 * Lists all available test scenarios
 */
const ScenarioList = () => (
  <div>
    <h1>Available Scenarios</h1>
    <ul>
      {getAllScenarios().map((s) => (
        <li key={s.name}>
          <a href={`?scenario=${s.name}`}>{s.name}</a>
          {s.description && <span> - {s.description}</span>}
        </li>
      ))}
    </ul>
  </div>
);

/**
 * Main App component with scenario routing
 */
const App = () => {
  const params = new URLSearchParams(window.location.search);
  const scenarioName = params.get('scenario');

  // Render specific scenario
  if (scenarioName) {
    const scenario = getScenario(scenarioName);
    if (scenario) {
      const Component = scenario.component;
      return <Component />;
    }
    return (
      <div>
        <h1>Unknown scenario: {scenarioName}</h1>
        <p>
          <a href="/">View all scenarios</a>
        </p>
      </div>
    );
  }

  // Default: show scenario list
  return <ScenarioList />;
};

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export { App };
