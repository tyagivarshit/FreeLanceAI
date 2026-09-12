const fs = require('fs');

let mainCode = fs.readFileSync('apps/frontend/src/main.jsx', 'utf8');

mainCode = mainCode.replace(
  "import Billing from './pages/Billing'",
  "import Billing from './pages/Billing'\nimport Prompts from './pages/Prompts'\nimport Memory from './pages/Memory'\nimport Policies from './pages/Policies'"
);

mainCode = mainCode.replace(
  '<Route path="billing" element={<Billing />} />',
  '<Route path="billing" element={<Billing />} />\n          <Route path="prompts" element={<Prompts />} />\n          <Route path="memory" element={<Memory />} />\n          <Route path="policies" element={<Policies />} />'
);

fs.writeFileSync('apps/frontend/src/main.jsx', mainCode);
console.log('Updated main.jsx');

let layoutCode = fs.readFileSync('apps/frontend/src/components/Layout.jsx', 'utf8');

const navInjection = `
          <div className="nav-divider"></div>
          <span style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Setup</span>
          <NavLink to="/prompts" className={({isActive}) => \`nav-item \${isActive ? 'active' : ''}\`}>
            <span className="nav-label">Prompt Registry</span>
          </NavLink>
          <NavLink to="/memory" className={({isActive}) => \`nav-item \${isActive ? 'active' : ''}\`}>
            <span className="nav-label">Client Memory</span>
          </NavLink>
          <NavLink to="/policies" className={({isActive}) => \`nav-item \${isActive ? 'active' : ''}\`}>
            <span className="nav-label">Policy Engine</span>
          </NavLink>
          <div className="nav-divider"></div>
`;

layoutCode = layoutCode.replace(
  '<div className="nav-divider"></div>\n          \n          <NavLink to="/billing"',
  navInjection + '\n          <NavLink to="/billing"'
);

fs.writeFileSync('apps/frontend/src/components/Layout.jsx', layoutCode);
console.log('Updated Layout.jsx');
