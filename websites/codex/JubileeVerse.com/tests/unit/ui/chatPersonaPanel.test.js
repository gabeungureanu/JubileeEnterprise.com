const fs = require('fs');
const path = require('path');

describe('Chat persona panel markup', () => {
  it('renders the persona toggle and 12 Inspire persona rows', () => {
    const chatPath = path.join(__dirname, '..', '..', '..', 'views', 'pages', 'chat.html');
    const html = fs.readFileSync(chatPath, 'utf8');

    expect(html).toContain('id="personaToggleBtn"');
    expect(html).toContain('id="personaPanel"');

    const personaItems = html.match(/<div class="persona-rail-item"/g) || [];
    expect(personaItems.length).toBe(12);
  });
});
