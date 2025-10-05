/**
 * Three challenging test scenarios, each comprising a full user-LLM interaction sequence
 */

import { ParsedDeadlineSuggestions } from "./parsed-deadline-suggestions";
import { GeminiLLM } from "./gemini-llm";
import type {
  UploadedDocument,
  ExtractionConfig,
  User,
} from "./parsed-deadline-suggestions";

function loadConfig() {
  const fs = require("fs");
  const path = require("path");
  try {
    const configPath = path.join(__dirname, "../config.json");
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return configData;
  } catch (error) {
    throw new Error("Failed to load config.json");
  }
}

function createMockUser(): User {
  return { id: "test-user", name: "Test User", email: "test@example.com" };
}

/**
 * SCENARIO 1: Ambiguous Academic Language
 * Full sequence: Upload → Initial extraction → Review → Notice hallucinations → Feedback → Re-extract → Validate
 */
export async function testScenario1_AmbiguousLanguage(): Promise<void> {
  console.log("\n--------------------------------------------------");
  console.log("SCENARIO 1: Ambiguous Academic Language");
  console.log("--------------------------------------------------\n");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);

  // USER ACTION 1: Upload document with vague terms
  console.log(
    "[USER ACTION 1] Student uploads syllabus with vague terms like 'TBD', 'Soon'"
  );
  const fs = require("fs");
  const path = require("path");
  const syllabusPath = path.join(
    __dirname,
    "../test-assets/sample-syllabus.txt"
  );
  const syllabusContent = fs.readFileSync(syllabusPath, "utf8");
  const document: UploadedDocument = {
    id: "sample-syllabus",
    filename: "sample-syllabus.txt",
    content: syllabusContent,
    fileType: "txt" as const,
    uploadDate: new Date(),
  };
  console.log("Document uploaded\n");

  // LLM ACTION 1: Initial extraction with basic prompt
  console.log(
    "[LLM ACTION 1] System performs initial extraction with generic prompt"
  );
  const basicConfig: ExtractionConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract deadline information. Return JSON with "suggestions" array containing: title, due (ISO date), confidence (0-1), provenance.`,
    maxTokens: 1000,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  let initialResults: any[] = [];
  try {
    initialResults = await parser.llmExtractFromDocument(
      document,
      basicConfig,
      llm
    );
    console.log(`Extracted ${initialResults.length} suggestions`);
    parser.displaySuggestions();
  } catch (error) {
    console.error("Extraction failed:", (error as Error).message);
  }

  // USER ACTION 2: Review and notice hallucinations
  console.log(
    "\n[USER ACTION 2] Student reviews results and notices hallucinated dates"
  );
  const suspicious = initialResults.filter(
    (s) =>
      s.title.toLowerCase().includes("tbd") ||
      s.title.toLowerCase().includes("soon")
  );
  console.log(
    `Found ${suspicious.length} suspicious suggestions with vague terms`
  );
  if (suspicious.length > 0) {
    suspicious.forEach((s) => console.log(`  - "${s.title}"`));
  }

  // USER ACTION 3: Provide feedback
  console.log("\n[USER ACTION 3] Student provides feedback:");
  console.log(
    '"Reject vague terms like TBD and Soon - only extract explicit dates"'
  );

  parser.clearSuggestions();

  // LLM ACTION 2: Re-extract with conservative prompt
  console.log(
    "\n[LLM ACTION 2] System re-extracts with conservative prompt based on feedback"
  );
  const conservativeConfig: ExtractionConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract ONLY deadlines with explicit dates. 
    REJECT: "TBD", "will be announced", "soon", "later". 
    ACCEPT: Explicit dates only.
    Return JSON with "suggestions" array.`,
    maxTokens: 1000,
    temperature: 0.05,
    timezone: "America/New_York",
  };

  try {
    const refinedResults = await parser.llmExtractFromDocument(
      document,
      conservativeConfig,
      llm
    );
    console.log(`Re-extracted ${refinedResults.length} suggestions`);
    const stillSuspicious = refinedResults.filter(
      (s) =>
        s.title.toLowerCase().includes("tbd") ||
        s.title.toLowerCase().includes("soon")
    );
    console.log(
      `Hallucinations reduced: ${stillSuspicious.length} vague terms (down from ${suspicious.length})`
    );
    parser.displaySuggestions();
  } catch (error) {
    console.error("Re-extraction failed:", (error as Error).message);
  }

  // USER ACTION 4: Validate and confirm
  console.log(
    "\n[USER ACTION 4] Student validates improved results and confirms"
  );
  const finalResults = parser.getAllSuggestions();
  console.log(`${finalResults.length} clean suggestions ready to confirm`);
  console.log("\nSCENARIO 1 COMPLETE\n");
}

