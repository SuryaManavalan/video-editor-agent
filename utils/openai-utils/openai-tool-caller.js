import OpenAI from "openai";
import { executeFunction } from './function-registry.js';

const openai = new OpenAI();

/**
 * Run OpenAI completion with tool calling support
 * @param {Object} options - Configuration options
 * @param {string} options.model - OpenAI model to use (default: "gpt-4")
 * @param {Array} options.tools - Array of tool definitions
 * @param {Array} options.input - Input messages/conversation history
 * @param {string} options.instructions - Optional system instructions
 * @param {number} options.maxIterations - Max iterations for tool calling loop (default: 5)
 * @returns {Promise<Object>} Final response with output and full conversation history
 */
export const runWithTools = async ({
  model = "gpt-4",
  tools,
  input,
  instructions = null,
  maxIterations = 5,
}) => {
  // Create a working copy of the input list
  let workingInput = [...input];
  let iteration = 0;
  let response;

  while (iteration < maxIterations) {
    iteration++;
    
    console.log(`\n[Iteration ${iteration}] Calling OpenAI API...`);

    // Call OpenAI API with current input
    const requestOptions = {
      model,
      tools,
      input: workingInput,
    };

    if (instructions) {
      requestOptions.instructions = instructions;
    }

    response = await openai.responses.create(requestOptions);

    // Check if there are any function calls to process
    let hasFunctionCalls = false;
    const functionCallOutputs = [];

    for (const item of response.output) {
      if (item.type === "function_call") {
        hasFunctionCalls = true;
        console.log(`[Tool Call] ${item.name} with args:`, item.arguments);

        try {
          // Parse arguments and execute the function
          const args = JSON.parse(item.arguments);
          const result = await executeFunction(item.name, args);

          console.log(`[Tool Result] ${item.name} returned:`, result);

          // Store the function call output
          functionCallOutputs.push({
            type: "function_call_output",
            call_id: item.call_id,
            output: JSON.stringify(result),
          });
        } catch (error) {
          console.error(`[Tool Error] Failed to execute ${item.name}:`, error.message);
          
          // Store error output
          functionCallOutputs.push({
            type: "function_call_output",
            call_id: item.call_id,
            output: JSON.stringify({
              success: false,
              error: error.message,
            }),
          });
        }
      }
    }

    // If no function calls were made, we're done
    if (!hasFunctionCalls) {
      console.log(`\n[Complete] No more function calls needed.`);
      break;
    }

    // Add all function outputs to the input
    workingInput.push(...functionCallOutputs);

    // Check if we've hit max iterations
    if (iteration >= maxIterations) {
      console.warn(`\n[Warning] Reached max iterations (${maxIterations})`);
      break;
    }
  }

  return {
    output: response.output,
    input: workingInput,
    iterations: iteration,
  };
};

/**
 * Simple OpenAI completion without tool calling
 * @param {Object} options - Configuration options
 * @param {string} options.model - OpenAI model to use (default: "gpt-4")
 * @param {Array} options.input - Input messages/conversation history
 * @param {string} options.instructions - Optional system instructions
 * @returns {Promise<Object>} Response from OpenAI
 */
export const run = async ({
  model = "gpt-4",
  input,
  instructions = null,
}) => {
  const requestOptions = {
    model,
    input,
  };

  if (instructions) {
    requestOptions.instructions = instructions;
  }

  const response = await openai.responses.create(requestOptions);
  
  return {
    output: response.output,
    input,
  };
};
