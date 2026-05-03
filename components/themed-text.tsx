import { StyleSheet, Text, type TextProps } from 'react-native';
import { useAuth } from '../app/_layout';

// Adding 'type' to the props definition to fix TypeScript errors[cite: 1, 2]
export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({ style, type = 'default', ...rest }: ThemedTextProps) {
  const { isDark } = useAuth();
  
  // Ensures visibility in both light and dark modes
  const color = isDark ? '#FFFFFF' : '#1A1A1A';

  return (
    <Text 
      style={[
        { color },
        type === 'title' ? styles.title : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        style
      ]} 
      {...rest} 
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: 'bold', lineHeight: 32 },
  subtitle: { fontSize: 20, fontWeight: 'bold' },
  defaultSemiBold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
});