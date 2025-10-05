/**
 * State management for ParsedDeadlineSuggestions
 */

import {
  ParsedDeadlineSuggestion,
  ExtractionConfig,
} from "./parsed-deadline-suggestions";

/**
 * State manager for ParsedDeadlineSuggestions
 * Handles all state operations including suggestions and configuration
 */
export class ParsedDeadlineState {
  private suggestions: ParsedDeadlineSuggestion[] = [];
  private extractionConfig: ExtractionConfig;

  constructor() {
    // Default extraction configuration
    this.extractionConfig = {
      modelVersion: "gemini-2.5-flash-lite",
      basePromptTemplate: `Extract all deadline information from the provided content. Include all assignment deadlines, project due dates, exam dates, and important academic dates.

For each deadline, provide:
- title: Clear, descriptive name of the assignment/project/exam
- due: ISO 8601 date-time format (YYYY-MM-DDTHH:mm:ssZ)
- confidence: Score from 0.0 to 1.0 (use 0.8+ only when very certain)
- provenance: Brief description of where this information was found

Focus on academic deadlines and be conservative with confidence scores.`,
      maxTokens: 2000,
      temperature: 0.1,
      timezone: "America/New_York",
      timeout: 30000, // 30 seconds
    };
  }

  /**
   * Add suggestions to the state
   *
   * @param suggestions - Array of suggestions to add
   * @returns void
   */
  addSuggestions(suggestions: ParsedDeadlineSuggestion[]): void {
    this.suggestions.push(...suggestions);
  }

  /**
   * Get all suggestions
   *
   * @returns Copy of all suggestions
   */
  getAllSuggestions(): ParsedDeadlineSuggestion[] {
    return [...this.suggestions];
  }

  /**
   * Get suggestions by source
   *
   * @param source - Source type to filter by
   * @returns Filtered suggestions by source
   */
  getSuggestionsBySource(source: string): ParsedDeadlineSuggestion[] {
    return this.suggestions.filter((s) => s.source === source);
  }

  /**
   * Get unconfirmed suggestions
   *
   * @returns Unconfirmed suggestions
   */
  getUnconfirmedSuggestions(): ParsedDeadlineSuggestion[] {
    return this.suggestions.filter((s) => !s.confirmed);
  }

  /**
   * Get a suggestion by ID
   *
   * @param suggestionId - ID of suggestion to retrieve
   * @returns Suggestion if found, null otherwise
   */
  getSuggestionById(suggestionId: string): ParsedDeadlineSuggestion | null {
    return this.suggestions.find((s) => s.id === suggestionId) || null;
  }

  /**
   * Update a suggestion by ID
   *
   * @param suggestionId - ID of suggestion to update
   * @param updatedSuggestion - Updated suggestion
   * @returns true if found and updated, false otherwise
   */
  updateSuggestion(
    suggestionId: string,
    updatedSuggestion: ParsedDeadlineSuggestion
  ): boolean {
    const index = this.suggestions.findIndex((s) => s.id === suggestionId);
    if (index === -1) {
      return false;
    }
    this.suggestions[index] = updatedSuggestion;
    return true;
  }

  /**
   * Remove a suggestion by ID
   *
   * @param suggestionId - ID of suggestion to remove
   * @returns true if found and removed, false otherwise
   */
  removeSuggestion(suggestionId: string): boolean {
    const index = this.suggestions.findIndex((s) => s.id === suggestionId);
    if (index === -1) {
      return false;
    }
    this.suggestions.splice(index, 1);
    return true;
  }

  /**
   * Clear all suggestions
   *
   * @returns void
   */
  clearSuggestions(): void {
    this.suggestions = [];
  }

  /**
   * Get the current extraction configuration
   *
   * @returns Current extraction configuration
   */
  getExtractionConfig(): ExtractionConfig {
    return { ...this.extractionConfig };
  }

  /**
   * Update the extraction configuration
   *
   * @param config - New extraction configuration
   * @returns void
   */
  updateExtractionConfig(config: Partial<ExtractionConfig>): void {
    this.extractionConfig = { ...this.extractionConfig, ...config };
  }

  /**
   * Get suggestions count
   *
   * @returns Number of suggestions
   */
  getSuggestionsCount(): number {
    return this.suggestions.length;
  }

  /**
   * Get suggestions by extraction method
   *
   * @param method - Extraction method to filter by
   * @returns Filtered suggestions by extraction method
   */
  getSuggestionsByMethod(method: string): ParsedDeadlineSuggestion[] {
    return this.suggestions.filter((s) => s.extractionMethod === method);
  }

  /**
   * Get suggestions with warnings
   *
   * @returns Suggestions that have warnings
   */
  getSuggestionsWithWarnings(): ParsedDeadlineSuggestion[] {
    return this.suggestions.filter((s) => s.warnings && s.warnings.length > 0);
  }

  /**
   * Get suggestions by confidence range
   *
   * @param minConfidence - Minimum confidence score
   * @param maxConfidence - Maximum confidence score
   * @returns Filtered suggestions by confidence range
   */
  getSuggestionsByConfidence(
    minConfidence: number,
    maxConfidence: number
  ): ParsedDeadlineSuggestion[] {
    return this.suggestions.filter(
      (s) =>
        s.confidence !== undefined &&
        s.confidence >= minConfidence &&
        s.confidence <= maxConfidence
    );
  }

  /**
   * Get suggestions due within a date range
   *
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @returns Filtered suggestions by date range
   */
  getSuggestionsByDateRange(
    startDate: Date,
    endDate: Date
  ): ParsedDeadlineSuggestion[] {
    return this.suggestions.filter(
      (s) => s.due >= startDate && s.due <= endDate
    );
  }

  /**
   * Get statistics about the current state
   *
   * @returns State statistics
   */
  getStateStatistics(): {
    totalSuggestions: number;
    confirmedSuggestions: number;
    unconfirmedSuggestions: number;
    suggestionsBySource: Record<string, number>;
    suggestionsByMethod: Record<string, number>;
    averageConfidence: number;
    suggestionsWithWarnings: number;
  } {
    const totalSuggestions = this.suggestions.length;
    const confirmedSuggestions = this.suggestions.filter(
      (s) => s.confirmed
    ).length;
    const unconfirmedSuggestions = totalSuggestions - confirmedSuggestions;

    const suggestionsBySource = this.suggestions.reduce((acc, s) => {
      acc[s.source] = (acc[s.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const suggestionsByMethod = this.suggestions.reduce((acc, s) => {
      const method = s.extractionMethod || "unknown";
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const confidenceScores = this.suggestions
      .filter((s) => s.confidence !== undefined)
      .map((s) => s.confidence!);
    const averageConfidence =
      confidenceScores.length > 0
        ? confidenceScores.reduce((sum, conf) => sum + conf, 0) /
          confidenceScores.length
        : 0;

    const suggestionsWithWarnings = this.suggestions.filter(
      (s) => s.warnings && s.warnings.length > 0
    ).length;

    return {
      totalSuggestions,
      confirmedSuggestions,
      unconfirmedSuggestions,
      suggestionsBySource,
      suggestionsByMethod,
      averageConfidence,
      suggestionsWithWarnings,
    };
  }
}
