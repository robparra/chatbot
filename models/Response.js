import { DataTypes } from 'sequelize';
import sequelize from '../utils/db.js';
import User from './User.js';

const Response = sequelize.define('Response', {
  key: {
    type: DataTypes.STRING,
    allowNull: false
    // No debe ser único ya que diferentes usuarios pueden usar la misma clave
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  }
});

// Relaciones
User.hasMany(Response, { foreignKey: 'userId' });
Response.belongsTo(User, { foreignKey: 'userId' });

export default Response;
