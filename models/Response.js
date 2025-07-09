import { DataTypes } from 'sequelize';
import sequelize from '../utils/db.js';
import User from './User.js';

const Response = sequelize.define('Response', {
  key: {
    type: DataTypes.STRING,
    allowNull: false
    // no unique aquí porque cada usuario puede tener la misma key
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});

// Relaciones
User.hasMany(Response, { foreignKey: 'userId' });
Response.belongsTo(User, { foreignKey: 'userId' });

export default Response;
