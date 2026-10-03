import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

import { Badge, Button, Card, Text } from '../src';

const render = (element: ReactElement): string => renderToStaticMarkup(element);

describe('Button', () => {
  it('defaults to a non-submitting primary button', () => {
    const html = render(<Button>Save</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain('Save');
  });

  it('honours an explicit submit type', () => {
    expect(render(<Button type="submit">Save</Button>)).toContain('type="submit"');
  });

  it('disables itself and announces busy state while loading', () => {
    const html = render(<Button loading>Saving</Button>);
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
  });

  it('does not announce busy state when idle', () => {
    expect(render(<Button>Save</Button>)).not.toContain('aria-busy');
  });

  it('forwards native attributes and custom styles', () => {
    const html = render(
      <Button data-testid="submit" style={{ backgroundColor: 'rebeccapurple' }}>
        Save
      </Button>,
    );
    expect(html).toContain('data-testid="submit"');
    expect(html).toContain('background-color:rebeccapurple');
  });
});

describe('Card', () => {
  it('renders an accessible heading when titled', () => {
    const html = render(<Card title="Headcount">12</Card>);
    expect(html).toContain('<h2');
    expect(html).toContain('Headcount');
  });

  it('omits the header block when neither title nor subtitle is given', () => {
    const html = render(<Card>content</Card>);
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('<header');
  });

  it('renders subtitle and footer regions', () => {
    const html = render(<Card title="Claims" subtitle="This month" footer={<Text>Total</Text>} />);
    expect(html).toContain('This month');
    expect(html).toContain('<footer');
  });
});

describe('Badge', () => {
  it('always carries a textual label rather than relying on colour alone', () => {
    const html = render(<Badge tone="danger">Rejected</Badge>);
    expect(html).toContain('Rejected');
  });
});
