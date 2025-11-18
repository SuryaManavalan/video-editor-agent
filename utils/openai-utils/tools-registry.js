/**
 * Tool definitions for OpenAI function calling
 * Each tool should match the OpenAI API schema
 */
export const TOOLS = {
  DELETE_BY_IDS: {
    type: "function",
    name: "delete_by_ids",
    description: "Delete transcription segments from a JSON file based on their ID numbers. Use this when you need to remove specific segments from a transcription.",
    parameters: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "The name of the JSON file (e.g., 'test1_pauses_trimmed.json')",
        },
        idsToDelete: {
          type: "array",
          items: {
            type: "number",
          },
          description: "Array of ID numbers to delete from the file",
        },
      },
      required: ["fileName", "idsToDelete"],
    },
  },

  IDENTIFY_REDUNDANT_SEGMENTS: {
    type: "function",
    name: "identify_redundant_segments",
    description: "Identify which segment IDs should be deleted because they are redundant or inferior takes. This does NOT delete them, only returns the list of IDs that should be removed.",
    parameters: {
      type: "object",
      properties: {
        idsToDelete: {
          type: "array",
          items: {
            type: "number",
          },
          description: "Array of segment ID numbers that should be deleted",
        },
        reason: {
          type: "string",
          description: "Brief explanation of why these segments should be deleted",
        },
      },
      required: ["idsToDelete", "reason"],
    },
  },
  
  // Add more tools here as needed
};

/**
 * Get an array of all tool definitions
 * @returns {Array} Array of tool definitions for OpenAI API
 */
export const getAllTools = () => {
  return Object.values(TOOLS);
};

/**
 * Get specific tools by their keys
 * @param {string[]} toolKeys - Array of tool keys from TOOLS object
 * @returns {Array} Array of selected tool definitions
 */
export const getTools = (toolKeys) => {
  return toolKeys.map(key => TOOLS[key]).filter(Boolean);
};
