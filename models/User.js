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
  },
  phone: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true // Puede ser null si no todos los usuarios tienen teléfono registrado
  }
});

export default User;
