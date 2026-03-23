import { DefineComponent } from 'vue';

export interface IconProps {
  size?: number | string;
  color?: string;
  class?: string;
}

export type IconComponent = DefineComponent<IconProps>;