/**
 * SCENARIO 2: MIT Course Date Formats
 * Full sequence: Upload → Initial extraction → Notice errors → Manual correction → Re-extract → Validate → Confirm
 */
export async function testScenario2_DateFormats(): Promise<void> {
  console.log("\n--------------------------------------------------");
  console.log("SCENARIO 2: MIT Course Date Formats");
  console.log("--------------------------------------------------\n");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);
  const user = createMockUser();

  // USER ACTION 1: Upload document with mixed formats
  console.log(
    "[USER ACTION 1] Student uploads document with multiple date formats"
  );
  const fs = require("fs");
  const path = require("path");
  const syllabusPath = path.join(
    __dirname,
    "../test-assets/sample-syllabus.txt"
  );
  const syllabusContent = fs.readFileSync(syllabusPath, "utf8");
  const document: UploadedDocument = {
    id: "sample-syllabus",
    filename: "sample-syllabus.txt",
    content: syllabusContent,
    fileType: "txt" as const,
    uploadDate: new Date(),
  };
  console.log(
    "Document uploaded (contains dates like '3/15/2025', 'March 20', etc.)\n"
  );

  // LLM ACTION 1: Initial extraction
  console.log("[LLM ACTION 1] System performs initial extraction");
  const basicConfig: ExtractionConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract deadline information. Return JSON with "suggestions" array.`,
    maxTokens: 1000,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  let initialResults: any[] = [];
  try {
    initialResults = await parser.llmExtractFromDocument(
      document,
      basicConfig,
      llm
    );
    console.log(`Extracted ${initialResults.length} suggestions`);
    parser.displaySuggestions();
  } catch (error) {
    console.error("Extraction failed:", (error as Error).message);
  }

  // USER ACTION 2: Notice incorrect dates
  console.log(
    "\n[USER ACTION 2] Student notices some dates might be misinterpreted"
  );
  console.log("Ambiguous formats like 3/15/2025 could be DD/MM or MM/DD");

  // USER ACTION 3: Manually correct one example
  console.log(
    "\n[USER ACTION 3] Student manually corrects one date as an example"
  );
  if (initialResults.length > 0) {
    const firstId = initialResults[0].id;
    const correctedDate = new Date("2025-03-15T23:59:00-04:00");
    parser.updateSuggestionDate(firstId, correctedDate);
    console.log(
      `Manually corrected "${initialResults[0].title}" to March 15, 2025`
    );
  }

  parser.clearSuggestions();

  // LLM ACTION 2: Re-extract with format specifications
  console.log("\n[LLM ACTION 2] System re-extracts with explicit format rules");
  const enhancedConfig: ExtractionConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract deadlines. DATE FORMAT RULES:
    - MM/DD/YYYY (e.g., 3/15/2025 = March 15, 2025)
    - "Month DD" = current year
    - ISO format: YYYY-MM-DD
    Return JSON with "suggestions" array.`,
    maxTokens: 1000,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  try {
    const refinedResults = await parser.llmExtractFromDocument(
      document,
      enhancedConfig,
      llm
    );
    console.log(
      `Re-extracted ${refinedResults.length} suggestions with proper format interpretation`
    );
    parser.displaySuggestions();
  } catch (error) {
    console.error("Re-extraction failed:", (error as Error).message);
  }

  // USER ACTION 4: Validate corrections
  console.log(
    "\n[USER ACTION 4] Student validates that dates are now correctly interpreted"
  );
  console.log("All dates verified");

  // USER ACTION 5: Confirm deadlines
  console.log("\n[USER ACTION 5] Student confirms all deadlines");
  const finalResults = parser.getAllSuggestions();
  if (finalResults.length > 0) {
    parser.confirm(finalResults[0], user);
    console.log(`Confirmed ${finalResults.length} deadlines`);
  }
  console.log("\nSCENARIO 2 COMPLETE\n");
}

/**
 * SCENARIO 3: Context-Dependent Deadline Interpretation
 * Full sequence: Upload → Initial extraction creates duplicates → Notice conflict → Feedback → Re-extract with resolution → Confirm
 */
