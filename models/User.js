import { DataTypes } from 'sequelize';
import db from '../utils/db.js';

const User = db.define('User', {
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  plan: {
    type: DataTypes.STRING, // "basic", "pro", "premium"
    allowNull: false,
    defaultValue: 'basic'
  }
});

export default User;
