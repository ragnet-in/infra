require("dotenv").config();

module.exports = {
  migrationFolder: "migrations",
  direction: "up",
  databaseUrl: process.env.POSTGRES_CONNECTION_STRING,
};