import React, { useState, useMemo } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomPickerProps {
  selectedValue: string;
  onValueChange: (itemValue: string) => void;
  items: { label: string; value: string; color?: string }[];
  placeholder?: string;
  style?: any;
  searchable?: boolean;
}

export function CustomPicker({ selectedValue, onValueChange, items, placeholder, style, searchable = false }: CustomPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // If NOT searchable AND on Web, use standard native HTML <select>
  if (Platform.OS === 'web' && !searchable) {
    const flatStyle = StyleSheet.flatten(style) || {};
    return (
      <select
        value={selectedValue}
        onChange={(e) => onValueChange(e.target.value)}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 50,
          border: 'none',
          backgroundColor: 'transparent',
          outline: 'none',
          fontSize: 15,
          color: '#1F2937',
          padding: '0 8px',
          cursor: 'pointer',
          ...flatStyle
        }}
      >
        {placeholder && <option value="" style={{ color: '#9CA3AF' }}>{placeholder}</option>}
        {items.map((item, idx) => (
          <option key={idx} value={item.value} style={{ color: item.color || '#1F2937' }}>
            {item.label}
          </option>
        ))}
      </select>
    );
  }

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) => item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const selectedItem = items.find((i) => i.value === selectedValue);

  // Extract text styles to apply to the Text component
  const flattenedStyle = StyleSheet.flatten(style || {});
  const textStyles = {
    color: flattenedStyle.color || '#1F2937',
    fontSize: flattenedStyle.fontSize || 14,
    fontWeight: flattenedStyle.fontWeight,
    fontFamily: flattenedStyle.fontFamily,
  };

  const handleOpenModal = () => {
    setSearchQuery('');
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <>
      <TouchableOpacity 
        style={[styles.pickerContainer, style, { color: undefined, fontSize: undefined, fontWeight: undefined, fontFamily: undefined }]} 
        onPress={handleOpenModal}
      >
        <View style={styles.textContainer}>
          <Text style={[styles.pickerText, textStyles, !selectedItem && { color: '#9CA3AF' }]} numberOfLines={1}>
            {selectedItem ? selectedItem.label : (placeholder || 'Select Option')}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>
      
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={handleCloseModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{placeholder || 'Select Option'}</Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {searchable && (
              <View style={styles.searchBoxContainer}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={`Search ${placeholder ? placeholder.toLowerCase() : 'options'}...`}
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus={Platform.OS === 'web'}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {placeholder && !searchQuery && (
                <TouchableOpacity 
                  style={styles.optionItem} 
                  onPress={() => { onValueChange(''); handleCloseModal(); }}
                >
                  <Text style={[styles.optionText, { color: '#9CA3AF' }]}>{placeholder}</Text>
                </TouchableOpacity>
              )}

              {filteredItems.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="search-outline" size={28} color="#9CA3AF" />
                  <Text style={styles.noResultsText}>No matching options found</Text>
                </View>
              ) : (
                filteredItems.map((item, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.optionItem, selectedValue === item.value && styles.optionItemSelected]} 
                    onPress={() => { onValueChange(item.value); handleCloseModal(); }}
                  >
                    <Text style={[styles.optionText, selectedValue === item.value && styles.optionTextSelected, item.color ? { color: item.color } : null]}>
                      {item.label}
                    </Text>
                    {selectedValue === item.value && (
                      <Ionicons name="checkmark" size={20} color="#0056FF" />
                    )}
                  </TouchableOpacity>
                ))
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickerText: {
    fontSize: 14,
    color: '#1F2937',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontWeight: '600',
    fontSize: 16,
    color: '#374151',
  },
  modalClose: {
    color: '#0056FF',
    fontWeight: '600',
    fontSize: 16,
  },
  searchBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    height: '100%',
  },
  clearSearchBtn: {
    padding: 4,
  },
  optionsList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionItemSelected: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    color: '#1F2937',
  },
  optionTextSelected: {
    color: '#0056FF',
    fontWeight: '600',
  },
  noResultsContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
});
