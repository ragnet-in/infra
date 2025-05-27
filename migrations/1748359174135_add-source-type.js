// /**
//  * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
//  */
// export const shorthands = undefined;

// /**
//  * @param pgm {import('node-pg-migrate').MigrationBuilder}
//  * @param run {() => void | undefined}
//  * @returns {Promise<void> | void}
//  */
// export const up = (pgm) => {
//     pgm.addColumn('sources', {
//         type: { type: 'varchar(50)' },
//     });
// };


// /**
//  * @param pgm {import('node-pg-migrate').MigrationBuilder}
//  * @param run {() => void | undefined}
//  * @returns {Promise<void> | void}
//  */
// export const down = (pgm) => {
//     pgm.dropColumn('sources', 'type');
// };

exports.up = (pgm) => {
  // Add name column to users
  pgm.addColumn('sources', {
    type: { type: 'varchar(50)' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('sources', 'type');
};