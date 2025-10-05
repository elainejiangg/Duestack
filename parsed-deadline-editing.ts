/**
 * Manual editing utilities for ParsedDeadlineSuggestions
 */

import { ParsedDeadlineSuggestion } from "./parsed-deadline-suggestions";

/**
 * Manually edit a suggestion without calling the LLM
 * This is for direct user edits like correcting dates, times, or titles
 *
 * requires suggestion exists and newTitle is non-empty and newDue is valid
 * effect updates suggestion title and due date without calling LLM
 *        sets warnings to indicate manual editing
 *
 * @param suggestion - The suggestion to edit
 * @param updates - Updates to apply
 * @returns Updated suggestion or null if not found
 */
export function editSuggestion(
  suggestion: ParsedDeadlineSuggestion,
  updates: {
    title?: string;
    due?: Date;
    confidence?: number;
    provenance?: string;
  }
): ParsedDeadlineSuggestion {
  // Apply updates directly
  if (updates.title !== undefined) {
    suggestion.title = updates.title;
  }
  if (updates.due !== undefined) {
    suggestion.due = updates.due;
  }
  if (updates.confidence !== undefined) {
    suggestion.confidence = updates.confidence;
  }
  if (updates.provenance !== undefined) {
    suggestion.provenance = updates.provenance;
  }

  // Add manual edit warning
  suggestion.warnings = [
    ...(suggestion.warnings || []),
    "Manually edited by user",
  ];

  console.log(`Manually edited suggestion: "${suggestion.title}"`);
  return suggestion;
}

/**
 * Update suggestion time directly (keeps date, changes time)
 *
 * requires suggestion exists and newTime is valid time format
 * effect updates suggestion time without calling LLM
 *        sets warnings to indicate manual editing
 *
 * @param suggestion - The suggestion to update
 * @param newTime - New time string (e.g., "11:59 PM", "23:59", "11:59pm")
 * @returns true if successful, false otherwise
 */
export function updateSuggestionTime(
  suggestion: ParsedDeadlineSuggestion,
  newTime: string
): boolean {
  // Parse time string (e.g., "11:59 PM", "23:59", "11:59pm")
  const timeMatch = newTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!timeMatch) {
    console.error(`Invalid time format: ${newTime}`);
    return false;
  }

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const period = timeMatch[3]?.toLowerCase();

  // Convert to 24-hour format
  if (period === "pm" && hours !== 12) {
    hours += 12;
  } else if (period === "am" && hours === 12) {
    hours = 0;
  }

  // Update the date with new time
  const newDate = new Date(suggestion.due);
  newDate.setHours(hours, minutes, 0, 0);

  return editSuggestion(suggestion, { due: newDate }) !== null;
}

/**
 * Batch update multiple suggestions with timing rules
 * Useful for applying consistent timing to multiple assignments
 *
 * requires suggestionIds is non-empty array and timeRule is valid time format
 * effect updates multiple suggestions with consistent timing
 *        returns success/failure counts
 *
 * @param suggestions - Array of suggestions to update
 * @param suggestionIds - IDs of suggestions to update
 * @param timeRule - Time rule to apply (e.g., "11:59 PM")
 * @returns Object with success and failed counts
 */
export function batchUpdateTiming(
  suggestions: ParsedDeadlineSuggestion[],
  suggestionIds: string[],
  timeRule: string
): { success: number; failed: number } {
  let success = 0;
  let failed = 0;

  for (const id of suggestionIds) {
    const suggestion = suggestions.find((s) => s.id === id);
    if (suggestion && updateSuggestionTime(suggestion, timeRule)) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`Batch timing update: ${success} successful, ${failed} failed`);
  return { success, failed };
}
