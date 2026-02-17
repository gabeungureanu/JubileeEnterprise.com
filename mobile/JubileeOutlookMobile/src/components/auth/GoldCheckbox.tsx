/**
 * GoldCheckbox — Custom checkbox matching the web frontend's auth design.
 * Gold border + check mark when checked, dark background.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

interface GoldCheckboxProps {
  checked: boolean;
  onToggle: (value: boolean) => void;
  label: string;
}

const GoldCheckbox: React.FC<GoldCheckboxProps> = ({ checked, onToggle, label }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onToggle(!checked)}
      activeOpacity={0.7}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Icon name="check" size={16} color={Colors.gold} />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    borderColor: Colors.gold,
    backgroundColor: '#1A1A00',
  },
  label: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
});

export default GoldCheckbox;
