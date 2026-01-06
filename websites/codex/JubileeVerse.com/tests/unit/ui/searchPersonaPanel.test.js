const fs = require('fs');
const path = require('path');

describe('Search persona panel markup', () => {
  it('renders the persona toggle and 12 Inspire persona rows', () => {
    const searchPath = path.join(__dirname, '..', '..', '..', 'views', 'pages', 'search.html');
    const html = fs.readFileSync(searchPath, 'utf8');

    expect(html).toContain('id="personaToggleBtn"');
    expect(html).toContain('id="personaPanel"');

    const personaItems = html.match(/<div class="persona-panel-item"/g) || [];
    expect(personaItems.length).toBe(12);
  });
});
