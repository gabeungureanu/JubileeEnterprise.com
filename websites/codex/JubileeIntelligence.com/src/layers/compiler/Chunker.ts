import { ContentEntryWithMeta } from '../authoring/models/ContentEntry';

export interface Chunk {
  overlay_id: string;
  chunk_index: number;
  total_chunks: number;
  content: string;
  start_offset: number;
  end_offset: number;
}

export interface ChunkerOptions {
  maxChunkSize: number;      // Maximum characters per chunk
  overlapSize: number;       // Characters to overlap between chunks
  minChunkSize: number;      // Minimum chunk size (avoid tiny trailing chunks)
}

const DEFAULT_OPTIONS: ChunkerOptions = {
  maxChunkSize: 1000,
  overlapSize: 100,
  minChunkSize: 200
};

export class Chunker {
  private options: ChunkerOptions;

  constructor(options: Partial<ChunkerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Split content into overlapping chunks for embedding.
   * Preserves semantic boundaries (sentences, paragraphs) when possible.
   */
  chunkContent(entry: ContentEntryWithMeta): Chunk[] {
    const content = entry.content;

    // If content is small enough, return as single chunk
    if (content.length <= this.options.maxChunkSize) {
      return [{
        overlay_id: entry.overlay_id,
        chunk_index: 0,
        total_chunks: 1,
        content: content,
        start_offset: 0,
        end_offset: content.length
      }];
    }

    const chunks: Chunk[] = [];
    let position = 0;

    while (position < content.length) {
      // Calculate end position for this chunk
      let endPos = Math.min(position + this.options.maxChunkSize, content.length);

      // Try to break at sentence or paragraph boundary
      if (endPos < content.length) {
        endPos = this.findBestBreakPoint(content, position, endPos);
      }

      // Extract chunk content
      const chunkContent = content.slice(position, endPos);

      // Skip if remaining content is too small (merge with previous)
      if (chunks.length > 0 && chunkContent.length < this.options.minChunkSize) {
        // Extend the last chunk instead
        const lastChunk = chunks[chunks.length - 1];
        lastChunk.content += chunkContent;
        lastChunk.end_offset = endPos;
        break;
      }

      chunks.push({
        overlay_id: entry.overlay_id,
        chunk_index: chunks.length,
        total_chunks: 0, // Will be updated after
        content: chunkContent,
        start_offset: position,
        end_offset: endPos
      });

      // Move position forward, accounting for overlap
      position = endPos - this.options.overlapSize;

      // Prevent infinite loop
      if (position <= chunks[chunks.length - 1].start_offset) {
        position = endPos;
      }
    }

    // Update total_chunks for all chunks
    const totalChunks = chunks.length;
    for (const chunk of chunks) {
      chunk.total_chunks = totalChunks;
    }

    return chunks;
  }

  /**
   * Find the best break point near the target position.
   * Prefers paragraph breaks > sentence breaks > word breaks
   */
  private findBestBreakPoint(content: string, start: number, target: number): number {
    const searchWindow = Math.min(100, target - start);
    const windowStart = target - searchWindow;
    const window = content.slice(windowStart, target);

    // Look for paragraph break (double newline)
    const paragraphBreak = window.lastIndexOf('\n\n');
    if (paragraphBreak !== -1) {
      return windowStart + paragraphBreak + 2;
    }

    // Look for sentence break (. ! ?)
    const sentenceBreakMatch = window.match(/[.!?]\s+(?=[A-Z])/g);
    if (sentenceBreakMatch) {
      const lastMatch = window.lastIndexOf(sentenceBreakMatch[sentenceBreakMatch.length - 1]);
      if (lastMatch !== -1) {
        return windowStart + lastMatch + sentenceBreakMatch[sentenceBreakMatch.length - 1].length;
      }
    }

    // Look for any sentence ending
    const anyPeriod = window.lastIndexOf('. ');
    if (anyPeriod !== -1) {
      return windowStart + anyPeriod + 2;
    }

    // Look for word break
    const wordBreak = window.lastIndexOf(' ');
    if (wordBreak !== -1) {
      return windowStart + wordBreak + 1;
    }

    // No good break point found, use target
    return target;
  }

  /**
   * Chunk multiple entries at once
   */
  chunkEntries(entries: ContentEntryWithMeta[]): Map<string, Chunk[]> {
    const result = new Map<string, Chunk[]>();

    for (const entry of entries) {
      result.set(entry.overlay_id, this.chunkContent(entry));
    }

    return result;
  }

  /**
   * Get total chunk count for multiple entries
   */
  getTotalChunkCount(entries: ContentEntryWithMeta[]): number {
    let total = 0;
    for (const entry of entries) {
      const chunks = this.chunkContent(entry);
      total += chunks.length;
    }
    return total;
  }
}
