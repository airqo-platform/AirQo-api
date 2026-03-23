import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AqUganda, AqHome01, AqBarChart01 } from '../index';

// Type assertion helper for SVG props
const createAqUgandaWithSVGProps = (props: any) => <AqUganda {...props} />;

describe('AirQO Icons React', () => {
  test('renders AqUganda flag icon', () => {
    render(<AqUganda data-testid="uganda-icon" />);
    const icon = screen.getByTestId('uganda-icon');
    expect(icon).toBeInTheDocument();
    expect(icon.nodeName.toLowerCase()).toBe('svg');
  });

  test('renders AqHome01 icon with custom size', () => {
    render(<AqHome01 size={32} data-testid="home-icon" />);
    const icon = screen.getByTestId('home-icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('width', '32');
    expect(icon).toHaveAttribute('height', '32');
  });

  test('renders AqBarChart01 icon with custom color', () => {
    render(<AqBarChart01 color="#ff0000" data-testid="chart-icon" />);
    const icon = screen.getByTestId('chart-icon');
    expect(icon).toBeInTheDocument();

    // Check the path element has the stroke color
    const path = icon.querySelector('path');
    expect(path).toHaveAttribute('stroke', '#ff0000');
  });

  test('applies custom className', () => {
    render(<AqUganda className="custom-class" data-testid="uganda-icon" />);
    const icon = screen.getByTestId('uganda-icon');
    expect(icon).toHaveClass('custom-class');
  });

  test('has proper default props', () => {
    render(<AqHome01 data-testid="home-icon" />);
    const icon = screen.getByTestId('home-icon');
    expect(icon).toHaveAttribute('width', '24');
    expect(icon).toHaveAttribute('height', '24');
    expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
    expect(icon).toHaveAttribute('fill', 'none');
  });

  test('accepts all SVG props via spread', () => {
    const handleClick = jest.fn();
    const component = createAqUgandaWithSVGProps({
      'data-testid': 'uganda-icon',
      onClick: handleClick,
      role: 'button',
      'aria-label': 'Uganda flag',
    });

    render(component);
    const icon = screen.getByTestId('uganda-icon');
    expect(icon).toHaveAttribute('role', 'button');
    expect(icon).toHaveAttribute('aria-label', 'Uganda flag');

    // Test click handler
    fireEvent.click(icon);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('forwards ref correctly', () => {
    const ref = React.createRef<SVGSVGElement>();
    render(<AqUganda ref={ref} data-testid="uganda-icon" />);

    expect(ref.current).not.toBeNull();
    expect(ref.current?.nodeName.toLowerCase()).toBe('svg');
  });

  test('all icons have consistent interface', () => {
    const icons = [AqUganda, AqHome01, AqBarChart01];

    icons.forEach((IconComponent, index) => {
      render(<IconComponent data-testid={`icon-${index}`} size={20} color="#123456" />);
      const icon = screen.getByTestId(`icon-${index}`);

      expect(icon).toBeInTheDocument();
      expect(icon.nodeName.toLowerCase()).toBe('svg');
      expect(icon).toHaveAttribute('width', '20');
      expect(icon).toHaveAttribute('height', '20');
    });
  });
});
