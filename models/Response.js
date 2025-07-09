import { Sequelize, DataTypes } from 'sequelize';
import db from '../utils/db.js';

const Response = db.define('Response', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});

export default Response;
