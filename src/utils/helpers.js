/**
 * Removes the City, ST found in a given string
 *
 * @param {String} str Given string to inspect for City, ST
 *
 * @returns {String} The filtered string
 */
exports.removeCityState = str => {
  return str.replace(/([A-z]+),? [A-Z]{2}/, "")
}