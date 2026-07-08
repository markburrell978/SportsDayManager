/**
 * Creates a successful API response.
 *
 * @param {*} data
 * @returns {Object}
 */
function success(data) {
  return {
    success: true,
    message: "",
    data: data
  };
}

/**
 * Creates an error API response.
 *
 * @param {string} message
 * @returns {Object}
 */
function failure(message) {
  return {
    success: false,
    message: message,
    data: null
  };
}