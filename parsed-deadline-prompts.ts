/**
 * Prompt creation utilities for ParsedDeadlineSuggestions
 */

import {
  UploadedDocument,
  ExtractionConfig,
  ParsedDeadlineSuggestion,
} from "./parsed-deadline-suggestions";

/**
 * Create document extraction prompt
 *
 * @param document - Document to extract from
 * @param config - Extraction configuration
 * @returns Formatted prompt string
 */
export function createDocumentExtractionPrompt(
  document: UploadedDocument,
  config: ExtractionConfig
): string {
  return `${config.basePromptTemplate}

CONTENT TO ANALYZE:
Filename: ${document.filename}
File Type: ${document.fileType}
Content:
${document.content}

Extract all deadline-related information from this content. Focus on assignment due dates, project deadlines, exam dates, and other important academic dates.`;
}

/**
 * Create website extraction prompt
 *
 * @param url - Website URL
 * @param content - Website content
 * @param config - Extraction configuration
 * @returns Formatted prompt string
 */
export function createWebsiteExtractionPrompt(
  url: string,
  content: string,
  config: ExtractionConfig
): string {
  return `${config.basePromptTemplate}

WEBSITE TO ANALYZE:
URL: ${url}

Content:
${content}

Extract all deadline-related information from this webpage. Focus on assignment due dates, project deadlines, exam dates, and other important academic dates.`;
}

/**
 * Create refinement prompt
 *
 * @param suggestion - Original suggestion to refine
 * @param feedback - User feedback
 * @param config - Extraction configuration
 * @returns Formatted prompt string
 */
export function createRefinementPrompt(
  suggestion: ParsedDeadlineSuggestion,
  feedback: string,
  config: ExtractionConfig
): string {
  return `${config.basePromptTemplate}

ORIGINAL SUGGESTION TO REFINE:
Title: ${suggestion.title}
Due Date: ${suggestion.due.toISOString()}
Confidence: ${suggestion.confidence}
Source: ${suggestion.source}
Provenance: ${suggestion.provenance}

USER FEEDBACK:
${feedback}

Please refine the original suggestion based on the user feedback. Update any fields that need correction while maintaining the same JSON structure.`;
}
