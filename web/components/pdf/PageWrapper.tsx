import { Page, View, StyleSheet } from '@react-pdf/renderer';
import { BookFormat, BookTheme, FORMATS, DEFAULT_THEME } from '@/lib/book-types';
import { ReactNode } from 'react';

interface PageWrapperProps {
  format?: BookFormat;
  theme?: BookTheme;
  children: ReactNode;
  style?: object;
}

export const PageWrapper = ({
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  children,
  style = {},
}: PageWrapperProps) => {
  const { width, height } = format.dimensions;

  const styles = StyleSheet.create({
    page: {
      width,
      height,
      backgroundColor: theme.backgroundColor,
      ...style,
    },
    container: {
      width,
      height,
      overflow: 'hidden',
    },
  });

  return (
    <Page size={[width, height]} style={styles.page}>
      <View style={styles.container}>
        {children}
      </View>
    </Page>
  );
};