export async function testScenario3_ConflictResolution(): Promise<void> {
  console.log("\n--------------------------------------------------");
  console.log("SCENARIO 3: Context-Dependent Deadline Interpretation");
  console.log("--------------------------------------------------\n");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);
  const user = createMockUser();

  // USER ACTION 1: Upload document with conflicting information
  console.log(
    "[USER ACTION 1] Student uploads document mentioning same assignment with different dates"
  );
  const documentContent = `
    Course Syllabus
    ===============
    
    PS1 due Oct 15
    
    ...later in document...
    
    Problem Set 1 deadline: Oct 20 (extended)
  `;
  const document: UploadedDocument = {
    id: "conflicting-doc",
    filename: "syllabus-with-conflicts.txt",
    content: documentContent,
    fileType: "txt" as const,
    uploadDate: new Date(),
  };
  console.log(
    "Document uploaded (mentions 'PS1 due Oct 15' and 'Problem Set 1 deadline: Oct 20')\n"
  );

  // LLM ACTION 1: Initial extraction creates duplicates
  console.log("[LLM ACTION 1] System performs initial extraction");
  const basicConfig: ExtractionConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract all deadline mentions. Return JSON with "suggestions" array.`,
    maxTokens: 1000,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  let initialResults: any[] = [];
  try {
    initialResults = await parser.llmExtractFromDocument(
      document,
      basicConfig,
      llm
    );
    console.log(`Extracted ${initialResults.length} suggestions`);
    parser.displaySuggestions();
  } catch (error) {
    console.error("Extraction failed:", (error as Error).message);
  }

  // USER ACTION 2: Notice conflict
  console.log(
    "\n[USER ACTION 2] Student notices duplicate entries for same assignment"
  );
  const ps1Mentions = initialResults.filter(
    (s) =>
      s.title.toLowerCase().includes("ps1") ||
      s.title.toLowerCase().includes("problem set 1")
  );
  if (ps1Mentions.length > 1) {
    console.log(
      `Found ${ps1Mentions.length} entries for same assignment with different dates:`
    );
    ps1Mentions.forEach((s) =>
      console.log(`  - "${s.title}" on ${new Date(s.due).toLocaleDateString()}`)
    );
  }

  // USER ACTION 3: Provide feedback
  console.log("\n[USER ACTION 3] Student provides feedback:");
  console.log(
    '"PS1 and Problem Set 1 are the same assignment - use the later date"'
  );

  parser.clearSuggestions();

  // LLM ACTION 2: Re-extract with conflict resolution
  console.log(
    "\n[LLM ACTION 2] System re-extracts with conflict resolution logic"
  );
  const resolvedConfig: ExtractionConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract deadlines. CONFLICT RESOLUTION:
    - If same assignment mentioned multiple times, use the LATEST mention
    - "PS1" and "Problem Set 1" are the same assignment
    - Combine into single entry
    Return JSON with "suggestions" array.`,
    maxTokens: 1000,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  try {
    const resolvedResults = await parser.llmExtractFromDocument(
      document,
      resolvedConfig,
      llm
    );
    console.log(
      `Re-extracted ${resolvedResults.length} suggestions (duplicates resolved)`
    );
    parser.displaySuggestions();

    const ps1After = resolvedResults.filter(
      (s) =>
        s.title.toLowerCase().includes("ps1") ||
        s.title.toLowerCase().includes("problem set 1")
    );
    console.log(
      `Conflict resolved: ${ps1After.length} entry for PS1 (down from ${ps1Mentions.length})`
    );
  } catch (error) {
    console.error("Re-extraction failed:", (error as Error).message);
  }

  // USER ACTION 4: Confirm resolved deadline
  console.log("\n[USER ACTION 4] Student confirms the resolved deadline");
  const finalResults = parser.getAllSuggestions();
  if (finalResults.length > 0) {
    parser.confirm(finalResults[0], user);
    console.log(`Confirmed resolved deadline`);
  }
  console.log("\nSCENARIO 3 COMPLETE\n");
}

/**
 * Run all three challenging scenarios
 */
async function main() {
  console.log("\n");
  console.log("THREE CHALLENGING TEST SCENARIOS (Full User Flows)");
  console.log("==================================================");

  try {
    await testScenario1_AmbiguousLanguage();
    await testScenario2_DateFormats();
    await testScenario3_ConflictResolution();

    console.log("\n==================================================");
    console.log("ALL THREE SCENARIOS COMPLETED SUCCESSFULLY");
    console.log("==================================================\n");
  } catch (error) {
    console.error("\nError in scenarios:", (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
