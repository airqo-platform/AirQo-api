import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { AqHome01, AqBarChart01, AqSettings01 } from '../components';

describe('Vue Icon Components', () => {
  it('should render AqHome01 icon correctly', () => {
    const wrapper = mount(AqHome01);
    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.attributes('width')).toBe('24');
    expect(wrapper.attributes('height')).toBe('24');
  });

  it('should render with custom size', () => {
    const wrapper = mount(AqHome01, {
      props: { size: 32 },
    });
    expect(wrapper.attributes('width')).toBe('32');
    expect(wrapper.attributes('height')).toBe('32');
  });

  it('should render with custom size as string', () => {
    const wrapper = mount(AqBarChart01, {
      props: { size: '48px' },
    });
    expect(wrapper.attributes('width')).toBe('48px');
    expect(wrapper.attributes('height')).toBe('48px');
  });

  it('should apply custom class', () => {
    const wrapper = mount(AqSettings01, {
      props: { class: 'custom-icon-class' },
    });
    expect(wrapper.classes()).toContain('custom-icon-class');
  });

  it('should handle color prop correctly', () => {
    const wrapper = mount(AqHome01, {
      props: { color: '#ff0000' },
    });
    // Check that the component receives the color prop
    expect(wrapper.vm.color).toBe('#ff0000');
  });

  it('should have default props', () => {
    const wrapper = mount(AqBarChart01);
    expect(wrapper.vm.size).toBe(24);
    expect(wrapper.vm.color).toBeUndefined();
    expect(wrapper.vm.class).toBeUndefined();
  });

  it('should render multiple icons without conflict', () => {
    const wrapper = mount({
      template: `
        <div>
          <AqHome01 />
          <AqBarChart01 />
          <AqSettings01 />
        </div>
      `,
      components: { AqHome01, AqBarChart01, AqSettings01 },
    });

    const icons = wrapper.findAll('svg');
    expect(icons).toHaveLength(3);
  });

  it('should be responsive to size changes', async () => {
    const wrapper = mount(AqHome01, {
      props: { size: 24 },
    });

    expect(wrapper.attributes('width')).toBe('24');

    await wrapper.setProps({ size: 48 });
    expect(wrapper.attributes('width')).toBe('48');
  });

  it('should maintain aspect ratio', () => {
    const wrapper = mount(AqHome01, {
      props: { size: 32 },
    });

    expect(wrapper.attributes('width')).toBe(wrapper.attributes('height'));
  });

  it('should be accessible with proper svg attributes', () => {
    const wrapper = mount(AqHome01);
    const svg = wrapper.find('svg');

    expect(svg.attributes('xmlns')).toBe('http://www.w3.org/2000/svg');
    expect(svg.exists()).toBe(true);
  });
});
