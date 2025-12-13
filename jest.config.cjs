module.exports = {
  transform: {
    "^.+\\.js$": "babel-jest", // Use babel-jest for transforming .js files
  },
  transformIgnorePatterns: [
    "/node_modules/(?!nanoid)/", // Do not ignore nanoid in node_modules
  ],
  testEnvironment: "node", // Set Jest to run in Node.js environment
  moduleFileExtensions: ["js"], // Ensure Jest works with .js files
};
