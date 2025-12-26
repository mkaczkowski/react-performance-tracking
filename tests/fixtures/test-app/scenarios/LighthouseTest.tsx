import { registerScenario } from './registry';

/**
 * Lighthouse test scenario - optimized for Lighthouse audits.
 * Includes semantic HTML, accessible content, and good performance patterns.
 *
 * Note: No PerformanceProvider needed - Lighthouse runs in its own Chrome instance
 * and audits the page independently. This scenario is for Lighthouse-only tests.
 */
export const LighthouseTest = () => {
  return (
    <main role="main" aria-label="Main content">
      <header>
        <h1>Lighthouse Test Page</h1>
        <nav aria-label="Primary navigation">
          <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', padding: 0 }}>
            <li>
              <a href="#home" style={{ color: '#0066cc' }}>
                Home
              </a>
            </li>
            <li>
              <a href="#about" style={{ color: '#0066cc' }}>
                About
              </a>
            </li>
            <li>
              <a href="#contact" style={{ color: '#0066cc' }}>
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </header>

      <section aria-labelledby="welcome-heading" style={{ marginTop: '2rem' }}>
        <h2 id="welcome-heading">Welcome</h2>
        <p style={{ color: '#333', lineHeight: 1.6 }}>
          This is a test page designed for Lighthouse audits. It includes proper semantic HTML,
          accessible content, and follows best practices for web performance.
        </p>
      </section>

      <section aria-labelledby="features-heading" style={{ marginTop: '2rem' }}>
        <h2 id="features-heading">Features</h2>
        <ul style={{ color: '#333' }}>
          <li>Semantic HTML structure</li>
          <li>ARIA landmarks and labels</li>
          <li>Good color contrast</li>
          <li>Accessible navigation</li>
        </ul>
      </section>

      <section aria-labelledby="form-heading" style={{ marginTop: '2rem' }}>
        <h2 id="form-heading">Contact Form</h2>
        <form
          aria-label="Contact form"
          onSubmit={(e) => e.preventDefault()}
          style={{ maxWidth: '400px' }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="name"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              autoComplete="name"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #666',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #666',
                borderRadius: '4px',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0066cc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Submit
          </button>
        </form>
      </section>

      <footer style={{ marginTop: '3rem', borderTop: '1px solid #ccc', paddingTop: '1rem' }}>
        <p style={{ color: '#666' }}>Lighthouse Test App</p>
      </footer>
    </main>
  );
};

registerScenario({
  name: 'lighthouse',
  component: LighthouseTest,
  description: 'Lighthouse audit test with semantic HTML and accessibility features',
});
