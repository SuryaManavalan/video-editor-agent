import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Deletes objects from a JSON file based on an array of IDs
 * @param {string} filePath - Path to the JSON file
 * @param {number[]} idsToDelete - Array of ID numbers to delete
 * @returns {Promise<Object>} Object containing deleted and remaining items
 */
export const deleteByIds = async (filePath, idsToDelete) => {
  // Read the JSON file
  const fileContent = await readFile(filePath, 'utf-8');
  const jsonArray = JSON.parse(fileContent);

  // Filter out items with IDs in the idsToDelete array
  const remaining = jsonArray.filter(item => !idsToDelete.includes(item.id));
  const deleted = jsonArray.filter(item => idsToDelete.includes(item.id));

  // Write the filtered array back to the file
  await writeFile(filePath, JSON.stringify(remaining, null, 2));

  console.log(`Deleted ${deleted.length} item(s) from ${filePath}`);
  console.log(`Remaining items: ${remaining.length}`);

  return { deleted, remaining };
};

/**
 * Deletes objects from a JSON file in a specific directory
 * @param {string} fileName - Name of the JSON file (without path)
 * @param {number[]} idsToDelete - Array of ID numbers to delete
 * @param {string} directory - Directory containing the file (default: './FILES/DIARIZED_TRANSCRIBED')
 * @returns {Promise<Object>} Object containing deleted and remaining items
 */
export const deleteByIdsFromFile = async (fileName, idsToDelete, directory = './FILES/DIARIZED_TRANSCRIBED') => {
  const filePath = join(directory, fileName);
  return await deleteByIds(filePath, idsToDelete);
};
