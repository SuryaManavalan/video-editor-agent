/**
 * Adds sequential ID numbers to each object in an array
 * @param {Array} jsonArray - Array of objects to add IDs to
 * @param {number} startId - Starting ID number (default: 1)
 * @returns {Array} Array with id property added to each object
 */
export const addIdNumbers = (jsonArray, startId = 1) => {
  return jsonArray.map((item, index) => ({
    id: startId + index,
    ...item
  }));
};
