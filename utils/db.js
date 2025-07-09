import { Sequelize } from 'sequelize';

const db = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite'  // Puedes cambiar esto a PostgreSQL luego
});

export default db;
