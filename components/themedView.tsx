import { useColorScheme } from '@/hooks/use-color-scheme';
import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  
  // Define your default background colors here
  const backgroundColor = colorScheme === 'dark' 
    ? (darkColor ?? '#000000') 
    : (lightColor ?? '#FFFFFF');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}