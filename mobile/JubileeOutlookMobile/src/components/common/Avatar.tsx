import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

interface AvatarProps {
  name?: string;
  imageUrl?: string;
  size?: number;
  backgroundColor?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
  }
  return (parts[0]?.[0] || '?').toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = ['#0078D4', '#107C10', '#D83B01', '#881798', '#008272', '#C239B3', '#E74856'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name = '?', imageUrl, size = 40, backgroundColor }: AvatarProps) {
  const bgColor = backgroundColor || getColorFromName(name);
  const fontSize = size * 0.4;

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    ...Typography.label,
    color: Colors.white,
    fontWeight: '600',
  },
});
