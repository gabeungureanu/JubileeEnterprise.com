/**
 * Jubilee Inspire - Images Screen
 *
 * Visual workspace for image generation, analysis, and editing.
 * Similar to ChatGPT's Images tab functionality.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  useWindowDimensions,
  Alert,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { spacing, typography } from '../config';
import { RootStackParamList, ImageMode, ImageItem } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useDrawer } from '../contexts/DrawerContext';
import { imagesApi } from '../services';

type Props = NativeStackScreenProps<RootStackParamList, 'Images'>;

// Responsive breakpoints
const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
};

const ImagesScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { isMobileView, toggleCollapse } = useDrawer();
  const { width: windowWidth } = useWindowDimensions();

  const isMobile = windowWidth < BREAKPOINTS.tablet;

  // State
  const [activeMode, setActiveMode] = useState<ImageMode>('generate');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<ImageItem[]>([]);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  // Image style options for generation
  const [selectedStyle, setSelectedStyle] = useState<'natural' | 'vivid' | 'artistic'>('natural');
  const [selectedSize, setSelectedSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');

  const inputRef = useRef<TextInput>(null);
  const styles = createStyles(colors, isMobile);

  // Handle image generation
  const handleGenerate = useCallback(async () => {
    console.log('[ImagesScreen] handleGenerate called, prompt:', prompt);

    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a description for the image you want to generate');
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);

    try {
      console.log('[ImagesScreen] Calling imagesApi.generate...');
      const response = await imagesApi.generate({
        prompt: prompt.trim(),
        style: selectedStyle,
        size: selectedSize,
        quality: 'standard',
      });

      console.log('[ImagesScreen] Generate response:', response);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate image');
      }

      // Add generated image to list
      const newImage: ImageItem = {
        id: Date.now().toString(),
        url: response.data.imageUrl,
        thumbnailUrl: response.data.thumbnailUrl || response.data.imageUrl,
        prompt: prompt.trim(),
        mode: 'generate',
        width: parseInt(selectedSize.split('x')[0]),
        height: parseInt(selectedSize.split('x')[1]),
        createdAt: new Date(),
      };

      console.log('[ImagesScreen] Created new image:', newImage);
      setGeneratedImages(prev => [newImage, ...prev]);
      setSelectedImage(newImage);
      setPrompt('');
    } catch (error: any) {
      console.error('[ImagesScreen] Image generation error:', error);
      Alert.alert('Generation Failed', error.message || 'Failed to generate image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selectedStyle, selectedSize]);

  // Handle image upload for analysis/editing
  const handleUploadImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please grant access to your photo library to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadedImage(result.assets[0].uri);
        setSelectedImage({
          id: Date.now().toString(),
          url: result.assets[0].uri,
          mode: activeMode,
          createdAt: new Date(),
          isLocal: true,
          localUri: result.assets[0].uri,
        });
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
    }
  }, [activeMode]);

  // Handle image analysis
  const handleAnalyze = useCallback(async () => {
    console.log('[ImagesScreen] handleAnalyze called');

    if (!uploadedImage && !selectedImage) {
      Alert.alert('Error', 'Please upload an image to analyze');
      return;
    }

    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a question about the image');
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);

    try {
      console.log('[ImagesScreen] Calling imagesApi.analyze...');
      const response = await imagesApi.analyze({
        imageUrl: selectedImage?.url || uploadedImage || undefined,
        question: prompt.trim(),
      });

      console.log('[ImagesScreen] Analyze response:', response);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to analyze image');
      }

      setAnalysisResult(response.data.analysis);
      setPrompt('');
    } catch (error: any) {
      console.error('[ImagesScreen] Image analysis error:', error);
      Alert.alert('Analysis Failed', error.message || 'Failed to analyze image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [uploadedImage, selectedImage, prompt]);

  // Handle image editing
  const handleEdit = useCallback(async () => {
    console.log('[ImagesScreen] handleEdit called');

    if (!uploadedImage && !selectedImage) {
      Alert.alert('Error', 'Please upload an image to edit');
      return;
    }

    if (!prompt.trim()) {
      Alert.alert('Error', 'Please describe the changes you want to make');
      return;
    }

    setIsLoading(true);

    try {
      console.log('[ImagesScreen] Calling imagesApi.edit...');
      const response = await imagesApi.edit({
        imageUrl: selectedImage?.url || uploadedImage || undefined,
        instruction: prompt.trim(),
      });

      console.log('[ImagesScreen] Edit response:', response);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to edit image');
      }

      // Add edited image to list
      const newImage: ImageItem = {
        id: Date.now().toString(),
        url: response.data.imageUrl,
        thumbnailUrl: response.data.thumbnailUrl || response.data.imageUrl,
        prompt: prompt.trim(),
        mode: 'edit',
        createdAt: new Date(),
      };

      console.log('[ImagesScreen] Created edited image:', newImage);
      setGeneratedImages(prev => [newImage, ...prev]);
      setSelectedImage(newImage);
      setPrompt('');
    } catch (error: any) {
      console.error('[ImagesScreen] Image edit error:', error);
      Alert.alert('Edit Failed', error.message || 'Failed to edit image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [uploadedImage, selectedImage, prompt]);

  // Submit handler based on mode
  const handleSubmit = useCallback(() => {
    console.log('[ImagesScreen] handleSubmit called, activeMode:', activeMode, 'prompt:', prompt);
    switch (activeMode) {
      case 'generate':
        handleGenerate();
        break;
      case 'analyze':
        handleAnalyze();
        break;
      case 'edit':
        handleEdit();
        break;
    }
  }, [activeMode, handleGenerate, handleAnalyze, handleEdit, prompt]);

  // Mode tabs
  const modeTabs: { id: ImageMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'generate', label: 'Generate', icon: 'sparkles-outline' },
    { id: 'analyze', label: 'Analyze', icon: 'eye-outline' },
    { id: 'edit', label: 'Edit', icon: 'brush-outline' },
  ];

  // Render mode tabs
  const renderModeTabs = () => (
    <View style={styles.tabContainer}>
      {modeTabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tab,
            activeMode === tab.id && styles.tabActive,
            hoveredTab === tab.id && activeMode !== tab.id && styles.tabHovered,
          ]}
          onPress={() => {
            setActiveMode(tab.id);
            setAnalysisResult(null);
          }}
          {...(Platform.OS === 'web' ? {
            onMouseEnter: () => setHoveredTab(tab.id),
            onMouseLeave: () => setHoveredTab(null),
          } as any : {})}
        >
          <Ionicons
            name={tab.icon}
            size={18}
            color={activeMode === tab.id ? colors.primary : colors.textSecondary}
          />
          <Text style={[
            styles.tabText,
            activeMode === tab.id && styles.tabTextActive,
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render image preview area
  const renderImagePreview = () => {
    if (selectedImage) {
      return (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: selectedImage.url }}
            style={styles.previewImage}
            resizeMode="contain"
          />
          {selectedImage.prompt && (
            <Text style={styles.previewPrompt} numberOfLines={2}>
              {selectedImage.prompt}
            </Text>
          )}
          <TouchableOpacity
            style={styles.clearPreviewButton}
            onPress={() => {
              setSelectedImage(null);
              setUploadedImage(null);
            }}
          >
            <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      );
    }

    if (activeMode === 'generate') {
      return (
        <View style={styles.emptyPreview}>
          <Ionicons name="image-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyPreviewText}>
            Describe an image to generate
          </Text>
          <Text style={styles.emptyPreviewSubtext}>
            Be specific about style, colors, and composition
          </Text>
        </View>
      );
    }

    return (
      <TouchableOpacity style={styles.uploadArea} onPress={handleUploadImage}>
        <Ionicons name="cloud-upload-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.uploadText}>
          {activeMode === 'analyze' ? 'Upload an image to analyze' : 'Upload an image to edit'}
        </Text>
        <Text style={styles.uploadSubtext}>
          Tap to select from your library
        </Text>
      </TouchableOpacity>
    );
  };

  // Render analysis result
  const renderAnalysisResult = () => {
    if (!analysisResult) return null;

    return (
      <View style={styles.analysisContainer}>
        <Text style={styles.analysisTitle}>Analysis</Text>
        <Text style={styles.analysisText}>{analysisResult}</Text>
      </View>
    );
  };

  // Render style options for generation
  const renderStyleOptions = () => {
    if (activeMode !== 'generate') return null;

    const styleOptions: { id: 'natural' | 'vivid' | 'artistic'; label: string }[] = [
      { id: 'natural', label: 'Natural' },
      { id: 'vivid', label: 'Vivid' },
      { id: 'artistic', label: 'Artistic' },
    ];

    return (
      <View style={styles.optionsContainer}>
        <Text style={styles.optionsLabel}>Style</Text>
        <View style={styles.optionsRow}>
          {styleOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionChip,
                selectedStyle === option.id && styles.optionChipSelected,
              ]}
              onPress={() => setSelectedStyle(option.id)}
            >
              <Text style={[
                styles.optionChipText,
                selectedStyle === option.id && styles.optionChipTextSelected,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Render gallery of generated images
  const renderGallery = () => {
    if (generatedImages.length === 0) return null;

    return (
      <View style={styles.galleryContainer}>
        <Text style={styles.galleryTitle}>Recent Images</Text>
        <FlatList
          data={generatedImages}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.galleryItem,
                selectedImage?.id === item.id && styles.galleryItemSelected,
              ]}
              onPress={() => setSelectedImage(item)}
            >
              <Image
                source={{ uri: item.thumbnailUrl || item.url }}
                style={styles.galleryImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.galleryList}
        />
      </View>
    );
  };

  // Get placeholder text based on mode
  const getPlaceholderText = () => {
    switch (activeMode) {
      case 'generate':
        return 'Describe the image you want to create...';
      case 'analyze':
        return 'What would you like to know about this image?';
      case 'edit':
        return 'Describe the changes you want to make...';
    }
  };

  // Get submit button text
  const getSubmitButtonText = () => {
    switch (activeMode) {
      case 'generate':
        return 'Generate';
      case 'analyze':
        return 'Analyze';
      case 'edit':
        return 'Apply Edit';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {isMobileView && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Images</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Mode Tabs */}
      {renderModeTabs()}

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Preview / Upload Area */}
        {renderImagePreview()}

        {/* Analysis Result */}
        {renderAnalysisResult()}

        {/* Style Options (for generation) */}
        {renderStyleOptions()}

        {/* Gallery */}
        {renderGallery()}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        {(activeMode === 'analyze' || activeMode === 'edit') && !selectedImage && (
          <TouchableOpacity style={styles.uploadButton} onPress={handleUploadImage}>
            <Ionicons name="image-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder={getPlaceholderText()}
          placeholderTextColor={colors.placeholder || '#8e8e8e'}
          multiline
          maxLength={1000}
          editable={!isLoading}
          onSubmitEditing={() => {
            if (prompt.trim() && !isLoading) {
              handleSubmit();
            }
          }}
        />
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            (!prompt.trim() || isLoading) && styles.submitButtonDisabled,
            pressed && styles.submitButtonPressed,
          ]}
          onPress={() => {
            console.log('[ImagesScreen] Submit button pressed, prompt:', prompt, 'isLoading:', isLoading);
            if (prompt.trim() && !isLoading) {
              handleSubmit();
            } else {
              console.log('[ImagesScreen] Button press ignored - prompt empty or loading');
            }
          }}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <>
              <Ionicons
                name={activeMode === 'generate' ? 'sparkles' : activeMode === 'analyze' ? 'search' : 'color-wand'}
                size={18}
                color={!prompt.trim() ? colors.textSecondary : '#000000'}
              />
              <Text style={[
                styles.submitButtonText,
                !prompt.trim() && styles.submitButtonTextDisabled,
              ]}>
                {getSubmitButtonText()}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: any, isMobile: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary + '20',
  },
  tabHovered: {
    backgroundColor: colors.surfaceHover,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: isMobile ? 300 : 400,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPrompt: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    padding: spacing.sm,
  },
  clearPreviewButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
  },
  emptyPreview: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: isMobile ? 250 : 350,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyPreviewText: {
    fontSize: typography.fontSize.base,
    color: colors.text,
    marginTop: spacing.md,
    fontWeight: '500',
  },
  emptyPreviewSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  uploadArea: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: isMobile ? 250 : 350,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: typography.fontSize.base,
    color: colors.text,
    marginTop: spacing.md,
    fontWeight: '500',
  },
  uploadSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  analysisContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  analysisTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  analysisText: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    lineHeight: 22,
  },
  optionsContainer: {
    marginBottom: spacing.md,
  },
  optionsLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipSelected: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  optionChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  optionChipTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  galleryContainer: {
    marginTop: spacing.md,
  },
  galleryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  galleryList: {
    gap: spacing.sm,
  },
  galleryItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  galleryItemSelected: {
    borderColor: colors.primary,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  uploadButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.primary,
    gap: spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },
  submitButtonDisabled: {
    backgroundColor: colors.surface,
  },
  submitButtonPressed: {
    opacity: 0.8,
  },
  submitButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: '#000000',
  },
  submitButtonTextDisabled: {
    color: colors.textSecondary,
  },
});

export default ImagesScreen;
